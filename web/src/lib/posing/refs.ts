import { getAssetMediaUrl } from '$lib/utils';
import type { PoseIdea, PoseOverride } from '$lib/posing/types';
import { AssetMediaSize } from '@immich/sdk';

export type PoseVisualRefs = {
  thumbnailUrl?: string;
  searchPrompt: string;
  pinterestUrl: string;
  googleImagesUrl: string;
  assetId?: string;
};

export const mergePoseWithOverride = (pose: PoseIdea, override?: PoseOverride): PoseIdea => ({
  ...pose,
  title: override?.title?.trim() || pose.title,
  howTo: override?.howTo?.trim() || pose.howTo,
  thumbnailUrl: override?.thumbnailUrl?.trim() || pose.thumbnailUrl,
  assetId: override?.assetId?.trim() || pose.assetId,
  searchPrompt: override?.searchPrompt?.trim() || pose.searchPrompt,
});

export const buildSearchPrompt = (pose: PoseIdea, override?: PoseOverride) => {
  const merged = mergePoseWithOverride(pose, override);
  const fromOverride = override?.searchPrompt?.trim();
  if (fromOverride) {
    return fromOverride;
  }

  if (merged.searchPrompt?.trim()) {
    return merged.searchPrompt.trim();
  }

  if (pose.freeImageSearch?.trim()) {
    return pose.freeImageSearch.trim();
  }

  const parts = [
    merged.people === 'couple' ? 'couple' : merged.people === '2' ? 'two people' : 'portrait',
    merged.title,
    ...merged.background.slice(0, 2).map((tag) => tag.replaceAll('-', ' ')),
    ...merged.object.filter((tag) => tag !== 'none').slice(0, 2).map((tag) => tag.replaceAll('-', ' ')),
    'photography pose',
  ];

  return parts.join(' ');
};

const resolveThumbnailUrl = (url?: string) => {
  const value = url?.trim();
  if (!value) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
    return value;
  }

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${value.replace(/^\//, '')}`;
};

export const getPoseVisualRefs = (pose: PoseIdea, override?: PoseOverride): PoseVisualRefs => {
  const merged = mergePoseWithOverride(pose, override);
  const searchPrompt = buildSearchPrompt(pose, override);
  const encoded = encodeURIComponent(searchPrompt);

  const thumbnailUrl = merged.assetId
    ? getAssetMediaUrl({ id: merged.assetId, size: AssetMediaSize.Thumbnail })
    : resolveThumbnailUrl(merged.thumbnailUrl);

  return {
    thumbnailUrl,
    searchPrompt,
    assetId: merged.assetId,
    pinterestUrl: `https://www.pinterest.com/search/pins/?q=${encoded}`,
    googleImagesUrl: `https://www.google.com/search?tbm=isch&q=${encoded}`,
  };
};
