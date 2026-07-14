import { sharedLinkUploadLogin, type SharedLinkResponseDto } from '@immich/sdk';
import { modalManager } from '@immich/ui';
import { authManager } from '$lib/managers/auth-manager.svelte';
import SharedLinkContributorModal, {
  type SharedLinkContributorInfo,
} from '$lib/modals/SharedLinkContributorModal.svelte';
import SharedLinkUploadPasswordModal from '$lib/modals/SharedLinkUploadPasswordModal.svelte';
import { handleError } from '$lib/utils/handle-error';
import { getFormatter } from '$lib/utils/i18n';
import { browser } from '$app/environment';

export const GUEST_CONTRIBUTOR_METADATA_KEY = 'guest-contributor';

export const canUploadToSharedLink = (
  sharedLink: Pick<SharedLinkResponseDto, 'allowUpload' | 'uploadExpiresAt'>,
): boolean => {
  if (!sharedLink.allowUpload) {
    return false;
  }

  if (sharedLink.uploadExpiresAt && new Date(sharedLink.uploadExpiresAt) <= new Date()) {
    return false;
  }

  return true;
};

const unlockedUploadLinks = new Set<string>();

export const isSharedLinkUploadUnlocked = (sharedLink: Pick<SharedLinkResponseDto, 'id' | 'hasUploadPassword'>) => {
  return !sharedLink.hasUploadPassword || unlockedUploadLinks.has(sharedLink.id);
};

const contributorStorageKey = (sharedLinkId: string) => `immich-shared-link-contributor:${sharedLinkId}`;

export const getRememberedContributor = (sharedLinkId: string): SharedLinkContributorInfo | null => {
  if (!browser) {
    return null;
  }

  try {
    const raw = localStorage.getItem(contributorStorageKey(sharedLinkId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SharedLinkContributorInfo>;
    if (typeof parsed.name === 'string' && typeof parsed.email === 'string' && parsed.name && parsed.email) {
      return { name: parsed.name, email: parsed.email };
    }
  } catch {
    // Ignore invalid storage.
  }

  return null;
};

export const rememberContributor = (sharedLinkId: string, info: SharedLinkContributorInfo) => {
  if (!browser) {
    return;
  }

  localStorage.setItem(contributorStorageKey(sharedLinkId), JSON.stringify(info));
};

/**
 * Ensure the guest may upload. Shows the upload button's password prompt when needed.
 * Returns false if the user cancels or the password is wrong.
 */
export const ensureSharedLinkUploadAccess = async (
  sharedLink: Pick<SharedLinkResponseDto, 'id' | 'allowUpload' | 'uploadExpiresAt' | 'hasUploadPassword'>,
): Promise<boolean> => {
  if (!canUploadToSharedLink(sharedLink)) {
    return false;
  }

  if (isSharedLinkUploadUnlocked(sharedLink)) {
    return true;
  }

  const password = await modalManager.show(SharedLinkUploadPasswordModal, {});
  if (!password) {
    return false;
  }

  const $t = await getFormatter();
  try {
    await sharedLinkUploadLogin({
      ...authManager.params,
      sharedLinkLoginDto: { password },
    });
    unlockedUploadLinks.add(sharedLink.id);
    return true;
  } catch (error) {
    handleError(error, $t('upload_password_required'));
    return false;
  }
};

/**
 * Collect guest name/email once per browser for this shared link.
 * Returns null if the guest cancels.
 */
export const ensureSharedLinkContributorInfo = async (
  sharedLink: Pick<SharedLinkResponseDto, 'id'>,
): Promise<SharedLinkContributorInfo | null> => {
  const remembered = getRememberedContributor(sharedLink.id);
  if (remembered) {
    return remembered;
  }

  const info = await modalManager.show(SharedLinkContributorModal, {
    initialName: '',
    initialEmail: '',
  });

  if (!info) {
    return null;
  }

  rememberContributor(sharedLink.id, info);
  return info;
};
