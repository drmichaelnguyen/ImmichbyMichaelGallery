import type { GalleryPrivilegesDto } from '@immich/sdk';
import { authManager } from '$lib/managers/auth-manager.svelte';

export type GalleryPrivileges = GalleryPrivilegesDto;

export const fullPrivileges = (): GalleryPrivileges => ({
  viewFeatured: true,
  download: true,
  upload: true,
  edit: true,
  delete: true,
});

export const newUserPrivileges = (): GalleryPrivileges => ({
  viewFeatured: true,
  download: true,
  upload: false,
  edit: false,
  delete: false,
});

export const allows = (privilege: keyof GalleryPrivileges) => {
  if (!authManager.authenticated || authManager.user.isAdmin) {
    return true;
  }

  return authManager.user.privileges?.[privilege] !== false;
};
