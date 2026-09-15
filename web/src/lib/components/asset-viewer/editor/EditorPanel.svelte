<script lang="ts">
  import { shortcuts } from '$lib/actions/shortcut';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { editManager, EditToolType } from '$lib/managers/edit/edit-manager.svelte';
  import { getSharedLink } from '$lib/utils';
  import { websocketEvents } from '$lib/stores/websocket';
  import { getAssetEdits, type AssetResponseDto } from '@immich/sdk';
  import { Button, HStack, IconButton } from '@immich/ui';
  import { mdiClose } from '@mdi/js';
  import { onDestroy, onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  onMount(() => {
    return websocketEvents.on('on_asset_update', (assetUpdate) => {
      if (assetUpdate.id === asset.id) {
        asset = assetUpdate;
      }
    });
  });

  interface Props {
    asset: AssetResponseDto;
    onClose: () => void;
    compact?: boolean;
  }

  onMount(async () => {
    const edits = await getAssetEdits({ id: asset.id, ...authManager.params });
    await editManager.initialize(asset, edits);
  });

  onDestroy(() => {
    editManager.cleanup();
  });

  async function applyEdits() {
    const success = await editManager.applyEdits();

    if (success) {
      onClose();
    }
  }

  async function closeEditor() {
    if (await editManager.closeConfirm()) {
      onClose();
    }
  }

  let { asset = $bindable(), onClose, compact = false }: Props = $props();

  const sharedLink = getSharedLink();
  const saveLabel = $derived(sharedLink ? 'editor_download_edited' : 'save');
</script>

<svelte:document
  use:shortcuts={[
    { shortcut: { key: 'Escape' }, onShortcut: onClose },
    { shortcut: { key: 'Enter' }, onShortcut: applyEdits },
  ]}
/>

<section
  class={[
    'dark relative flex min-h-0 flex-1 flex-col overflow-hidden dark:bg-immich-dark-bg dark:text-immich-dark-fg',
    compact ? 'p-2 pt-1' : 'p-2 pt-3',
  ]}
>
  <HStack class={['justify-between', compact ? 'me-2' : 'me-4']}>
    <HStack>
      <IconButton
        shape="round"
        variant="ghost"
        color="secondary"
        icon={mdiClose}
        aria-label={$t('close')}
        onclick={closeEditor}
      />
      <p class={['capitalize text-immich-fg dark:text-immich-dark-fg', compact ? 'text-base' : 'text-lg']}>
        {$t('editor')}
      </p>
    </HStack>
    <Button shape="round" size="small" onclick={applyEdits} loading={editManager.isApplyingEdits}>{$t(saveLabel)}</Button>
  </HStack>

  <HStack class={['gap-2', compact ? 'mt-1 px-1' : 'mt-2 px-2']}>
    {#each editManager.tools as tool (tool.type)}
      <Button
        shape="round"
        size="small"
        variant={editManager.selectedTool?.type === tool.type ? 'filled' : 'outline'}
        color={editManager.selectedTool?.type === tool.type ? 'primary' : 'secondary'}
        onclick={() => editManager.selectTool(tool.type)}
      >
        {tool.type === EditToolType.Transform
          ? $t('editor_tab_transform')
          : tool.type === EditToolType.Color
            ? $t('editor_tab_adjust')
            : $t('editor_tab_local')}
      </Button>
    {/each}
  </HStack>

  <section class="min-h-0 flex-1 overflow-y-auto">
    {#if editManager.selectedTool}
      <editManager.selectedTool.component />
    {/if}
  </section>

  <section class={['shrink-0', compact ? 'p-2' : 'p-4']}>
    <Button
      variant="outline"
      onclick={() => editManager.resetAllChanges()}
      disabled={!editManager.canReset}
      class="self-start"
      shape="round"
      size="small"
    >
      {$t('editor_reset_all_changes')}
    </Button>
  </section>
</section>
