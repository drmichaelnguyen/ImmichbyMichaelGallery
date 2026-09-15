<script lang="ts">
  import { localManager } from '$lib/managers/edit/local-manager.svelte';
  import type { ColorAdjustParameters } from '$lib/utils/color-adjust';
  import { Button, HStack } from '@immich/ui';
  import { t } from 'svelte-i18n';

  const basicSliders: { key: keyof ColorAdjustParameters; labelKey: 'editor_adjust_exposure' | 'editor_adjust_brightness' | 'editor_adjust_contrast' | 'editor_adjust_saturation' | 'editor_adjust_warmth' }[] = [
    { key: 'exposure', labelKey: 'editor_adjust_exposure' },
    { key: 'brightness', labelKey: 'editor_adjust_brightness' },
    { key: 'contrast', labelKey: 'editor_adjust_contrast' },
    { key: 'saturation', labelKey: 'editor_adjust_saturation' },
    { key: 'warmth', labelKey: 'editor_adjust_warmth' },
  ];

  const advancedSliders: { key: keyof ColorAdjustParameters; labelKey: 'editor_adjust_highlights' | 'editor_adjust_shadows' | 'editor_adjust_vibrance' | 'editor_adjust_tint' | 'editor_adjust_clarity' | 'editor_adjust_fade' }[] = [
    { key: 'highlights', labelKey: 'editor_adjust_highlights' },
    { key: 'shadows', labelKey: 'editor_adjust_shadows' },
    { key: 'vibrance', labelKey: 'editor_adjust_vibrance' },
    { key: 'tint', labelKey: 'editor_adjust_tint' },
    { key: 'clarity', labelKey: 'editor_adjust_clarity' },
    { key: 'fade', labelKey: 'editor_adjust_fade' },
  ];

  const adjustments = $derived(localManager.activeAdjustments());
</script>

