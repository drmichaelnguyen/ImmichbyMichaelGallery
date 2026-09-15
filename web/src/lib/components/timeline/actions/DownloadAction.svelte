<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';

  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { downloadManager } from '$lib/managers/download-manager.svelte';
  import { downloadGalleryPhotoFile, handleDownloadAsset } from '$lib/services/asset.service';
  import { isMobileDownloadClient, shareOrDownloadFiles } from '$lib/utils';
  import { downloadArchive } from '$lib/utils/asset-utils';
  import { handleError } from '$lib/utils/handle-error';
  import { AssetTypeEnum, getAssetInfo } from '@immich/sdk';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    filename?: string;
    menuItem?: boolean;
  }

  let { filename = 'immich', menuItem = false }: Props = $props();

  type SelectedDownloadFormat = 'jpg' | 'raw';

  const archiveFilename = (format: SelectedDownloadFormat) => {
    const suffix = format === 'jpg' ? 'jpg' : 'raw';
    return filename.toLowerCase().endsWith('.zip')
      ? filename.replace(/\.zip$/i, `-${suffix}.zip`)
      : `${filename}-${suffix}.zip`;
  };

  const batchTitle = () => archiveFilename('jpg').replace(/\.zip$/i, '');

  const handleMobileGalleryDownload = async (selectedAssets: typeof assetMultiSelectManager.assets) => {
    const assets = [];
    for (const selected of selectedAssets) {
      const asset = await getAssetInfo({ ...authManager.params, id: selected.id });
      if (asset.type !== AssetTypeEnum.Image) {
        return false;
      }
      assets.push(asset);
    }

    const downloadKey = `${batchTitle()} JPG`;
    downloadManager.add(downloadKey, assets.length, undefined, 'items');

    try {
      const files = [];
      for (const asset of assets) {
        files.push(await downloadGalleryPhotoFile(asset));
        downloadManager.update(downloadKey, files.length);
      }

      await shareOrDownloadFiles(files, downloadKey);
      return true;
    } finally {
      setTimeout(() => downloadManager.clear(downloadKey), 5000);
    }
  };

  const handleDownloadFiles = async (format: SelectedDownloadFormat) => {
    const assets = [...assetMultiSelectManager.assets];
    assetMultiSelectManager.clear();

    if (format === 'raw') {
      if (assets.length === 1) {
        const asset = await getAssetInfo({ ...authManager.params, id: assets[0].id });
        await handleDownloadAsset(asset, { edited: false });
        return;
      }

      await downloadArchive(archiveFilename('raw'), {
        assetIds: assets.map((asset) => asset.id),
        edited: false,
        downloadFormat: 'original',
      });
      return;
    }

    // On mobile, share selected JPGs so users can save to Photos/Gallery instead of a zip in Files.
    if (isMobileDownloadClient()) {
      try {
        if (await handleMobileGalleryDownload(assets)) {
          return;
        }
      } catch (error) {
        handleError(error, $t('errors.unable_to_download_files'));
        return;
      }
    }

    if (assets.length === 1) {
      for (const [index, selected] of assets.entries()) {
        const asset = await getAssetInfo({ ...authManager.params, id: selected.id });
        await handleDownloadAsset(asset, {
          edited: true,
          asGalleryPhoto: asset.type === AssetTypeEnum.Image,
        });
        if (index < assets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      return;
    }

    await downloadArchive(archiveFilename('jpg'), {
      assetIds: assets.map((asset) => asset.id),
      edited: true,
      downloadFormat: 'jpg',
    });
  };
</script>

<svelte:document use:shortcut={{ shortcut: { key: 'd', shift: true }, onShortcut: () => handleDownloadFiles('jpg') }} />

{#if menuItem}
  <MenuOption text="JPG" icon={mdiDownload} onClick={() => handleDownloadFiles('jpg')} />
  <MenuOption text="RAW" icon={mdiDownload} onClick={() => handleDownloadFiles('raw')} />
{:else}
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="inline-flex items-center rounded-full border border-white/50 bg-white/20 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/35"
      aria-label={`${$t('download')} JPG`}
      title={`${$t('download')} JPG`}
      onclick={() => handleDownloadFiles('jpg')}
    >
      JPG
    </button>
    <button
      type="button"
      class="inline-flex items-center rounded-full border border-amber-200/70 bg-amber-500/30 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-amber-500/45"
      aria-label={`${$t('download')} RAW`}
      title={`${$t('download')} RAW`}
      onclick={() => handleDownloadFiles('raw')}
    >
      RAW
    </button>
  </div>
{/if}
