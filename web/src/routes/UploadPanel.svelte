<script lang="ts">
  import { locale } from '$lib/stores/preferences.store';
  import { uploadAssetsStore } from '$lib/stores/upload';
  import { UploadState } from '$lib/types';
  import { uploadExecutionQueue } from '$lib/utils/file-uploader';
  import { acquireWakeLock, releaseWakeLock } from '$lib/utils/wakelock.svelte';
  import { Icon, IconButton, toastManager } from '@immich/ui';
  import { mdiCancel, mdiCheckCircle, mdiClose, mdiCloudUploadOutline, mdiCog, mdiWindowMinimize } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { quartInOut } from 'svelte/easing';
  import { fade, scale } from 'svelte/transition';
  import UploadAssetPreview from './UploadAssetPreview.svelte';

  let showDetail = $state(true);
  let showOptions = $state(false);
  let concurrency = $state(uploadExecutionQueue.concurrency);
  let hasAnnouncedCompletion = $state(false);

  let { stats, isDismissible, isUploading, remainingUploads } = uploadAssetsStore;

  let hasRemaining = $derived($remainingUploads > 0);
  const overallProgress = $derived(
    $stats.total === 0 ? 0 : Math.round((($stats.total - $remainingUploads) / $stats.total) * 100),
  );
  const isComplete = $derived($isUploading && $remainingUploads === 0);
  const hasErrors = $derived($stats.errors > 0);

  $effect(() => {
    if ($isUploading) {
      showDetail = true;
      hasAnnouncedCompletion = false;
    }
  });

  $effect(() => {
    if (!isComplete || hasAnnouncedCompletion) {
      return;
    }

    hasAnnouncedCompletion = true;

    if (hasErrors) {
      toastManager.danger($t('upload_errors', { values: { count: $stats.errors } }));
      return;
    }

    if ($stats.success > 0) {
      toastManager.primary($t('upload_success'));
    }

    if ($stats.duplicates > 0) {
      toastManager.warning($t('upload_skipped_duplicates', { values: { count: $stats.duplicates } }));
    }

    if ($stats.errors === 0 && $stats.duplicates === 0) {
      const timeout = setTimeout(() => {
        uploadAssetsStore.reset();
      }, 4000);
      return () => clearTimeout(timeout);
    }
  });

  $effect(() => {
    if (hasRemaining) {
      void acquireWakeLock();
    } else {
      void releaseWakeLock();
    }
  });

  const dismissPanel = () => {
    uploadAssetsStore.reset();
  };
</script>

{#if $isUploading}
  <div
    in:fade={{ duration: 250 }}
    out:fade={{ duration: 250 }}
    class="fixed inset-x-3 bottom-4 z-[100] sm:inset-e-6 sm:inset-s-auto sm:bottom-6 sm:w-96"
  >
    {#if showDetail}
      <div
        in:scale={{ duration: 250, easing: quartInOut }}
        class="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-xl dark:border-subtle dark:bg-immich-dark-gray"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            {#if isComplete}
              <div class="mb-1 flex items-center gap-2">
                <Icon
                  icon={hasErrors ? mdiCancel : mdiCheckCircle}
                  size="20"
                  class={hasErrors ? 'text-danger' : 'text-success'}
                />
                <p class="font-semibold text-primary">
                  {#if hasErrors}
                    {$t('upload_completed_with_errors')}
                  {:else}
                    {$t('upload_completed')}
                  {/if}
                </p>
              </div>
            {:else}
              <p class="font-semibold text-primary">
                {$t('upload_progress', {
                  values: {
                    remaining: $remainingUploads,
                    processed: $stats.total - $remainingUploads,
                    total: $stats.total,
                  },
                })}
              </p>
            {/if}

            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {$t('upload_status_uploaded')}
              <span class="font-medium text-success">{$stats.success.toLocaleString($locale)}</span>
              ·
              {$t('upload_status_errors')}
              <span class="font-medium text-danger">{$stats.errors.toLocaleString($locale)}</span>
              ·
              {$t('upload_status_duplicates')}
              <span class="font-medium text-warning">{$stats.duplicates.toLocaleString($locale)}</span>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            {#if !isComplete}
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                icon={mdiCog}
                size="small"
                onclick={() => (showOptions = !showOptions)}
                aria-label={$t('toggle_settings')}
              />
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                aria-label={$t('minimize')}
                icon={mdiWindowMinimize}
                size="small"
                onclick={() => (showDetail = false)}
              />
            {/if}
            {#if isComplete || $isDismissible}
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                aria-label={$t('close')}
                icon={mdiClose}
                size="small"
                onclick={dismissPanel}
              />
            {/if}
          </div>
        </div>

        <div class="mb-3">
          <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-full rounded-full transition-all duration-200 {hasErrors && isComplete
                ? 'bg-danger'
                : isComplete
                  ? 'bg-success'
                  : 'bg-immich-primary'}"
              style={`width: ${Math.max(overallProgress, isComplete ? 100 : 2)}%`}
            ></div>
          </div>
          <p class="mt-1 text-end text-[11px] text-gray-500 dark:text-gray-400">{overallProgress}%</p>
        </div>

        {#if showOptions && !isComplete}
          <div class="mb-4 max-h-100 immich-scrollbar overflow-y-auto rounded-lg">
            <div class="flex h-6.5 place-items-center gap-1">
              <label class="immich-form-label" for="upload-concurrency">{$t('upload_concurrency')}</label>
            </div>
            <input
              class="immich-form-input w-full"
              aria-labelledby={$t('upload_concurrency')}
              id="upload-concurrency"
              name={$t('upload_concurrency')}
              type="number"
              min="1"
              max="50"
              step="1"
              bind:value={concurrency}
              onchange={() => (uploadExecutionQueue.concurrency = concurrency)}
            />
          </div>
        {/if}

        <div class="flex max-h-[320px] immich-scrollbar flex-col gap-2 overflow-y-auto rounded-lg">
          {#each $uploadAssetsStore as uploadAsset (uploadAsset.id)}
            <UploadAssetPreview {uploadAsset} />
          {/each}
        </div>
      </div>
    {:else}
      <div class="relative ms-auto w-fit rounded-full">
        <button
          type="button"
          in:scale={{ duration: 250, easing: quartInOut }}
          onclick={() => (showDetail = true)}
          class="absolute -inset-s-4 -top-4 flex size-10 place-content-center place-items-center rounded-full bg-primary p-5 text-xs text-light"
        >
          {$remainingUploads.toLocaleString($locale)}
        </button>
        {#if $stats.errors > 0}
          <button
            type="button"
            in:scale={{ duration: 250, easing: quartInOut }}
            onclick={() => (showDetail = true)}
            class="absolute -inset-e-4 -top-4 flex size-10 place-content-center place-items-center rounded-full bg-danger p-5 text-xs text-light"
          >
            {$stats.errors.toLocaleString($locale)}
          </button>
        {/if}
        <button
          type="button"
          in:scale={{ duration: 250, easing: quartInOut }}
          onclick={() => (showDetail = true)}
          class="flex size-16 place-content-center place-items-center rounded-full bg-subtle p-5 text-sm text-primary shadow-lg"
        >
          <div class="animate-pulse">
            <Icon icon={mdiCloudUploadOutline} size="30" />
          </div>
        </button>
      </div>
    {/if}
  </div>
{/if}
