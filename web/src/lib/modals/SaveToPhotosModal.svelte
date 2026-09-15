<script lang="ts">
  import { downloadBlob } from '$lib/utils';
  import { ConfirmModal, toastManager } from '@immich/ui';
  import { mdiImageAlbum } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    file?: File;
    files?: File[];
    filename: string;
    onClose: (saved?: boolean) => void;
  };

  let { file = undefined, files = undefined, filename, onClose }: Props = $props();

  const shareFiles = $derived(files?.length ? files : file ? [file] : []);

  const handleClose = async (confirmed?: boolean) => {
    if (!confirmed) {
      onClose(false);
      return;
    }

    try {
      // Must run from this button click so the browser keeps user activation for share().
      await navigator.share({ files: shareFiles, title: filename });
      onClose(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onClose(false);
        return;
      }

      toastManager.warning($t('errors.error_saving_to_photos'));
      for (const file of shareFiles) {
        downloadBlob(file, file.name);
      }
      onClose(false);
    }
  };
</script>

<ConfirmModal
  title={$t('save_to_photos_title')}
  confirmText={$t('save_to_photos')}
  icon={mdiImageAlbum}
  onClose={handleClose}
>
  {#snippet prompt()}
    <p>
      {shareFiles.length > 1
        ? $t('save_to_photos_multiple_description', { values: { count: shareFiles.length } })
        : $t('save_to_photos_description')}
    </p>
  {/snippet}
</ConfirmModal>
