import {
  AssetJobName,
  AssetMediaSize,
  AssetTypeEnum,
  AssetVisibility,
  getAssetInfo,
  getBaseUrl,
  runAssetJobs,
  updateAsset,
  type AssetEditsCreateDto,
  type AssetJobsDto,
  type AssetResponseDto,
} from '@immich/sdk';
import { modalManager, toastManager, type ActionItem } from '@immich/ui';
import {
  mdiAccountCircleOutline,
  mdiAlertOutline,
  mdiCogRefreshOutline,
  mdiCompare,
  mdiContentCopy,
  mdiDatabaseRefreshOutline,
  mdiDownload,
  mdiDownloadBox,
  mdiFaceRecognition,
  mdiHeadSyncOutline,
  mdiHeart,
  mdiHeartOutline,
  mdiImageRefreshOutline,
  mdiImageSearch,
  mdiInformationOutline,
  mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline,
  mdiMotionPauseOutline,
  mdiMotionPlayOutline,
  mdiPlus,
  mdiPresentationPlay,
  mdiShareVariantOutline,
  mdiTagPlusOutline,
  mdiTune,
} from '@mdi/js';
import type { MessageFormatter } from 'svelte-i18n';
import { goto } from '$app/navigation';
import { ProjectionType } from '$lib/constants';
import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { colorManager } from '$lib/managers/edit/color-manager.svelte';
import { transformManager } from '$lib/managers/edit/transform-manager.svelte';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
import AssetAddToAlbumModal from '$lib/modals/AssetAddToAlbumModal.svelte';
import AssetTagModal from '$lib/modals/AssetTagModal.svelte';
import ProfileImageCropperModal from '$lib/modals/ProfileImageCropperModal.svelte';
import SharedLinkCreateModal from '$lib/modals/SharedLinkCreateModal.svelte';
import { Route } from '$lib/route';
import { SlideshowState, slideshowStore } from '$lib/stores/slideshow.store';
import {
  downloadRequest,
  getAssetMediaUrl,
  getSharedLink,
  isGalleryShareableFilename,
  isMobileDownloadClient,
  isRawDownloadFilename,
  normalizeImageBlobToJpeg,
  shareOrDownloadBlob,
  sleep,
} from '$lib/utils';
import { handleError } from '$lib/utils/handle-error';
import { getFormatter } from '$lib/utils/i18n';
import { asQueryString } from '$lib/utils/shared-links';
import { getFilenameExtension } from '$lib/utils/asset-utils';
import { preferUnenhancedSharedThumbnails, preferUnenhancedThumbnails } from '$lib/stores/preferences.store';
import { get } from 'svelte/store';

const originalFormatLabel = (asset: AssetResponseDto) =>
  getFilenameExtension(asset.originalFileName || asset.originalPath).toUpperCase() || 'FILE';

const originalDownloadTitle = ($t: MessageFormatter, asset: AssetResponseDto) => {
  const format = originalFormatLabel(asset);
  if (isRawDownloadFilename(asset.originalFileName)) {
    return $t('download_raw_file', { values: { format } });
  }
  return $t('download_original_file', { values: { format } });
};
const isEditableSharedAsset = (asset: AssetResponseDto) =>
  asset.type === AssetTypeEnum.Image &&
  !asset.livePhotoVideoId &&
  asset.exifInfo?.projectionType !== ProjectionType.EQUIRECTANGULAR &&
  !asset.originalPath.toLowerCase().endsWith('.insp') &&
  !asset.originalPath.toLowerCase().endsWith('.gif') &&
  !asset.originalPath.toLowerCase().endsWith('.svg');

export const getAssetBulkActions = ($t: MessageFormatter) => {
  const ownedAssets = assetMultiSelectManager.ownedAssets;

  const onAction = async (name: AssetJobName) => {
    await handleRunAssetJob({ name, assetIds: ownedAssets.map(({ id }) => id) });
    assetMultiSelectManager.clear();
  };

  const AddToAlbum: ActionItem = {
    title: $t('add_to_album'),
    icon: mdiPlus,
    shortcuts: [{ key: 'l' }],
    onAction: () =>
      modalManager.show(AssetAddToAlbumModal, { assetIds: assetMultiSelectManager.assets.map((asset) => asset.id) }),
  };

  const RefreshFacesJob: ActionItem = {
    title: $t('refresh_faces'),
    icon: mdiHeadSyncOutline,
    onAction: () => onAction(AssetJobName.RefreshFaces),
  };

  const RefreshMetadataJob: ActionItem = {
    title: $t('refresh_metadata'),
    icon: mdiDatabaseRefreshOutline,
    onAction: () => onAction(AssetJobName.RefreshMetadata),
  };

  const RegenerateThumbnailJob: ActionItem = {
    title: $t('refresh_thumbnails'),
    icon: mdiImageRefreshOutline,
    onAction: () => onAction(AssetJobName.RegenerateThumbnail),
  };

  const TranscodeVideoJob: ActionItem = {
    title: $t('refresh_encoded_videos'),
    icon: mdiCogRefreshOutline,
    onAction: () => onAction(AssetJobName.TranscodeVideo),
    $if: () => ownedAssets.every((asset) => asset.isVideo),
  };

  return { AddToAlbum, RefreshFacesJob, RefreshMetadataJob, RegenerateThumbnailJob, TranscodeVideoJob };
};

