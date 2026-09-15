<script lang="ts">
  import { colorManager } from '$lib/managers/edit/color-manager.svelte';
  import { COLOR_PRESET_CATEGORIES, type ColorAdjustParameters } from '$lib/utils/color-adjust';
  import { HStack } from '@immich/ui';
  import { t } from 'svelte-i18n';

  const basicSliders: { key: keyof ColorAdjustParameters; labelKey: string }[] = [
    { key: 'exposure', labelKey: 'editor_adjust_exposure' },
    { key: 'brightness', labelKey: 'editor_adjust_brightness' },
    { key: 'contrast', labelKey: 'editor_adjust_contrast' },
    { key: 'saturation', labelKey: 'editor_adjust_saturation' },
    { key: 'warmth', labelKey: 'editor_adjust_warmth' },
  ];

  const advancedSliders: { key: keyof ColorAdjustParameters; labelKey: string }[] = [
    { key: 'highlights', labelKey: 'editor_adjust_highlights' },
    { key: 'shadows', labelKey: 'editor_adjust_shadows' },
    { key: 'vibrance', labelKey: 'editor_adjust_vibrance' },
    { key: 'tint', labelKey: 'editor_adjust_tint' },
    { key: 'clarity', labelKey: 'editor_adjust_clarity' },
    { key: 'fade', labelKey: 'editor_adjust_fade' },
  ];
</script>

{#snippet sliderRow(slider: { key: keyof ColorAdjustParameters; labelKey: string })}
  <div>
    <HStack class="mb-1 justify-between text-xs text-white/80">
      <span>{$t(slider.labelKey)}</span>
      <span>{colorManager.values[slider.key]}</span>
    </HStack>
    <input
      type="range"
      min={-100}
      max={100}
      step={1}
      class="w-full accent-immich-primary"
      value={colorManager.values[slider.key]}
      oninput={(event) =>
        colorManager.setValue(slider.key, Number((event.currentTarget as HTMLInputElement).value))}
    />
  </div>
{/snippet}

<div class="mt-3 px-2 pb-4 md:px-4">
  {#each COLOR_PRESET_CATEGORIES as category (category.id)}
    <div class="mb-4">
      <div class="mb-2 flex h-8 items-center text-xs font-semibold uppercase tracking-wide text-white/60">
        {$t(category.labelKey)}
      </div>
      <div class="grid grid-cols-3 gap-2">
        {#each category.presets as preset (preset.id)}
          <button
            type="button"
            class="rounded-xl border px-2 py-2 text-xs font-medium transition-colors
              {colorManager.selectedPresetId === preset.id
              ? 'border-immich-primary bg-immich-primary/20 text-white'
              : 'border-white/20 bg-white/5 text-white/90 hover:bg-white/10'}"
            onclick={() => colorManager.applyPreset(preset.values, preset.id)}
          >
            {$t(preset.labelKey)}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  <div class="mt-4 mb-2 flex h-10 items-center text-sm">
    <h2>{$t('editor_adjustments')}</h2>
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
