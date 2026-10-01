export type PeopleCount = '1' | '2' | 'couple';

export type PoseIdea = {
  id: string;
  title: string;
  people: PeopleCount;
  background: string[];
  object: string[];
  mood: string[];
  poseType: string[];
  howTo: string;
  cameraTip: string;
  /** Optional remote image URL shown as a thumbnail (not stored in the gallery). */
  thumbnailUrl?: string;
  /** Uploaded Immich asset used as the pose preview. */
  assetId?: string;
  /** Search text for Pinterest / Google Images. */
  searchPrompt?: string;
  /** Legacy seed field; used as searchPrompt fallback. */
  freeImageSearch?: string;
  custom?: boolean;
};

export type PoseOverride = {
  notes?: string;
  sampleBackground?: string;
  sampleObject?: string;
  sampleExample?: string;
  thumbnailUrl?: string;
  searchPrompt?: string;
  assetId?: string;
  /** Optional personal rewrite of the how-to text. */
  howTo?: string;
  title?: string;
};

export type PosingLibraryState = {
  favorites: string[];
  customPoses: PoseIdea[];
  overrides: Record<string, PoseOverride>;
};

export type PosingSeed = {
  version: number;
  note?: string;
  taxonomies: {
    people: PeopleCount[];
    background: string[];
    object: string[];
    mood: string[];
    poseType: string[];
  };
  poses: PoseIdea[];
};

export type PoseFilters = {
  query: string;
  people: PeopleCount | 'all';
  background: string;
  object: string;
  favoritesOnly: boolean;
};
