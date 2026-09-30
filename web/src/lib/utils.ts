import {
  AssetMediaSize,
  AssetTypeEnum,
  MemoryType,
  finishOAuth,
  getAssetOriginalPath,
  getAssetPlaybackPath,
  getAssetThumbnailPath,
  getBaseUrl,
  getPeopleThumbnailPath,
  getUserProfileImagePath,
  linkOAuthAccount,
  startOAuth,
  unlinkOAuthAccount,
  type AssetResponseDto,
  type MemoryResponseDto,
  type PersonResponseDto,
  type ServerVersionResponseDto,
  type SharedLinkResponseDto,
  type UserResponseDto,
} from '@immich/sdk';
import { toastManager, type ActionItem, type IfLike } from '@immich/ui';
import { DateTime } from 'luxon';
import { init, register, t } from 'svelte-i18n';
import { derived, get } from 'svelte/store';
import { defaultLang, locales } from '$lib/constants';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { getFeaturedAssetMediaUrl } from '$lib/services/featured.service';
import { publicFeaturedGallery } from '$lib/stores/featured-gallery.store';
import {
  alwaysLoadOriginalFile,
  lang,
  locale,
  preferUnenhancedSharedThumbnails,
  preferUnenhancedThumbnails,
} from '$lib/stores/preferences.store';
import { isWebCompatibleImage } from '$lib/utils/asset-utils';
import { handleError } from '$lib/utils/handle-error';
import { convertBCP47, langs } from '$lib/utils/i18n';

interface DownloadRequestOptions<T = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: T;
  signal?: AbortSignal;
  onDownloadProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
}

interface DateFormatter {
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
}

export const initLanguage = async () => {
  const preferenceLang = get(lang);
  for (const { code, loader } of langs) {
    register(convertBCP47(code), loader);
  }

  await init({ fallbackLocale: preferenceLang === 'dev' ? 'dev' : defaultLang.code, initialLocale: preferenceLang });
};

interface UploadRequestOptions {
  url: string;
  method?: 'POST' | 'PUT';
  data: FormData;
  onUploadProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
}

export class AbortError extends Error {
  override name = 'AbortError';
}

class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    public override message: string,
    public statusCode: number,
    public details: string,
  ) {
    super(message);
  }
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

let unsubscribeId = 0;
const uploads: Record<number, () => void> = {};

const trackUpload = (unsubscribe: () => void) => {
  const id = unsubscribeId++;
  uploads[id] = unsubscribe;
  return () => {
    delete uploads[id];
  };
};

export const cancelUploadRequests = () => {
  for (const unsubscribe of Object.values(uploads)) {
    unsubscribe();
  }
};

export const uploadRequest = async <T>(options: UploadRequestOptions): Promise<{ data: T; status: number }> => {
  const { onUploadProgress: onProgress, data, url } = options;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const unsubscribe = trackUpload(() => xhr.abort());

    xhr.addEventListener('error', (error) => {
      unsubscribe();
      reject(error);
    });

    xhr.addEventListener('load', () => {
      unsubscribe();
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: xhr.response as T, status: xhr.status });
      } else {
        reject(new ApiError(xhr.statusText, xhr.status, xhr.response));
      }
    });

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => onProgress(event));
    }

    xhr.open(options.method || 'POST', url);
    xhr.responseType = 'json';
    xhr.send(data);
  });
};

export const downloadRequest = <TBody = unknown>(options: DownloadRequestOptions<TBody> | string) => {
  if (typeof options === 'string') {
    options = { url: options };
  }

  const { signal, method, url, data: body, onDownloadProgress: onProgress } = options;

  return new Promise<{ data: Blob; status: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener('error', (error) => reject(error));
    xhr.addEventListener('abort', () => reject(new AbortError()));
    xhr.addEventListener('load', () => {
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: xhr.response as Blob, status: xhr.status });
      } else {
        reject(new ApiError(xhr.statusText, xhr.status, xhr.responseText));
      }
    });

    if (onProgress) {
      xhr.addEventListener('progress', (event) => onProgress(event));
    }

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.open(method || 'GET', url);
    xhr.responseType = 'blob';

    if (body) {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(body));
    } else {
      xhr.send();
    }
  });
};

let _sharedLink: SharedLinkResponseDto | undefined;

