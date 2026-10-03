import { getBaseUrl, type AlbumResponseDto } from '@immich/sdk';

export type AlbumSelectionShare =
  | { mode: 'public'; allowDownload?: boolean }
  | { mode: 'user'; userId: string; role?: 'viewer' | 'editor' };

export type CreateAlbumFromSelection = {
  albumName: string;
  albumIds?: string[];
  personIds?: string[];
  share: AlbumSelectionShare;
};

export type AlbumFromSelectionResponse = {
  album: AlbumResponseDto;
  sharedLinkKey: string | null;
  sharedLinkSlug: string | null;
};

export const createAlbumFromSelection = async (dto: CreateAlbumFromSelection): Promise<AlbumFromSelectionResponse> => {
  const response = await fetch(`${getBaseUrl()}/albums/from-selection`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    let message = 'Unable to create album';
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep the fallback message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
};