{#snippet sliderRow(slider: { key: keyof ColorAdjustParameters; labelKey: typeof basicSliders[number]['labelKey'] | typeof advancedSliders[number]['labelKey'] })}
  <div>
    <HStack class="mb-1 justify-between text-xs text-white/80">
      <span>{$t(slider.labelKey)}</span>
      <span>{adjustments[slider.key]}</span>
    </HStack>
    <input
      type="range"
      min={-100}
      max={100}
      step={1}
      class="w-full accent-immich-primary"
      value={adjustments[slider.key]}
      oninput={(event) => localManager.setAdjustment(slider.key, Number((event.currentTarget as HTMLInputElement).value))}
    />
  </div>
{/snippet}

<div class="mt-3 px-2 pb-4 md:px-4">
  <div class="mb-3 flex flex-wrap gap-2">
    <Button
      size="small"
      shape="round"
      variant={localManager.mode === 'brush' ? 'filled' : 'outline'}
      color={localManager.mode === 'brush' ? 'primary' : 'secondary'}
      onclick={() => (localManager.mode = 'brush')}
    >
      {$t('editor_brush')}
    </Button>
    <Button
      size="small"
      shape="round"
      variant={localManager.mode === 'erase' ? 'filled' : 'outline'}
      color={localManager.mode === 'erase' ? 'primary' : 'secondary'}
      onclick={() => (localManager.mode = 'erase')}
    >
      {$t('editor_erase')}
    </Button>
    <Button
      size="small"
      shape="round"
      variant={localManager.mode === 'radial' ? 'filled' : 'outline'}
      color={localManager.mode === 'radial' ? 'primary' : 'secondary'}
      onclick={() => (localManager.mode = 'radial')}
    >
      {$t('editor_radial')}
    </Button>
    <Button
      size="small"
      shape="round"
      variant={localManager.mode === 'linear' ? 'filled' : 'outline'}
      color={localManager.mode === 'linear' ? 'primary' : 'secondary'}
      onclick={() => (localManager.mode = 'linear')}
    >
      {$t('editor_linear')}
    </Button>
  </div>

  {#if localManager.mode === 'brush' || localManager.mode === 'erase'}
    <div class="mb-4 space-y-3">
      <div>
        <HStack class="mb-1 justify-between text-xs text-white/80">
          <span>{$t('editor_brush_size')}</span>
          <span>{Math.round(localManager.brushSize * 100)}%</span>
        </HStack>
        <input
          type="range"
          min={1}
          max={40}
          step={1}
          class="w-full accent-immich-primary"
          value={Math.round(localManager.brushSize * 100)}
          oninput={(event) => (localManager.brushSize = Number((event.currentTarget as HTMLInputElement).value) / 100)}
        />
      </div>
      <div>
        <HStack class="mb-1 justify-between text-xs text-white/80">
          <span>{$t('editor_brush_feather')}</span>
          <span>{Math.round((1 - localManager.brushHardness) * 100)}%</span>
        </HStack>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          class="w-full accent-immich-primary"
          value={Math.round((1 - localManager.brushHardness) * 100)}
          oninput={(event) =>
            (localManager.brushHardness = 1 - Number((event.currentTarget as HTMLInputElement).value) / 100)}
        />
      </div>
      <div>
        <HStack class="mb-1 justify-between text-xs text-white/80">
          <span>{$t('editor_brush_flow')}</span>
          <span>{Math.round(localManager.brushOpacity * 100)}%</span>
        </HStack>
        <input
          type="range"
          min={5}
          max={100}
          step={1}
          class="w-full accent-immich-primary"
          value={Math.round(localManager.brushOpacity * 100)}
          oninput={(event) =>
            (localManager.brushOpacity = Number((event.currentTarget as HTMLInputElement).value) / 100)}
        />
      </div>
    </div>
  {/if}

  <div class="mb-3 flex flex-wrap items-center gap-2">
    <Button size="small" shape="round" variant="outline" color="secondary" onclick={() => localManager.addMask()}>
      {$t('editor_add_mask')}
    </Button>
    <Button
      size="small"
      shape="round"
      variant={localManager.showMaskOverlay ? 'filled' : 'outline'}
      color={localManager.showMaskOverlay ? 'primary' : 'secondary'}
      onclick={() => (localManager.showMaskOverlay = !localManager.showMaskOverlay)}
    >
      {$t('editor_show_mask')}
    </Button>
    <Button size="small" shape="round" variant="outline" color="secondary" onclick={() => localManager.toggleMaskInvert()}>
      {$t('editor_invert_mask')}
    </Button>
    <Button
      size="small"
      shape="round"
      variant="outline"
      color="secondary"
      onclick={() => localManager.clearActiveMaskShapes()}
      disabled={!localManager.activeMask}
    >
      {$t('editor_clear_mask')}
    </Button>
  </div>

  {#if localManager.masks.length > 0}
    <div class="mb-4 flex flex-wrap gap-2">
      {#each localManager.masks as mask (mask.id)}
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition-colors
            {localManager.activeMaskId === mask.id
            ? 'border-immich-primary bg-immich-primary/20 text-white'
            : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/10'}"
          onclick={() => localManager.selectMask(mask.id)}
        >
          {mask.name ?? mask.id}
        </button>
      {/each}
    </div>
  {:else}
    <p class="mb-4 text-xs text-white/60">{$t('editor_local_hint')}</p>
  {/if}

  <div class="mb-2 flex h-10 items-center text-sm">
    <h2>{$t('editor_local_adjustments')}</h2>
  </div>
  <div class="space-y-4">
    {#each basicSliders as slider (slider.key)}
      {@render sliderRow(slider)}
    {/each}
  </div>

  <div class="mt-6 mb-2 flex h-10 items-center text-sm">
    <h2>{$t('editor_advanced_adjustments')}</h2>
  </div>
  <div class="space-y-4">
    {#each advancedSliders as slider (slider.key)}
      {@render sliderRow(slider)}
    {/each}
  </div>
</div>
