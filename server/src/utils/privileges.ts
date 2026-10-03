import { UserMetadataKey } from 'src/enum';
import { GalleryPrivileges, UserMetadataItem } from 'src/types';

export const defaultGalleryPrivileges = (): GalleryPrivileges => ({
  viewFeatured: true,
  download: true,
  upload: true,
  edit: true,
  delete: true,
});

export const getPrivileges = (metadata: UserMetadataItem[]): GalleryPrivileges => {
  const stored = metadata.find((item) => item.key === UserMetadataKey.Privileges)?.value as
    | Partial<GalleryPrivileges>
    | undefined;

  return {
    ...defaultGalleryPrivileges(),
    ...stored,
  };
};