export const setSharedLink = (sharedLink: typeof _sharedLink) => (_sharedLink = sharedLink);
export const getSharedLink = (): typeof _sharedLink => _sharedLink;

const getUnenhancedPreference = (isSharedLink: boolean) =>
  get(isSharedLink ? preferUnenhancedSharedThumbnails : preferUnenhancedThumbnails);

const createUrl = (path: string, parameters?: Record<string, unknown>) => {
  const searchParameters = new URLSearchParams();
  for (const key in parameters) {
    const value = parameters[key];
    if (value !== undefined && value !== null) {
      searchParameters.set(key, value.toString());
    }
  }

  const url = new URL(path, 'https://example.com');
  url.search = searchParameters.toString();

  return getBaseUrl() + url.pathname + url.search + url.hash;
};

type AssetUrlOptions = {
  id: string;
  cacheKey?: string | null;
  edited?: boolean;
  size?: AssetMediaSize;
  /** Pass through to API; when true, requests standard preview/thumbnail (not auto-enhanced). */
  unenhanced?: boolean;
};

export const getAssetUrl = ({
  asset,
  sharedLink,
  forceOriginal = false,
}: {
  asset: AssetResponseDto | undefined;
  sharedLink?: SharedLinkResponseDto;
  forceOriginal?: boolean;
}) => {
  if (!asset) {
    return;
  }
  const id = asset.id;
  const cacheKey = asset.thumbhash;
  const unenhanced = getUnenhancedPreference(!!sharedLink);
  if (sharedLink && (!sharedLink.allowDownload || !sharedLink.showMetadata)) {
    return getAssetMediaUrl({ id, size: AssetMediaSize.Preview, cacheKey, unenhanced });
  }
  const size = targetImageSize(asset, forceOriginal);
  return getAssetMediaUrl({ id, size, cacheKey, unenhanced });
};

export function getAssetUrls(asset: AssetResponseDto, sharedLink?: SharedLinkResponseDto) {
  const unenhanced = getUnenhancedPreference(!!sharedLink);
  return {
    thumbnail: getAssetMediaUrl({
      id: asset.id,
      cacheKey: asset.thumbhash,
      size: AssetMediaSize.Thumbnail,
      unenhanced,
    }),
    preview: getAssetUrl({ asset, sharedLink })!,
    original: getAssetUrl({ asset, sharedLink, forceOriginal: true })!,
  };
}

const forceUseOriginal = (asset: AssetResponseDto) => {
  return asset.type === AssetTypeEnum.Image && asset.duration;
};

export const targetImageSize = (asset: AssetResponseDto, forceOriginal: boolean) => {
  if (forceOriginal || get(alwaysLoadOriginalFile) || forceUseOriginal(asset)) {
    return asset.type === AssetTypeEnum.Video || isWebCompatibleImage(asset)
      ? AssetMediaSize.Original
      : AssetMediaSize.Fullsize;
  }
  return AssetMediaSize.Preview;
};

export const getAssetMediaUrl = (options: AssetUrlOptions) => {
  const { id, size, cacheKey: c, edited = true, unenhanced: unenhancedOpt } = options;

  if (get(publicFeaturedGallery)) {
    return getFeaturedAssetMediaUrl({
      id,
      size: size ?? AssetMediaSize.Preview,
      cacheKey: c,
      edited,
    });
  }

  const isOriginal = size === AssetMediaSize.Original;
  const path = isOriginal ? getAssetOriginalPath(id) : getAssetThumbnailPath(id);
  const isSharedLink = !!getSharedLink();
  const unenhanced = unenhancedOpt ?? (isOriginal ? false : getUnenhancedPreference(isSharedLink));
  return createUrl(path, {
    ...authManager.params,
    size: isOriginal ? undefined : size,
    c,
    edited,
    ...(unenhanced ? { unenhanced: true } : {}),
  });
};

export const getAssetPlaybackUrl = (options: AssetUrlOptions) => {
  const { id, cacheKey: c } = options;
  return createUrl(getAssetPlaybackPath(id), { ...authManager.params, c });
};

export const getAssetHlsUrl = (id: string) => {
  return createUrl(`/assets/${id}/video/stream/main.m3u8`, authManager.params);
};

export const getAssetHlsSessionUrl = (id: string, sessionId: string) => {
  return createUrl(`/assets/${id}/video/stream/${sessionId}`, authManager.params);
};

