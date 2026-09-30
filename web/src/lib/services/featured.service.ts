import { getBaseUrl, type AssetResponseDto } from '@immich/sdk';

export const getFeaturedAssets = async (): Promise<AssetResponseDto[]> => {
  const response = await fetch(`${getBaseUrl()}/featured/assets`);
  if (!response.ok) {
    throw new Error(`Failed to load featured assets (${response.status})`);
  }
  return response.json();
};

export const getFeaturedAsset = async (id: string): Promise<AssetResponseDto> => {
  const response = await fetch(`${getBaseUrl()}/featured/assets/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load featured asset (${response.status})`);
  }
  return response.json();
};

export const getFeaturedAssetMediaUrl = ({
  id,
  size = 'preview',
  cacheKey,
  edited = true,
}: {
  id: string;
  size?: string;
  cacheKey?: string | null;
  edited?: boolean;
}) => {
  const params = new URLSearchParams();
  if (size) {
    params.set('size', size);
  }
  if (edited) {
    params.set('edited', 'true');
  }
  if (cacheKey) {
    params.set('c', cacheKey);
  }
  const query = params.toString();
  return `${getBaseUrl()}/featured/assets/${id}/thumbnail${query ? `?${query}` : ''}`;
};
