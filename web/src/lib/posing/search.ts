import { mergePoseWithOverride } from '$lib/posing/refs';
import type { PoseFilters, PoseIdea, PoseOverride } from '$lib/posing/types';

const normalize = (value: string) => value.trim().toLowerCase().replaceAll('-', ' ');

const haystackFor = (pose: PoseIdea, override?: PoseOverride) => {
  const merged = mergePoseWithOverride(pose, override);
  return [
    merged.title,
    merged.howTo,
    pose.cameraTip,
    pose.people,
    ...pose.background,
    ...pose.object,
    ...pose.mood,
    ...pose.poseType,
    pose.freeImageSearch ?? '',
    merged.searchPrompt ?? '',
    merged.thumbnailUrl ?? '',
    merged.assetId ?? '',
    override?.notes ?? '',
    override?.sampleBackground ?? '',
    override?.sampleObject ?? '',
    override?.sampleExample ?? '',
  ]
    .map(normalize)
    .join(' ');
};

export const filterPoses = (
  poses: PoseIdea[],
  filters: PoseFilters,
  overrides: Record<string, PoseOverride>,
  favorites: Set<string>,
): PoseIdea[] => {
  const terms = normalize(filters.query)
    .split(/\s+/)
    .filter(Boolean);

  return poses.filter((pose) => {
    if (filters.favoritesOnly && !favorites.has(pose.id)) {
      return false;
    }

    if (filters.people !== 'all' && pose.people !== filters.people) {
      return false;
    }

    if (filters.background && !pose.background.includes(filters.background)) {
      return false;
    }

    if (filters.object && !pose.object.includes(filters.object)) {
      return false;
    }

    if (terms.length === 0) {
      return true;
    }

    const haystack = haystackFor(pose, overrides[pose.id]);
    return terms.every((term) => haystack.includes(term));
  });
};

export const labelTag = (tag: string) => tag.replaceAll('-', ' ');