export const getProfileImageUrl = (user: UserResponseDto) =>
  createUrl(getUserProfileImagePath(user.id), { updatedAt: user.profileChangedAt });

export const getPeopleThumbnailUrl = (person: PersonResponseDto, updatedAt?: string) =>
  createUrl(getPeopleThumbnailPath(person.id), { updatedAt: updatedAt ?? person.updatedAt });

export const copyToClipboard = async (secret: string | unknown) => {
  const $t = get(t);

  try {
    const value = typeof secret === 'string' ? secret : JSON.stringify(secret, jsonReplacer, 2);
    await navigator.clipboard.writeText(value);
    toastManager.info($t('copied_to_clipboard'));
  } catch (error) {
    handleError(error, $t('errors.unable_to_copy_to_clipboard'));
  }
};

// https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify/43636793#43636793
const jsonReplacer = (_key: string, value: unknown) =>
  value instanceof Object && !Array.isArray(value)
    ? Object.keys(value)
        .sort()
        // eslint-disable-next-line unicorn/no-array-reduce
        .reduce((sorted: { [key: string]: unknown }, key) => {
          sorted[key] = (value as { [key: string]: unknown })[key];
          return sorted;
        }, {})
    : value;

export const downloadBlob = (data: Blob, filename: string) => {
  if (!(data instanceof Blob) || data.size === 0) {
    throw new TypeError('Cannot download empty file');
  }

  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  // Messenger / FB / Instagram WebViews ignore `download` and often block blob saves.
  // Opening in a new tab still lets the user long-press → Save Image.
  if (isRestrictedInAppBrowser()) {
    anchor.target = '_blank';
    anchor.removeAttribute('download');
  }
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** JPEG SOI marker — rejects RAW/WebP bytes wrongly labeled as image/jpeg. */
export const blobHasJpegMagic = async (data: Blob): Promise<boolean> => {
  if (!(data instanceof Blob) || data.size < 3) {
    return false;
  }
  const header = new Uint8Array(await data.slice(0, 3).arrayBuffer());
  return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
};

/**
 * Re-encode through canvas to a phone-safe sRGB JPEG.
 * Fixes gray/dark Photos imports from WebP-as-.jpg, wide-gamut, or odd Content-Types.
 */
export const normalizeImageBlobToJpeg = async (data: Blob, quality = 0.92): Promise<Blob> => {
  if (!(data instanceof Blob) || data.size === 0) {
    throw new TypeError('Cannot normalize empty image');
  }

  const bitmap = await createImageBitmap(data);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new TypeError('Canvas is unavailable');
    }
    context.drawImage(bitmap, 0, 0);

    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new TypeError('JPEG encode failed'))),
        'image/jpeg',
        quality,
      );
    });

    if (jpeg.size === 0) {
      throw new TypeError('JPEG encode produced an empty file');
    }

    return jpeg;
  } finally {
    bitmap.close();
  }
};

/**
 * Prefer downloadRequest + downloadBlob. Direct `<a download>` against Immich's
 * Content-Disposition: inline originals often produces empty (0 KB) files in Safari/Chromium.
 */
export const downloadUrl = (url: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

const RAW_EXTENSIONS = new Set([
  '3fr',
  'arw',
  'cr2',
  'cr3',
  'dng',
  'fff',
  'iiq',
  'kdc',
  'mdc',
  'mef',
  'mos',
  'mrw',
  'nef',
  'nrw',
  'orf',
  'pef',
  'raf',
  'raw',
  'rw2',
  'sr2',
  'srf',
  'srw',
  'x3f',
]);

export const isRawDownloadFilename = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return !!extension && RAW_EXTENSIONS.has(extension);
};

export const downloadUrlPost = (
  url: string,
  assetIds: string[],
  archiveName: string,
  edited = true,
  downloadFormat: 'original' | 'jpg' = 'original',
) => {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = url;
  form.target = '_blank';

  function mkInput(name: string, value: string) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }

  mkInput('assetIds', assetIds.join(','));
  mkInput('archiveName', archiveName);
  mkInput('edited', edited ? 'true' : 'false');
  if (downloadFormat !== 'original') {
    mkInput('downloadFormat', downloadFormat);
  }

  document.body.append(form);
  form.submit();
  form.remove();
};

