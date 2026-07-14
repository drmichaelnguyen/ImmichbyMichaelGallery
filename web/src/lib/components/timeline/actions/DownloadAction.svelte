<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';

  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { handleDownloadAsset } from '$lib/services/asset.service';
  import { isMobileDownloadClient } from '$lib/utils';
  import { downloadArchive } from '$lib/utils/asset-utils';
  import { getAssetInfo } from '@immich/sdk';
  import { IconButton } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    filename?: string;
    menuItem?: boolean;
  }

  let { filename = 'immich.zip', menuItem = false }: Props = $props();

  const handleDownloadFiles = async () => {
    const assets = [...assetMultiSelectManager.assets];
    assetMultiSelectManager.clear();

    // On mobile, share each file so users can save to Photos/Gallery instead of a zip in Files.
    if (assets.length === 1 || (isMobileDownloadClient() && assets.length <= 20)) {
      for (const [index, selected] of assets.entries()) {
        const asset = await getAssetInfo({ ...authManager.params, id: selected.id });
        await handleDownloadAsset(asset, { edited: true });
        if (index < assets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      return;
    }

    await downloadArchive(filename, { assetIds: assets.map((asset) => asset.id) });
  };
</script>

<svelte:document use:shortcut={{ shortcut: { key: 'd', shift: true }, onShortcut: handleDownloadFiles }} />

{#if menuItem}
  <MenuOption text={$t('download')} icon={mdiDownload} onClick={handleDownloadFiles} />
{:else}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$t('download')}
    icon={mdiDownload}
    onclick={handleDownloadFiles}
  />
{/if}
