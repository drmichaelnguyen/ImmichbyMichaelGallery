export type ColorAdjustParameters = {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  tint: number;
  clarity: number;
  fade: number;
};

export const DEFAULT_COLOR_ADJUST: ColorAdjustParameters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  warmth: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  tint: 0,
  clarity: 0,
  fade: 0,
};

export const normalizeColorAdjust = (params: Partial<ColorAdjustParameters>): ColorAdjustParameters => ({
  ...DEFAULT_COLOR_ADJUST,
  ...params,
});

export const isDefaultColorAdjust = (params: Partial<ColorAdjustParameters>): boolean =>
  Object.values(normalizeColorAdjust(params)).every((value) => value === 0);

export const cssFilterFromColorAdjust = (params: Partial<ColorAdjustParameters>): string | undefined => {
  const values = normalizeColorAdjust(params);
  if (isDefaultColorAdjust(values)) {
    return undefined;
  }

  const brightness = clampMultiplier(1 + (values.brightness + values.exposure * 0.6) / 100);
  const contrast = clampMultiplier(1 + values.contrast / 100);
  const saturation = clampMultiplier(1 + (values.saturation + values.vibrance * 0.55) / 100);

  const parts = [`brightness(${brightness})`, `contrast(${contrast})`, `saturate(${saturation})`];

  if (values.shadows > 0) {
    parts.push(`brightness(${1 + values.shadows / 250})`);
    parts.push(`contrast(${1 - values.shadows / 400})`);
  } else if (values.shadows < 0) {
    parts.push(`contrast(${1 + values.shadows / 200})`);
  }

  if (values.highlights !== 0) {
    parts.push(`brightness(${1 + values.highlights / 300})`);
  }

  if (values.warmth > 0) {
    parts.push(`sepia(${values.warmth / 200})`);
    parts.push(`hue-rotate(-8deg)`);
  } else if (values.warmth < 0) {
    parts.push(`hue-rotate(${values.warmth * 0.35}deg)`);
  }

  if (values.tint !== 0) {
    parts.push(`hue-rotate(${-values.tint * 0.4}deg)`);
  }

  if (values.clarity > 0) {
    parts.push(`contrast(${1 + values.clarity / 300})`);
  }

  if (values.fade > 0) {
    parts.push(`contrast(${1 - values.fade / 250})`);
    parts.push(`brightness(${1 + values.fade / 400})`);
  }

  return parts.join(' ');
};

const clampMultiplier = (value: number) => Math.min(3, Math.max(0.2, value));

export type ColorPreset = {
  id: string;
  labelKey: string;
  values: ColorAdjustParameters;
};

export type ColorPresetCategory = {
  id: string;
  labelKey: string;
  presets: ColorPreset[];
};

const preset = (values: Partial<ColorAdjustParameters>): ColorAdjustParameters => ({
  ...DEFAULT_COLOR_ADJUST,
  ...values,
});

