import { browser } from '$app/environment';
import type { PoseIdea, PoseOverride, PosingLibraryState, PosingSeed } from '$lib/posing/types';
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';

const STORAGE_KEY = 'michaels-posing-library';

const emptyState = (): PosingLibraryState => ({
  favorites: [],
  customPoses: [],
  overrides: {},
});

export const posingLibraryStore = persisted<PosingLibraryState>(STORAGE_KEY, emptyState(), {
  serializer: {
    parse: (text) => ({ ...emptyState(), ...JSON.parse(text || '{}') }),
    stringify: JSON.stringify,
  },
});

let seedPromise: Promise<PosingSeed> | null = null;

export const loadPosingSeed = async (): Promise<PosingSeed> => {
  if (!browser) {
    return {
      version: 1,
      taxonomies: { people: ['1', '2', 'couple'], background: [], object: [], mood: [], poseType: [] },
      poses: [],
    };
  }

  seedPromise ??= fetch(`${import.meta.env.BASE_URL}posing-seed.json`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load posing seed (${response.status})`);
      }
      return (await response.json()) as PosingSeed;
    })
    .catch((error) => {
      seedPromise = null;
      throw error;
    });

  return seedPromise;
};

export const getAllPoses = (seedPoses: PoseIdea[], state: PosingLibraryState = get(posingLibraryStore)): PoseIdea[] => [
  ...seedPoses,
  ...state.customPoses,
];

export const toggleFavorite = (poseId: string) => {
  posingLibraryStore.update((state) => {
    const favorites = state.favorites.includes(poseId)
      ? state.favorites.filter((id) => id !== poseId)
      : [...state.favorites, poseId];
    return { ...state, favorites };
  });
};

export const saveOverride = (poseId: string, override: PoseOverride) => {
  posingLibraryStore.update((state) => ({
    ...state,
    overrides: {
      ...state.overrides,
      [poseId]: {
        notes: override.notes?.trim() || undefined,
        sampleBackground: override.sampleBackground?.trim() || undefined,
        sampleObject: override.sampleObject?.trim() || undefined,
        sampleExample: override.sampleExample?.trim() || undefined,
        thumbnailUrl: override.thumbnailUrl?.trim() || undefined,
        searchPrompt: override.searchPrompt?.trim() || undefined,
        assetId: override.assetId?.trim() || undefined,
        howTo: override.howTo?.trim() || undefined,
        title: override.title?.trim() || undefined,
      },
    },
  }));
};

export const upsertCustomPose = (pose: PoseIdea) => {
  posingLibraryStore.update((state) => {
    const without = state.customPoses.filter((item) => item.id !== pose.id);
    return {
      ...state,
      customPoses: [...without, { ...pose, custom: true }],
    };
  });
};

export const deleteCustomPose = (poseId: string) => {
  posingLibraryStore.update((state) => ({
    ...state,
    customPoses: state.customPoses.filter((pose) => pose.id !== poseId),
    favorites: state.favorites.filter((id) => id !== poseId),
    overrides: Object.fromEntries(Object.entries(state.overrides).filter(([id]) => id !== poseId)),
  }));
};

export const createCustomPoseId = () => `custom-${crypto.randomUUID()}`;
