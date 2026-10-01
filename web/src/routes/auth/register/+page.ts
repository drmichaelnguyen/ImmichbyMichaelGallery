import { redirect } from '@sveltejs/kit';
import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
import { serverConfigManager } from '$lib/managers/server-config-manager.svelte';
import { Route } from '$lib/route';
import { getFormatter } from '$lib/utils/i18n';
import type { PageLoad } from './$types';

export const load = (async ({ parent }) => {
  await parent();

  const isInitialized = serverConfigManager.value.isInitialized;
  if (isInitialized && !featureFlagsManager.value.passwordLogin) {
    redirect(307, Route.login());
  }

  const $t = await getFormatter();

  return {
    isInitialized,
    meta: {
      title: isInitialized ? $t('sign_up') : $t('admin.registration'),
    },
  };
}) satisfies PageLoad;
