import { redirect } from '@sveltejs/kit';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { serverConfigManager } from '$lib/managers/server-config-manager.svelte';
import { Route } from '$lib/route';
import { getFormatter } from '$lib/utils/i18n';
import { init } from '$lib/utils/server';
import type { PageLoad } from './$types';

export const ssr = false;
export const csr = true;

export const load = (async ({ fetch }) => {
  try {
    await init(fetch);

    if (serverConfigManager.value.maintenanceMode) {
      redirect(307, Route.maintenanceMode());
    }

    await authManager.load();
    if (authManager.authenticated) {
      redirect(307, Route.photos());
    }

    if (!serverConfigManager.value.isInitialized) {
      // First-time setup — admin still needs to register.
      return {
        showSetup: true,
        meta: {
          title: 'Welcome',
          description: "Michael's Gallery",
        },
      };
    }

    const $t = await getFormatter();
    return {
      showSetup: false,
      meta: {
        title: $t('featured_gallery_title'),
        description: $t('featured_gallery_description'),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (redirectError: any) {
    if (redirectError?.status === 307) {
      throw redirectError;
    }
  }

  const $t = await getFormatter();
  return {
    showSetup: false,
    meta: {
      title: $t('featured_gallery_title'),
      description: $t('featured_gallery_description'),
    },
  };
}) satisfies PageLoad;
