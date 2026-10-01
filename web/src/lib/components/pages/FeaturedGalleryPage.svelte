<script lang="ts">
  import GalleryViewer from '$lib/components/shared-components/gallery-viewer/GalleryViewer.svelte';
  import GalleryLogo from '$lib/components/shared-components/GalleryLogo.svelte';
  import ControlAppBar from '$lib/components/shared-components/ControlAppBar.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import type { Viewport } from '$lib/managers/timeline-manager/types';
  import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
  import { serverConfigManager } from '$lib/managers/server-config-manager.svelte';
  import { Route } from '$lib/route';
  import { getFeaturedAssets } from '$lib/services/featured.service';
  import { publicFeaturedGallery } from '$lib/stores/featured-gallery.store';
  import { handleError } from '$lib/utils/handle-error';
  import type { AssetResponseDto } from '@immich/sdk';
  import { Button, Heading, Text } from '@immich/ui';
  import { onDestroy, onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  const showSignUp = $derived(serverConfigManager.value.isInitialized && featureFlagsManager.value.passwordLogin);

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

<header class="fixed inset-s-0 top-0 z-50 w-full">
  <ControlAppBar>
    {#snippet leading()}
      <a data-sveltekit-preload-data="hover" class="ms-4" href="/">
        <GalleryLogo variant="inline" class="min-w-10 max-md:text-sm" />
      </a>
    {/snippet}

    {#snippet trailing()}
      <div class="me-2 flex items-center gap-2">
        <Button href={Route.login()} size="small" shape="round" variant="ghost" color="secondary">
          {$t('login')}
        </Button>
        {#if showSignUp}
          <Button href={Route.register()} size="small" shape="round" color="primary">
            {$t('sign_up')}
          </Button>
        {/if}
      </div>
    {/snippet}
  </ControlAppBar>
</header>

<main class="isolate mx-4 mt-24 mb-16" bind:clientHeight={viewport.height} bind:clientWidth={viewport.width}>
  <div class="mb-8 max-w-2xl">
    <Heading size="large" color="primary" tag="h1">{$t('featured_gallery_title')}</Heading>
    <Text class="mt-2 text-gray-600 dark:text-gray-300">{$t('featured_gallery_description')}</Text>
  </div>

  {#if loading}
    <p class="text-sm text-gray-500">{$t('loading')}</p>
  {:else if assets.length === 0}
    <div class="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
      <Heading size="small" tag="h2">{$t('featured_gallery_empty_title')}</Heading>
      <Text class="mt-2 text-gray-600 dark:text-gray-400">{$t('featured_gallery_empty_description')}</Text>
    </div>
  {:else}
    <GalleryViewer {assets} assetInteraction={assetMultiSelectManager} {viewport} disableAssetSelect allowDeletion={false} />
  {/if}
</main>