export const getAssetActions = ($t: MessageFormatter, asset: AssetResponseDto & { stackPrimaryAssetId?: string }) => {
  const sharedLink = getSharedLink();
  const authUser = authManager.authenticated ? authManager.user : undefined;
  const isOwner = !!(authUser && authUser.id === asset.ownerId);
  const smartSearchEnabled = featureFlagsManager.value.smartSearch;

  const Share: ActionItem = {
    title: $t('share'),
    icon: mdiShareVariantOutline,
    $if: () => !!(authUser && !asset.isTrashed && asset.visibility !== AssetVisibility.Locked),
    onAction: () => modalManager.show(SharedLinkCreateModal, { assetIds: [asset.id] }),
  };

  const isRaw = isRawDownloadFilename(asset.originalFileName);

  const Download: ActionItem = {
    title: isRaw ? $t('download_photo_jpg') : $t('download'),
    icon: mdiDownload,
    shortcuts: { key: 'd', shift: true },
    $if: () => !!authUser,
    onAction: () => handleDownloadAsset(asset, { edited: true, asGalleryPhoto: isRaw }),
  };

  const DownloadOriginal: ActionItem = {
    title: originalDownloadTitle($t, asset),
    icon: mdiDownloadBox,
    $if: () => !!authUser && (asset.isEdited || isRaw),
    onAction: () => handleDownloadAsset(asset, { edited: false }),
  };

  const SharedLinkDownload: ActionItem = {
    title: isRaw ? $t('download_photo_jpg') : asset.isEdited ? $t('download_edited_jpg') : $t('download'),
    icon: mdiDownload,
    shortcuts: { key: 'd', shift: true },
    $if: () => isOwner || !!sharedLink?.allowDownload,
    onAction: async () => {
      if (sharedLink) {
        const edits = [...transformManager.edits, ...colorManager.edits];
        if (edits.length > 0) {
          await handleDownloadRenderedEdits(asset, edits, true);
          return;
        }
      }

      await handleDownloadAsset(asset, { edited: true, asGalleryPhoto: isRaw });
    },
  };

  const SharedLinkDownloadOriginal: ActionItem = {
    title: originalDownloadTitle($t, asset),
    icon: mdiDownloadBox,
    $if: () =>
      !!sharedLink?.allowDownload &&
      asset.type === AssetTypeEnum.Image &&
      !asset.livePhotoVideoId &&
      (isRaw || asset.isEdited),
    onAction: () => handleDownloadAsset(asset, { edited: false }),
  };

  const PlayMotionPhoto: ActionItem = {
    title: $t('play_motion_photo'),
    icon: mdiMotionPlayOutline,
    $if: () => !!asset.livePhotoVideoId && !assetViewerManager.isPlayingMotionPhoto,
    onAction: () => {
      assetViewerManager.isPlayingMotionPhoto = true;
    },
  };

  const StopMotionPhoto: ActionItem = {
    title: $t('stop_motion_photo'),
    icon: mdiMotionPauseOutline,
    $if: () => !!asset.livePhotoVideoId && assetViewerManager.isPlayingMotionPhoto,
    onAction: () => {
      assetViewerManager.isPlayingMotionPhoto = false;
    },
  };

  const PlaySlideshow: ActionItem = {
    title: $t('slideshow'),
    icon: mdiPresentationPlay,
    $if: () => asset.visibility !== AssetVisibility.Locked,
    onAction: () => slideshowStore.slideshowState.set(SlideshowState.PlaySlideshow),
  };

  const Favorite: ActionItem = {
    title: $t('to_favorite'),
    icon: mdiHeartOutline,
    $if: () => isOwner && !asset.isFavorite,
    onAction: () => handleFavorite(asset),
    shortcuts: [{ key: 'f' }],
  };

  const Unfavorite: ActionItem = {
    title: $t('unfavorite'),
    icon: mdiHeart,
    $if: () => isOwner && asset.isFavorite,
    onAction: () => handleUnfavorite(asset),
    shortcuts: [{ key: 'f' }],
  };

  const AddToAlbum: ActionItem = {
    title: $t('add_to_album'),
    icon: mdiPlus,
    shortcuts: [{ key: 'l' }],
    $if: () => asset.visibility !== AssetVisibility.Locked && !asset.isTrashed,
    onAction: () => modalManager.show(AssetAddToAlbumModal, { assetIds: [asset.id] }),
  };

  const Offline: ActionItem = {
    title: $t('asset_offline'),
    icon: mdiAlertOutline,
    color: 'danger',
    $if: () => !!asset.isOffline,
    onAction: () => assetViewerManager.toggleDetailPanel(),
  };

  const ZoomIn: ActionItem = {
    title: $t('zoom_image'),
    icon: mdiMagnifyPlusOutline,
    $if: () => assetViewerManager.canZoomIn(),
    onAction: () => assetViewerManager.emit('Zoom'),
  };

  const ZoomOut: ActionItem = {
    title: $t('zoom_image'),
    icon: mdiMagnifyMinusOutline,
    $if: () => assetViewerManager.canZoomOut(),
    onAction: () => assetViewerManager.emit('Zoom'),
  };

  const Copy: ActionItem = {
    title: $t('copy_image'),
    icon: mdiContentCopy,
    $if: () => assetViewerManager.canCopyImage(),
    onAction: () => assetViewerManager.emit('Copy'),
  };

  const Info: ActionItem = {
    title: $t('info'),
    icon: mdiInformationOutline,
    $if: () => asset.hasMetadata,
    onAction: () => assetViewerManager.toggleDetailPanel(),
    shortcuts: { key: 'i' },
  };

  const Tag: ActionItem = {
    title: $t('add_tag'),
    icon: mdiTagPlusOutline,
    $if: () => authManager.authenticated && authManager.preferences.tags.enabled,
    onAction: () => modalManager.show(AssetTagModal, { assetIds: [asset.id] }),
    shortcuts: { key: 't' },
  };

  const TagPeople: ActionItem = {
    title: $t('tag_people'),
    icon: mdiFaceRecognition,
    $if: () => isOwner && asset.type === AssetTypeEnum.Image && !asset.isTrashed,
    onAction: () => assetViewerManager.toggleFaceEditMode(),
    shortcuts: { key: 'p' },
  };

  const Edit: ActionItem = {
    title: $t('editor'),
    icon: mdiTune,
    $if: () => {
      if (asset.isTrashed) {
        return false;
      }

      const isEditable =
        asset.type === AssetTypeEnum.Video ||
        (asset.type === AssetTypeEnum.Image &&
          !asset.livePhotoVideoId &&
          asset.exifInfo?.projectionType !== ProjectionType.EQUIRECTANGULAR &&
          !asset.originalPath.toLowerCase().endsWith('.insp') &&
          !asset.originalPath.toLowerCase().endsWith('.gif') &&
          !asset.originalPath.toLowerCase().endsWith('.svg'));

      if (!isEditable) {
        return false;
      }

      if (sharedLink) {
        return !!sharedLink.allowDownload && isEditableSharedAsset(asset);
      }

      return isOwner;
    },
    onAction: () => assetViewerManager.openEditor(),
    shortcuts: [{ key: 'e' }],
  };

  const SetProfilePicture: ActionItem = {
    title: $t('set_as_profile_picture'),
    icon: mdiAccountCircleOutline,
    $if: () => asset.type === AssetTypeEnum.Image && asset.visibility !== AssetVisibility.Locked,
    onAction: () => modalManager.show(ProfileImageCropperModal, { asset }),
  };

  const ViewInTimeline: ActionItem = {
    title: $t('view_in_timeline'),
    icon: mdiImageSearch,
    $if: () => isOwner && asset.visibility !== AssetVisibility.Locked && !asset.isArchived && !asset.isTrashed,
    onAction: () => goto(Route.photos({ at: asset.stackPrimaryAssetId ?? asset.id })),
  };

  const ViewSimilar: ActionItem = {
    title: $t('view_similar_photos'),
    icon: mdiCompare,
    $if: () =>
      asset.visibility !== AssetVisibility.Locked && !asset.isArchived && !asset.isTrashed && smartSearchEnabled,
    onAction: () => goto(Route.search({ queryAssetId: asset.stackPrimaryAssetId ?? asset.id })),
  };

  const RefreshFacesJob: ActionItem = {
    title: $t('refresh_faces'),
    icon: mdiHeadSyncOutline,
    onAction: () => handleRunAssetJob({ name: AssetJobName.RefreshFaces, assetIds: [asset.id] }),
  };

  const RefreshMetadataJob: ActionItem = {
    title: $t('refresh_metadata'),
    icon: mdiDatabaseRefreshOutline,
    onAction: () => handleRunAssetJob({ name: AssetJobName.RefreshMetadata, assetIds: [asset.id] }),
  };

  const RegenerateThumbnailJob: ActionItem = {
    title: $t('refresh_thumbnails'),
    icon: mdiImageRefreshOutline,
    onAction: () => handleRunAssetJob({ name: AssetJobName.RegenerateThumbnail, assetIds: [asset.id] }),
  };

  const TranscodeVideoJob: ActionItem = {
    title: $t('refresh_encoded_videos'),
    icon: mdiCogRefreshOutline,
    onAction: () => handleRunAssetJob({ name: AssetJobName.TranscodeVideo, assetIds: [asset.id] }),
    $if: () => asset.type === AssetTypeEnum.Video,
  };

  return {
    Share,
    Download,
    DownloadOriginal,
    SharedLinkDownload,
    SharedLinkDownloadOriginal,
    Offline,
    Info,
    Favorite,
    Unfavorite,
    PlayMotionPhoto,
    StopMotionPhoto,
    PlaySlideshow,
    AddToAlbum,
    ZoomIn,
    ZoomOut,
    Copy,
    Tag,
    TagPeople,
    Edit,
    SetProfilePicture,
    ViewInTimeline,
    ViewSimilar,
    RefreshFacesJob,
    RefreshMetadataJob,
    RegenerateThumbnailJob,
    TranscodeVideoJob,
  };
};

