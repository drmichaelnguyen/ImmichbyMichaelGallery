import { writable } from 'svelte/store';

/** When true, media URLs resolve to public `/featured/...` endpoints (no auth). */
export const publicFeaturedGallery = writable(false);
