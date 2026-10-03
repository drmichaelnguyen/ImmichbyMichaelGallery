import { redirect } from '@sveltejs/kit';
import { Route } from '$lib/route';
import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { allows } from '$lib/utils/privileges';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticate(url);
  if (!allows('viewFeatured')) {
    redirect(307, Route.photos());
  }

  const $t = await getFormatter();
  return {
    meta: {
      title: $t('featured_gallery_title'),
    },
  };
}) satisfies PageLoad;