export const downloadBlob = (data: Blob, filename: string) => downloadUrl(URL.createObjectURL(data), filename);

const guessMimeType = (filename: string, fallback = 'application/octet-stream') => {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg': {
      return 'image/jpeg';
    }
    case 'png': {
      return 'image/png';
    }
    case 'gif': {
      return 'image/gif';
    }
    case 'webp': {
      return 'image/webp';
    }
    case 'heic': {
      return 'image/heic';
    }
    case 'heif': {
      return 'image/heif';
    }
    case 'tif':
    case 'tiff': {
      return 'image/tiff';
    }
    case 'mp4': {
      return 'video/mp4';
    }
    case 'mov': {
      return 'video/quicktime';
    }
    case 'm4v': {
      return 'video/x-m4v';
    }
    case 'webm': {
      return 'video/webm';
    }
    case 'nef': {
      return 'image/x-nikon-nef';
    }
    case 'dng': {
      return 'image/x-adobe-dng';
    }
    default: {
      return fallback;
    }
  }
};

/** Photos/Gallery can typically accept these via the share sheet — not RAW. */
export const isGalleryShareableFilename = (filename: string) => {
  if (isRawDownloadFilename(filename)) {
    return false;
  }

  const mime = guessMimeType(filename);
  return mime.startsWith('image/') || mime.startsWith('video/');
};

/** True for phones/tablets where browser downloads usually land in Files, not Photos/Gallery. */
export const isMobileDownloadClient = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) {
    return true;
  }

  // iPadOS reports as Macintosh but is touch-first.
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
};

/**
 * Facebook Messenger / Instagram / Facebook in-app browsers block blob downloads
 * and often break Web Share. Prefer form-POST archive downloads + open-in-browser hints.
 */
export const isRestrictedInAppBrowser = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|FBIOS|FBSS|Messenger|IABMV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i.test(
    ua,
  );
};

const canShareFiles = (files: File[]) => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  // Some mobile browsers omit canShare or lie; treat missing canShare as ok.
  if (typeof navigator.canShare !== 'function') {
    return true;
  }
  return navigator.canShare({ files });
};

/**
 * On phones, save via the system share sheet (Save Image / Save Video → gallery).
 * Share must run from a user gesture; after fetching the file we show a one-tap
 * Save to Photos confirm so iOS/Android still allow the share sheet.
 * Desktop / non-shareable files use a normal download.
 */
export const shareOrDownloadBlob = async (data: Blob, filename: string) => {
  if (!(data instanceof Blob) || data.size === 0) {
    throw new TypeError('Cannot download empty file');
  }

  const type = data.type && data.type !== 'application/octet-stream' ? data.type : guessMimeType(filename, data.type);
  const typedBlob = type && type !== data.type ? new Blob([data], { type }) : data;

  if (isRawDownloadFilename(filename) || !isGalleryShareableFilename(filename)) {
    downloadBlob(typedBlob, filename);
    return;
  }

  // Chat WebViews (Messenger, etc.): share + blob download are unreliable.
  if (isRestrictedInAppBrowser()) {
    downloadBlob(typedBlob, filename);
    const { toastManager } = await import('@immich/ui');
    const { get } = await import('svelte/store');
    const { t } = await import('svelte-i18n');
    toastManager.info(get(t)('download_in_app_browser_hint'), { timeout: 12_000 });
    return;
  }

  const file = new File([typedBlob], filename, { type: type || 'application/octet-stream' });

  if (isMobileDownloadClient() && canShareFiles([file])) {
    const { modalManager } = await import('@immich/ui');
    const SaveToPhotosModal = (await import('$lib/modals/SaveToPhotosModal.svelte')).default;
    await modalManager.show(SaveToPhotosModal, { file, filename });
    return;
  }

  downloadBlob(typedBlob, filename);
};

export const shareOrDownloadFiles = async (files: File[], filename: string) => {
  const validFiles = files.filter((file) => file.size > 0);
  if (validFiles.length === 0) {
    throw new TypeError('Cannot download empty files');
  }

  if (validFiles.length === 1) {
    await shareOrDownloadBlob(validFiles[0], validFiles[0].name);
    return;
  }

  if (isMobileDownloadClient() && canShareFiles(validFiles)) {
    const { modalManager } = await import('@immich/ui');
    const SaveToPhotosModal = (await import('$lib/modals/SaveToPhotosModal.svelte')).default;
    await modalManager.show(SaveToPhotosModal, { files: validFiles, filename });
    return;
  }

  for (const [index, file] of validFiles.entries()) {
    if (index > 0) {
      await sleep(300);
    }
    downloadBlob(file, file.name);
  }
};