export const handleDownloadAsset = async (
  asset: AssetResponseDto,
  { edited, asGalleryPhoto = false }: { edited: boolean; asGalleryPhoto?: boolean },
) => {
  const $t = await getFormatter();

  const galleryFilename = asGalleryPhoto
    ? `${asset.originalFileName.replace(/\.[^.]+$/u, '') || asset.originalFileName}.jpg`
    : asset.originalFileName;

  const assets = [
    {
      filename: galleryFilename,
      id: asset.id,
      cacheKey: asset.thumbhash,
      asGalleryPhoto,
    },
  ];

  const isAndroidMotionVideo = (asset: AssetResponseDto) => {
    return asset.originalPath.includes('encoded-video');
  };

  if (asset.livePhotoVideoId) {
    const motionAsset = await getAssetInfo({ ...authManager.params, id: asset.livePhotoVideoId });
    if (
      !isAndroidMotionVideo(motionAsset) ||
      (authManager.authenticated && authManager.preferences.download.includeEmbeddedVideos)
    ) {
      const motionFilename = motionAsset.originalFileName;
      const lastDotIndex = motionFilename.lastIndexOf('.');
      const motionDownloadFilename =
        lastDotIndex > 0
          ? `${motionFilename.slice(0, lastDotIndex)}-motion${motionFilename.slice(lastDotIndex)}`
          : `${motionFilename}-motion`;
      assets.push({
        filename: motionDownloadFilename,
        id: asset.livePhotoVideoId,
        cacheKey: motionAsset.thumbhash,
        asGalleryPhoto: false,
      });
    }
  }

  for (const [i, { filename, id, cacheKey, asGalleryPhoto: galleryPhoto }] of assets.entries()) {
    if (i !== 0) {
      // play nice with Safari
      await sleep(500);
    }

    // JPG chip: use the same Preview the viewer shows (Fullsize RAW conversions are often much darker).
    // Force unenhanced so we don't pull a broken/mismatched auto-enhanced companion.
    const sharedLink = getSharedLink();
    const preferUnenhanced = get(sharedLink ? preferUnenhancedSharedThumbnails : preferUnenhancedThumbnails);
    const mediaUrl = getAssetMediaUrl({
      id,
      size: galleryPhoto ? AssetMediaSize.Preview : AssetMediaSize.Original,
      edited: galleryPhoto ? true : edited,
      unenhanced: galleryPhoto ? true : preferUnenhanced,
      cacheKey,
    });

    try {
      const useShareSheet = isMobileDownloadClient() && isGalleryShareableFilename(filename);
      toastManager.primary(
        useShareSheet ? $t('saving_to_photos') : $t('downloading_asset_filename', { values: { filename } }),
      );

      const { data, status } = await downloadRequest({
        method: 'GET',
        url: mediaUrl,
      });

      if (status < 200 || status >= 300 || !(data instanceof Blob) || data.size === 0) {
        throw new Error($t('errors.error_downloading', { values: { filename } }));
      }

      // Phone Photos often shows WebP / wide-gamut files renamed to .jpg as a gray frame.
      // Re-encode the on-screen preview to a plain sRGB JPEG before saving.
      const blob = galleryPhoto ? await normalizeImageBlobToJpeg(data) : data;

      await shareOrDownloadBlob(blob, filename);
    } catch (error) {
      handleError(error, $t('errors.error_downloading', { values: { filename } }));
    }
  }
};

