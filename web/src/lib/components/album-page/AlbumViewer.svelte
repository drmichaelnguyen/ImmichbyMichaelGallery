<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import AlbumMap from '$lib/components/album-page/AlbumMap.svelte';
  import SharedLinkFilters from '$lib/components/share-page/SharedLinkFilters.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { handleDownloadAlbum } from '$lib/services/album.service';
  import { getGlobalActions } from '$lib/services/app.service';
  import { dragAndDropFilesStore } from '$lib/stores/drag-and-drop-files.store';
  import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';
  import { preferUnenhancedSharedThumbnails } from '$lib/stores/preferences.store';
  import { SlideshowNavigation, SlideshowState, slideshowStore } from '$lib/stores/slideshow.store';
  import { handlePromiseError } from '$lib/utils';
  import { fileUploadHandler, openFileUploadDialog } from '$lib/utils/file-uploader';
  import type { SharedLinkFilter } from '$lib/types';
  import {
    locationOptionsFromMapMarkers,
    toTimelineFilterOptions,
  } from '$lib/utils/shared-link-filters';
  import { canUploadToSharedLink, ensureSharedLinkContributorInfo, ensureSharedLinkUploadAccess } from '$lib/utils/shared-link-upload';
  import { getAlbumMapMarkers, type AlbumResponseDto, type MapMarkerResponseDto, type SharedLinkResponseDto } from '@immich/sdk';
  import { ActionButton, IconButton } from '@immich/ui';
  import GalleryLogo from '$lib/components/shared-components/GalleryLogo.svelte';
  import JpgRawDownloadButtons from '$lib/components/shared-components/JpgRawDownloadButtons.svelte';
  import { mdiFileImagePlusOutline, mdiPresentationPlay } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import ControlAppBar from '../shared-components/ControlAppBar.svelte';
  import ThemeButton from '../shared-components/ThemeButton.svelte';
  import AlbumSummary from './AlbumSummary.svelte';

  interface Props {
    sharedLink: SharedLinkResponseDto;
  }

  let { sharedLink }: Props = $props();

  const album = sharedLink.album as AlbumResponseDto;
  const canUpload = $derived(canUploadToSharedLink(sharedLink));

  let filters = $state<SharedLinkFilter>({});
  let mapMarkers = $state<MapMarkerResponseDto[]>([]);
  const locationOptions = $derived(locationOptionsFromMapMarkers(mapMarkers));

  let { slideshowState, slideshowNavigation } = slideshowStore;

  const options = $derived({
    albumId: album.id,
    order: album.order,
    ...toTimelineFilterOptions(filters),
  });
  let timelineManager = $state<TimelineManager>() as TimelineManager;

  onMount(async () => {
    if (!sharedLink.showMetadata) {
      return;
    }

    try {
      mapMarkers = await getAlbumMapMarkers({ ...authManager.params, id: album.id });
    } catch {
      mapMarkers = [];
    }
  });

  const startUpload = async (files?: File[]) => {
    if (!(await ensureSharedLinkUploadAccess(sharedLink))) {
      return;
    }

    const contributor = await ensureSharedLinkContributorInfo(sharedLink);
    if (!contributor) {
      return;
    }

    if (files?.length) {
      await fileUploadHandler({ files, albumId: album.id, contributor });
      return;
    }

    await openFileUploadDialog({ albumId: album.id, contributor });
  };

  dragAndDropFilesStore.subscribe((value) => {
    if (!(value.isDragging && value.files.length > 0)) {
      return;
    }

    if (!canUploadToSharedLink(sharedLink)) {
      dragAndDropFilesStore.set({ isDragging: false, files: [] });
      return;
    }

    handlePromiseError(startUpload(value.files));
    dragAndDropFilesStore.set({ isDragging: false, files: [] });
  });

  const handleStartSlideshow = async () => {
    const asset =
      $slideshowNavigation === SlideshowNavigation.Shuffle
        ? await timelineManager.getRandomAsset()
        : timelineManager.months[0]?.timelineDays[0]?.viewerAssets[0]?.asset;
    if (asset) {
      handlePromiseError(
        assetViewerManager.setAssetId(asset.id).then(() => ($slideshowState = SlideshowState.PlaySlideshow)),
      );
    }
  };

  const { Cast } = $derived(getGlobalActions($t));
</script>

<svelte:document
  use:shortcut={{
    shortcut: { key: 'Escape' },
    onShortcut: () => {
      if (!assetViewerManager.isViewing && assetMultiSelectManager.selectionActive) {
        assetMultiSelectManager.clear();
      }
    },
  }}
/>

<main class="relative h-dvh overflow-hidden px-2 pt-(--navbar-height) max-md:pt-(--navbar-height-md) md:px-6">
  <Timeline enableRouting={true} {album} bind:timelineManager {options} assetInteraction={assetMultiSelectManager}>
    <section class="px-2 pt-8 md:px-0 md:pt-24">
      <!-- ALBUM TITLE -->
      <h1 class="text-2xl text-primary transition-all outline-none md:text-4xl lg:text-6xl">
        {album.albumName}
      </h1>

      {#if album.assetCount > 0}
        <AlbumSummary {album} />
      {/if}

      <!-- ALBUM DESCRIPTION -->
      {#if album.description}
        <p
          class="mt-6 mb-12 w-full pb-2 text-start text-base font-medium whitespace-pre-line text-black dark:text-gray-300"
        >
          {album.description}
        </p>
      {/if}

      {#if album.assetCount > 0}
        <SharedLinkFilters
          bind:filters
          showLocation={sharedLink.showMetadata}
          {locationOptions}
          {mapMarkers}
        />
      {/if}
    </section>
  </Timeline>
</main>

<header>
  {#if assetMultiSelectManager.selectionActive}
    <AssetSelectControlBar>
      <SelectAllAssets {timelineManager} assetInteraction={assetMultiSelectManager} />
      {#if sharedLink.allowDownload}
        <DownloadAction filename={album.albumName} />
      {/if}
    </AssetSelectControlBar>
  {:else}
    <ControlAppBar>
      {#snippet leading()}
        <a data-sveltekit-preload-data="hover" class="ms-4" href="/">
          <GalleryLogo variant="inline" class="min-w-10 max-md:text-sm" />
        </a>
      {/snippet}

      {#snippet trailing()}
        <ActionButton action={Cast} />

        {#if canUpload}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('add_photos')}
            onclick={() => handlePromiseError(startUpload())}
            icon={mdiFileImagePlusOutline}
          />
        {/if}

        {#if album.assetCount > 0 && sharedLink.allowDownload}
          <IconButton
            shape="round"
            variant="ghost"
            color="secondary"
            aria-label={$t('slideshow')}
            onclick={handleStartSlideshow}
            icon={mdiPresentationPlay}
          />
          <JpgRawDownloadButtons
            onDownloadJpg={() => handleDownloadAlbum(album, 'jpg')}
            onDownloadRaw={() => handleDownloadAlbum(album, 'raw')}
          />
        {/if}
        {#if sharedLink.showMetadata && featureFlagsManager.value.map}
          <AlbumMap {album} />
        {/if}
        <ThemeButton />
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-gray-200/70 dark:hover:bg-gray-700/60"
          aria-label={$t('toggle_shared_standard_previews')}
          title={$t('toggle_shared_standard_previews')}
          onclick={() => ($preferUnenhancedSharedThumbnails = !$preferUnenhancedSharedThumbnails)}
        >
          {$preferUnenhancedSharedThumbnails ? $t('view_mode_standard') : $t('view_mode_enhanced')}
        </button>
      {/snippet}
    </ControlAppBar>
  {/if}
</header>
