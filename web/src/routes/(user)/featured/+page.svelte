<script lang="ts">
  import GalleryViewer from '$lib/components/shared-components/gallery-viewer/GalleryViewer.svelte';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import type { Viewport } from '$lib/managers/timeline-manager/types';
  import { getFeaturedAssets } from '$lib/services/featured.service';
  import { publicFeaturedGallery } from '$lib/stores/featured-gallery.store';
  import { handleError } from '$lib/utils/handle-error';
  import type { AssetResponseDto } from '@immich/sdk';
  import { Heading, Text } from '@immich/ui';
  import { onDestroy, onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  type Props = { data: PageData };
  let { data }: Props = $props();

  let assets = $state<AssetResponseDto[]>([]);
  let loading = $state(true);
  const viewport: Viewport = $state({ width: 0, height: 0 });

  onMount(async () => {
    publicFeaturedGallery.set(true);
    try {
      assets = await getFeaturedAssets();
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_featured_photos'));
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    publicFeaturedGallery.set(false);
  });
</script>

<UserPageLayout title={data.meta.title}>
  <div class="mb-6 max-w-2xl">
    <Heading size="large" color="primary" tag="h1">{$t('featured_gallery_title')}</Heading>
    <Text class="mt-2 text-gray-600 dark:text-gray-300">{$t('featured_gallery_description')}</Text>
  </div>

  <div bind:clientHeight={viewport.height} bind:clientWidth={viewport.width}>
    {#if loading}
      <p class="text-sm text-gray-500">{$t('loading')}</p>
    {:else if assets.length === 0}
      <Text>{$t('featured_gallery_empty_description')}</Text>
    {:else}
      <GalleryViewer {assets} assetInteraction={assetMultiSelectManager} {viewport} disableAssetSelect allowDeletion={false} />
    {/if}
  </div>
</UserPageLayout>