export const handleDownloadRenderedEdits = async (
  asset: AssetResponseDto,
  edits: AssetEditsCreateDto['edits'],
  hasLocalChanges: boolean,
) => {
  const $t = await getFormatter();
  const stem = asset.originalFileName.replace(/\.[^.]+$/u, '');
  const filename = `${stem}-edited.jpg`;
  const sharedLink = getSharedLink();
  const shouldRender = edits.length > 0 && (hasLocalChanges || !!sharedLink);

  if (!shouldRender) {
    await handleDownloadAsset(asset, { edited: edits.length > 0 || asset.isEdited });
    return;
  }

  try {
    toastManager.primary(
      isMobileDownloadClient()
        ? $t('saving_to_photos')
        : $t('downloading_asset_filename', { values: { filename } }),
    );

    // Use XHR blob download (same as archive downloads). The SDK's oazapfts.ok()
    // returns the Blob directly, which previously broke `{ data }` destructuring.
    const queryParams = asQueryString(authManager.params);
    const { data, status } = await downloadRequest({
      method: 'POST',
      url: `${getBaseUrl()}/assets/${asset.id}/edits/render${queryParams ? `?${queryParams}` : ''}`,
      data: { edits },
    });

    if (status < 200 || status >= 300 || !(data instanceof Blob) || data.size === 0) {
      throw new Error($t('errors.error_downloading', { values: { filename } }));
    }

    // Force a JPEG blob type so browsers treat it as a downloadable image.
    const blob =
      data.type && data.type.startsWith('image/')
        ? data
        : new Blob([await data.arrayBuffer()], { type: 'image/jpeg' });

    await shareOrDownloadBlob(blob, filename);
  } catch (error) {
    handleError(error, $t('errors.error_downloading', { values: { filename } }));
    throw error;
  }
};