export const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, jsonReplacer, 2)], { type: 'application/json' });
  const downloadKey = filename;
  downloadBlob(blob, downloadKey);

  const $t = get(t);
  toastManager.info($t('downloading_filename', { values: { filename } }));
};

export const oauth = {
  isCallback: (location: Location) => {
    const search = location.search;
    return search.includes('code=') || search.includes('error=');
  },
  isAutoLaunchDisabled: (location: Location) => {
    const values = ['autoLaunch=0', 'password=1', 'password=true'];
    for (const value of values) {
      if (location.search.includes(value)) {
        return true;
      }
    }
    return false;
  },
  isAutoLaunchEnabled: (location: Location) => {
    const value = 'autoLaunch=1';
    return location.search.includes(value);
  },
  authorize: async (location: Location) => {
    const $t = get(t);
    try {
      const redirectUri = location.href.split('?', 1)[0];
      const { url } = await startOAuth({ oAuthConfigDto: { redirectUri } });
      globalThis.location.assign(url);
      return true;
    } catch (error) {
      handleError(error, $t('errors.unable_to_login_with_oauth'));
      return false;
    }
  },
  login: (location: Location) => {
    return finishOAuth({ oAuthCallbackDto: { url: location.href } });
  },
  link: (location: Location) => {
    return linkOAuthAccount({ oAuthCallbackDto: { url: location.href } });
  },
  unlink: () => {
    return unlinkOAuthAccount();
  },
};

export const findLocale = (code: string | undefined) => {
  const language = locales.find((lang) => lang.code === code);
  return {
    code: language?.code,
    name: language?.name,
  };
};

export const asyncTimeout = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const handlePromiseError = <T>(promise: Promise<T>): void => {
  promise.catch((error) => console.error(`[utils.ts]:handlePromiseError ${error}`, error));
};

export const memoryLaneTitle = derived(t, ($t) => {
  return (memory: MemoryResponseDto) => {
    if (memory.type === MemoryType.OnThisDay) {
      const now = new Date();
      const memoryDate = new Date(memory.memoryAt);

      return memoryDate.getUTCDate() === now.getDate() && memoryDate.getUTCMonth() === now.getMonth()
        ? $t('years_ago', { values: { years: now.getFullYear() - memory.data.year } })
        : DateTime.fromJSDate(memoryDate).toLocaleString(DateTime.DATE_MED, { locale: get(locale) });
    }

    return $t('unknown');
  };
});

export const withError = async <T>(fn: () => Promise<T>): Promise<[undefined, T] | [unknown, undefined]> => {
  try {
    const result = await fn();
    return [undefined, result];
  } catch (error) {
    return [error, undefined];
  }
};

// eslint-disable-next-line unicorn/prefer-code-point
export const decodeBase64 = (data: string) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

export function createDateFormatter(localeCode: string | undefined): DateFormatter {
  return {
    formatDate: (date: Date): string =>
      date.toLocaleString(localeCode, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),

    formatTime: (date: Date): string =>
      date.toLocaleString(localeCode, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),

    formatDateTime: (date: Date): string => {
      const formattedDate = date.toLocaleString(localeCode, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const formattedTime = date.toLocaleString(localeCode, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${formattedDate} ${formattedTime}`;
    },
  };
}

export const semverToName = ({ major, minor, patch, prerelease }: ServerVersionResponseDto) =>
  `v${major}.${minor}.${patch}${prerelease === null ? '' : `-rc.${prerelease}`}`;

export const withoutIcons = (actions: ActionItem[]): ActionItem[] =>
  actions.map((action) => ({ ...action, icon: undefined }));

export const isEnabled = ({ $if }: IfLike) => $if?.() ?? true;

export const transformToTitleCase = (text: string) => {
  if (text.length === 0) {
    return text;
  }
  if (text.length === 1) {
    return text.charAt(0).toUpperCase();
  }

  let result = '';
  for (const word of text.toLowerCase().split(' ')) {
    result += word.charAt(0).toUpperCase() + word.slice(1) + ' ';
  }
  return result.trim();
};
