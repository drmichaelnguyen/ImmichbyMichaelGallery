<script lang="ts">
  import { Icon } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    onDownloadJpg: () => void;
    onDownloadRaw: () => void;
    /** Lighter style for light album headers; default suits dark control bars. */
    tone?: 'dark' | 'light';
  }

  let { onDownloadJpg, onDownloadRaw, tone = 'dark' }: Props = $props();

  const baseButton =
    'inline-flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2.5 py-1.5 shadow-sm backdrop-blur-sm transition-colors';
  const jpgClass =
    tone === 'dark'
      ? `${baseButton} border-white/50 bg-white/20 text-white hover:bg-white/35`
      : `${baseButton} border-gray-300/80 bg-white/80 text-gray-800 hover:bg-white`;
  const rawClass =
    tone === 'dark'
      ? `${baseButton} border-amber-200/70 bg-amber-500/30 text-white hover:bg-amber-500/45`
      : `${baseButton} border-amber-300/80 bg-amber-100/90 text-amber-950 hover:bg-amber-200/90`;
</script>

<div class="flex items-center gap-1.5">
  <button
    type="button"
    class={jpgClass}
    aria-label={`${$t('download')} JPG`}
    title={`${$t('download')} JPG`}
    onclick={onDownloadJpg}
  >
    <span class="text-[9px] font-bold leading-none tracking-wider opacity-90">JPG</span>
    <Icon icon={mdiDownload} size="18" class="opacity-95" />
  </button>
  <button
    type="button"
    class={rawClass}
    aria-label={`${$t('download')} RAW`}
    title={`${$t('download')} RAW`}
    onclick={onDownloadRaw}
  >
    <span class="text-[9px] font-bold leading-none tracking-wider opacity-90">RAW</span>
    <Icon icon={mdiDownload} size="18" class="opacity-95" />
  </button>
</div>