const handleFavorite = async (asset: AssetResponseDto) => {
  const $t = await getFormatter();

  try {
    const response = await updateAsset({ id: asset.id, updateAssetDto: { isFavorite: true } });
    toastManager.primary($t('added_to_favorites'));
    eventManager.emit('AssetUpdate', response);
  } catch (error) {
    handleError(error, $t('errors.unable_to_add_remove_favorites', { values: { favorite: asset.isFavorite } }));
  }
};

const handleUnfavorite = async (asset: AssetResponseDto) => {
  const $t = await getFormatter();

  try {
    const response = await updateAsset({ id: asset.id, updateAssetDto: { isFavorite: false } });
    toastManager.primary($t('removed_from_favorites'));
    eventManager.emit('AssetUpdate', response);
  } catch (error) {
    handleError(error, $t('errors.unable_to_add_remove_favorites', { values: { favorite: asset.isFavorite } }));
  }
};

const getAssetJobMessage = ($t: MessageFormatter, job: AssetJobName) => {
  const messages: Record<AssetJobName, string> = {
    [AssetJobName.RefreshFaces]: $t('refreshing_faces'),
    [AssetJobName.RefreshMetadata]: $t('refreshing_metadata'),
    [AssetJobName.RegenerateThumbnail]: $t('regenerating_thumbnails'),
    [AssetJobName.TranscodeVideo]: $t('refreshing_encoded_video'),
  };

  return messages[job];
};

const handleRunAssetJob = async (dto: AssetJobsDto) => {
  const $t = await getFormatter();

  try {
    await runAssetJobs({ assetJobsDto: dto });
    toastManager.primary(getAssetJobMessage($t, dto.name));
  } catch (error) {
    handleError(error, $t('errors.unable_to_submit_job'));
  }
};
