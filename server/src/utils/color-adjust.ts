import { ColorAdjustParameters } from 'src/dtos/editing.dto';
import sharp from 'sharp';

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

/** Apply non-destructive color adjustments after geometric edits. */
export const applyColorAdjust = (pipeline: sharp.Sharp, params: Partial<ColorAdjustParameters>): sharp.Sharp => {
  const values = normalizeColorAdjust(params);
  if (isDefaultColorAdjust(values)) {
    return pipeline;
  }

  const brightness = clampMultiplier(1 + (values.brightness + values.exposure * 0.6) / 100);
  const saturation = clampMultiplier(1 + (values.saturation + values.vibrance * 0.55) / 100);

  pipeline = pipeline.modulate({ brightness, saturation });

  if (values.fade !== 0) {
    const amount = values.fade / 100;
    pipeline = pipeline.linear(1 - amount * 0.35, amount * 35);
    if (amount > 0) {
      pipeline = pipeline.modulate({ saturation: clampMultiplier(1 - amount * 0.18) });
    }
  }

  const contrast = 1 + values.contrast / 100;
  if (contrast !== 1) {
    pipeline = pipeline.linear(contrast, 128 * (1 - contrast));
  }

  if (values.shadows > 0) {
    const amount = values.shadows / 100;
    pipeline = pipeline.gamma(1 / (1 + amount * 0.45));
    pipeline = pipeline.linear(1, amount * 18);
  } else if (values.shadows < 0) {
    const amount = -values.shadows / 100;
    pipeline = pipeline.gamma(1 + amount * 0.35);
  }

  if (values.highlights > 0) {
    const amount = values.highlights / 100;
    pipeline = pipeline.gamma(1 + amount * 0.3);
  } else if (values.highlights < 0) {
    const amount = -values.highlights / 100;
    pipeline = pipeline.linear(1 - amount * 0.25, amount * 15);
  }

  pipeline = applyWarmth(pipeline, values.warmth);
  pipeline = applyTint(pipeline, values.tint);

  if (values.clarity > 0) {
    pipeline = pipeline.sharpen({ sigma: 0.8 + values.clarity / 80, m1: 0.5, m2: 2 + values.clarity / 50 });
  } else if (values.clarity < 0) {
    pipeline = pipeline.blur(-values.clarity / 60);
  }

  return pipeline;
};

const applyWarmth = (pipeline: sharp.Sharp, warmth: number): sharp.Sharp => {
  if (warmth > 0) {
    const amount = warmth / 100;
    return pipeline.recomb([
      [1 + amount * 0.15, amount * 0.05, 0],
      [amount * 0.05, 1, 0],
      [0, 0, 1 - amount * 0.1],
    ]);
  }
  if (warmth < 0) {
    const amount = -warmth / 100;
    return pipeline.recomb([
      [1 - amount * 0.1, 0, amount * 0.05],
      [0, 1, amount * 0.08],
      [amount * 0.05, amount * 0.05, 1 + amount * 0.12],
    ]);
  }
  return pipeline;
};

const applyTint = (pipeline: sharp.Sharp, tint: number): sharp.Sharp => {
  if (tint > 0) {
    const amount = tint / 100;
    return pipeline.recomb([
      [1 + amount * 0.1, 0, amount * 0.05],
      [0, 1 - amount * 0.08, 0],
      [amount * 0.05, 0, 1 + amount * 0.1],
    ]);
  }
  if (tint < 0) {
    const amount = -tint / 100;
    return pipeline.recomb([
      [1 - amount * 0.08, amount * 0.05, 0],
      [amount * 0.08, 1 + amount * 0.1, amount * 0.05],
      [0, amount * 0.05, 1 - amount * 0.08],
    ]);
  }
  return pipeline;
};

const clampMultiplier = (value: number) => Math.min(3, Math.max(0.2, value));
