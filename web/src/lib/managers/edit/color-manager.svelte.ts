import { AssetEditAction, type AssetResponseDto } from '@immich/sdk';
import type { EditActions, EditToolManager } from '$lib/managers/edit/edit-manager.svelte';
import {
  DEFAULT_COLOR_ADJUST,
  findMatchingPresetId,
  isDefaultColorAdjust,
  normalizeColorAdjust,
  type ColorAdjustParameters,
} from '$lib/utils/color-adjust';

class ColorManager implements EditToolManager {
  values = $state<ColorAdjustParameters>({ ...DEFAULT_COLOR_ADJUST });
  selectedPresetId = $state<string | null>('original');

  hasChanges = $derived(!isDefaultColorAdjust(this.values));
  canReset = $derived(this.hasChanges);

  get edits() {
    if (isDefaultColorAdjust(this.values)) {
      return [];
    }

    return [
      {
        action: AssetEditAction.ColorAdjust,
        parameters: { ...this.values },
      },
    ];
  }

  get previewFilter() {
    return this.values;
  }

  async onActivate(_asset: AssetResponseDto, edits: EditActions): Promise<void> {
    const colorEdit = edits.find((edit) => edit.action === AssetEditAction.ColorAdjust);
    if (colorEdit && colorEdit.action === AssetEditAction.ColorAdjust) {
      this.values = normalizeColorAdjust(colorEdit.parameters);
    } else {
      this.values = { ...DEFAULT_COLOR_ADJUST };
    }
    this.selectedPresetId = findMatchingPresetId(this.values) ?? null;
  }

  onDeactivate() {
    // Keep slider state when switching editor tabs.
  }

  async resetAllChanges() {
    this.values = { ...DEFAULT_COLOR_ADJUST };
    this.selectedPresetId = 'original';
  }

  applyPreset(values: ColorAdjustParameters, presetId: string) {
    this.values = { ...values };
    this.selectedPresetId = presetId;
  }

  setValue(key: keyof ColorAdjustParameters, value: number) {
    this.values = { ...this.values, [key]: value };
    this.selectedPresetId = findMatchingPresetId(this.values);
  }
}

export const colorManager = new ColorManager();