/** Presets grouped by industry-standard categories (VSCO / Lightroom / cinematic packs). */
export const COLOR_PRESET_CATEGORIES: ColorPresetCategory[] = [
  {
    id: 'classic',
    labelKey: 'editor_preset_category_classic',
    presets: [
      { id: 'original', labelKey: 'editor_preset_original', values: preset({}) },
      {
        id: 'natural',
        labelKey: 'editor_preset_natural',
        values: preset({ brightness: 3, contrast: 5, vibrance: 8, clarity: 5 }),
      },
      {
        id: 'vivid',
        labelKey: 'editor_preset_vivid',
        values: preset({ brightness: 5, contrast: 18, saturation: 35, vibrance: 12, clarity: 15 }),
      },
      {
        id: 'punch',
        labelKey: 'editor_preset_punch',
        values: preset({ brightness: 4, contrast: 28, saturation: 40, exposure: 6, vibrance: 18, clarity: 25 }),
      },
      {
        id: 'pop',
        labelKey: 'editor_preset_pop',
        values: preset({ brightness: 6, contrast: 22, saturation: 45, vibrance: 25, clarity: 18 }),
      },
      {
        id: 'clean',
        labelKey: 'editor_preset_clean',
        values: preset({ brightness: 10, contrast: -8, saturation: -5, highlights: 12, clarity: -8 }),
      },
      {
        id: 'soft',
        labelKey: 'editor_preset_soft',
        values: preset({ brightness: 14, contrast: -18, saturation: 6, exposure: 4, warmth: 8, highlights: 10, fade: 8 }),
      },
    ],
  },
  {
    id: 'portrait',
    labelKey: 'editor_preset_category_portrait',
    presets: [
      {
        id: 'portrait',
        labelKey: 'editor_preset_portrait',
        values: preset({ brightness: 8, contrast: -10, saturation: -5, warmth: 12, highlights: 15, fade: 12, clarity: -10 }),
      },
      {
        id: 'rosy',
        labelKey: 'editor_preset_rosy',
        values: preset({ warmth: 20, saturation: 8, contrast: -8, highlights: 12, fade: 10, tint: 12 }),
      },
      {
        id: 'bridal',
        labelKey: 'editor_preset_bridal',
        values: preset({ brightness: 18, contrast: -15, saturation: -8, highlights: 20, fade: 8, warmth: 5 }),
      },
      {
        id: 'studio',
        labelKey: 'editor_preset_studio',
        values: preset({ brightness: 5, contrast: 8, saturation: -10, shadows: 10, highlights: 8, clarity: -15 }),
      },
      {
        id: 'flattering',
        labelKey: 'editor_preset_flattering',
        values: preset({ brightness: 6, contrast: -12, warmth: 15, highlights: 18, fade: 15, vibrance: 5 }),
      },
    ],
  },
  {
    id: 'cinematic',
    labelKey: 'editor_preset_category_cinematic',
    presets: [
      {
        id: 'cinema',
        labelKey: 'editor_preset_cinema',
        values: preset({ brightness: -8, contrast: 20, saturation: -12, warmth: 18, shadows: 10, fade: 15, tint: 8 }),
      },
      {
        id: 'teal_orange',
        labelKey: 'editor_preset_teal_orange',
        values: preset({ contrast: 25, saturation: 15, warmth: -20, tint: -15, shadows: -10, highlights: -5, vibrance: 10, clarity: 12 }),
      },
      {
        id: 'blockbuster',
        labelKey: 'editor_preset_blockbuster',
        values: preset({ contrast: 28, saturation: 20, warmth: -15, shadows: -12, clarity: 18, vibrance: 15, exposure: -3 }),
      },
      {
        id: 'dramatic',
        labelKey: 'editor_preset_dramatic',
        values: preset({ brightness: -12, contrast: 32, saturation: 12, exposure: -5, shadows: -15, clarity: 20 }),
      },
      {
        id: 'film_noir',
        labelKey: 'editor_preset_film_noir',
        values: preset({ brightness: -20, contrast: 35, saturation: -100, shadows: -25, clarity: 15, fade: 5 }),
      },
      {
        id: 'neo_noir',
        labelKey: 'editor_preset_neo_noir',
        values: preset({ brightness: -12, contrast: 30, saturation: -80, shadows: -18, clarity: 12, warmth: -8 }),
      },
    ],
  },
  {
    id: 'vintage',
    labelKey: 'editor_preset_category_vintage',
    presets: [
      {
        id: 'vintage',
        labelKey: 'editor_preset_vintage',
        values: preset({ brightness: -6, contrast: -12, saturation: -24, warmth: 30, fade: 35, tint: 10 }),
      },
      {
        id: 'fade',
        labelKey: 'editor_preset_fade',
        values: preset({ brightness: 12, contrast: -22, saturation: -28, warmth: 10, fade: 45, shadows: 15 }),
      },
      {
        id: 'instant',
        labelKey: 'editor_preset_instant',
        values: preset({ warmth: 25, fade: 40, contrast: -15, saturation: -10, highlights: 12, tint: 8 }),
      },
      {
        id: 'analog',
        labelKey: 'editor_preset_analog',
        values: preset({ fade: 30, warmth: 18, contrast: -8, saturation: -15, tint: 8, clarity: -5 }),
      },
      {
        id: 'retro',
        labelKey: 'editor_preset_retro',
        values: preset({ warmth: 22, saturation: 10, contrast: -10, fade: 25, tint: 15, vibrance: 8 }),
      },
      {
        id: 'eighties',
        labelKey: 'editor_preset_eighties',
        values: preset({ saturation: 25, contrast: 15, warmth: 10, fade: 20, vibrance: 20, tint: 15 }),
      },
    ],
  },
  {
    id: 'landscape',
    labelKey: 'editor_preset_category_landscape',
    presets: [
      {
        id: 'emerald',
        labelKey: 'editor_preset_emerald',
        values: preset({ vibrance: 25, saturation: 20, contrast: 12, warmth: -5, tint: -18, clarity: 20 }),
      },
      {
        id: 'ocean',
        labelKey: 'editor_preset_ocean',
        values: preset({ saturation: 15, warmth: -35, tint: -20, contrast: 10, vibrance: 18, clarity: 15 }),
      },
      {
        id: 'alpine',
        labelKey: 'editor_preset_alpine',
        values: preset({ contrast: 15, warmth: -25, saturation: -5, clarity: 25, shadows: 8, highlights: -5 }),
      },
      {
        id: 'forest',
        labelKey: 'editor_preset_forest',
        values: preset({ vibrance: 18, saturation: 12, warmth: -12, tint: -22, contrast: 10, shadows: 5 }),
      },
      {
        id: 'desert',
        labelKey: 'editor_preset_desert',
        values: preset({ warmth: 40, saturation: 15, contrast: 8, exposure: 5, vibrance: 12, fade: 8 }),
      },
    ],
  },
  {
    id: 'warm',
    labelKey: 'editor_preset_category_warm',
    presets: [
      {
        id: 'golden',
        labelKey: 'editor_preset_golden',
        values: preset({ brightness: 10, contrast: 8, saturation: 22, exposure: 8, warmth: 45, shadows: 12 }),
      },
      {
        id: 'sunset',
        labelKey: 'editor_preset_sunset',
        values: preset({ brightness: 6, contrast: 12, saturation: 28, exposure: 5, warmth: 55, highlights: -8 }),
      },
      {
        id: 'amber',
        labelKey: 'editor_preset_amber',
        values: preset({ warmth: 38, brightness: 8, saturation: 18, contrast: 6, vibrance: 10 }),
      },
      {
        id: 'peach',
        labelKey: 'editor_preset_peach',
        values: preset({ warmth: 28, brightness: 12, saturation: 10, contrast: -10, highlights: 15, fade: 10 }),
      },
      {
        id: 'honey',
        labelKey: 'editor_preset_honey',
        values: preset({ warmth: 35, brightness: 10, saturation: 18, fade: 15, vibrance: 8 }),
      },
    ],
  },
  {
    id: 'cool',
    labelKey: 'editor_preset_category_cool',
    presets: [
      {
        id: 'cool',
        labelKey: 'editor_preset_cool',
        values: preset({ contrast: 10, saturation: -8, warmth: -40, tint: -12, shadows: 8 }),
      },
      {
        id: 'arctic',
        labelKey: 'editor_preset_arctic',
        values: preset({ warmth: -45, tint: -18, contrast: 8, saturation: -12, highlights: 10, clarity: 8 }),
      },
      {
        id: 'moody',
        labelKey: 'editor_preset_moody',
        values: preset({ brightness: -18, contrast: 22, saturation: -18, exposure: -8, warmth: -15, shadows: -20, fade: 10 }),
      },
      {
        id: 'storm',
        labelKey: 'editor_preset_storm',
        values: preset({ brightness: -15, saturation: -20, warmth: -30, tint: -8, contrast: 22, shadows: -18 }),
      },
      {
        id: 'steel',
        labelKey: 'editor_preset_steel',
        values: preset({ warmth: -35, contrast: 18, saturation: -25, clarity: 12, shadows: -8, fade: 5 }),
      },
    ],
  },
  {
    id: 'bw',
    labelKey: 'editor_preset_category_bw',
    presets: [
      {
        id: 'bw',
        labelKey: 'editor_preset_bw',
        values: preset({ contrast: 18, saturation: -100, clarity: 12 }),
      },
      {
        id: 'noir',
        labelKey: 'editor_preset_noir',
        values: preset({ saturation: -100, contrast: 35, brightness: -15, shadows: -20, clarity: 18 }),
      },
      {
        id: 'high_contrast_bw',
        labelKey: 'editor_preset_high_contrast_bw',
        values: preset({ saturation: -100, contrast: 40, clarity: 20, shadows: -15 }),
      },
      {
        id: 'silver',
        labelKey: 'editor_preset_silver',
        values: preset({ saturation: -100, contrast: 8, brightness: 5, fade: 12, clarity: -5 }),
      },
    ],
  },
];

export const COLOR_PRESETS: ColorPreset[] = COLOR_PRESET_CATEGORIES.flatMap((category) => category.presets);

export const findMatchingPresetId = (params: Partial<ColorAdjustParameters>): string | null => {
  const values = normalizeColorAdjust(params);
  for (const colorPreset of COLOR_PRESETS) {
    const matches = (Object.keys(DEFAULT_COLOR_ADJUST) as (keyof ColorAdjustParameters)[]).every(
      (key) => colorPreset.values[key] === values[key],
    );
    if (matches) {
      return colorPreset.id;
    }
  }
  return null;
};
