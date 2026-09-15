import {
  ColorAdjustParameters,
  LocalAdjustParameters,
  LocalMask,
  LocalMaskShape,
} from 'src/dtos/editing.dto';
import { applyColorAdjust, isDefaultColorAdjust } from 'src/utils/color-adjust';
import sharp from 'sharp';

export type RawImageInfo = {
  width: number;
  height: number;
  channels: number;
};

/** Rasterize mask shapes to a single-channel alpha buffer (0–255). */
export const rasterizeMask = (mask: LocalMask, width: number, height: number): Buffer => {
  const alpha = Buffer.alloc(width * height, 0);

  for (const shape of mask.shapes) {
    const shapeAlpha = rasterizeShape(shape, width, height);
    const mode = shape.mode ?? 'add';
    for (let i = 0; i < alpha.length; i++) {
      const value = shape.invert ? 255 - shapeAlpha[i]! : shapeAlpha[i]!;
      if (mode === 'subtract') {
        alpha[i] = Math.max(0, alpha[i]! - value);
      } else {
        alpha[i] = Math.max(alpha[i]!, value);
      }
    }
  }

  if (mask.invert) {
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = 255 - alpha[i]!;
    }
  }

  const opacity = Math.max(0, Math.min(1, mask.opacity ?? 1));
  if (opacity < 1) {
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = Math.round(alpha[i]! * opacity);
    }
  }

  return alpha;
};

const rasterizeShape = (shape: LocalMaskShape, width: number, height: number): Buffer => {
  switch (shape.type) {
    case 'brush':
      return rasterizeBrush(shape, width, height);
    case 'radial':
      return rasterizeRadial(shape, width, height);
    case 'linear':
      return rasterizeLinear(shape, width, height);
  }
};

const rasterizeBrush = (
  shape: Extract<LocalMaskShape, { type: 'brush' }>,
  width: number,
  height: number,
): Buffer => {
  const alpha = Buffer.alloc(width * height, 0);
  const minDim = Math.min(width, height);

  for (const stroke of shape.strokes) {
    const erase = stroke.erase ?? false;
    const points = stroke.points;
    if (points.length === 0) {
      continue;
    }

    // Stamp along the stroke, interpolating between points for continuous coverage.
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      const next = points[i + 1];
      const stamps = next
        ? Math.max(1, Math.ceil(Math.hypot((next.x - point.x) * width, (next.y - point.y) * height) / Math.max(1, point.size * minDim * 0.35)))
        : 1;

      for (let s = 0; s < stamps; s++) {
        const t = stamps === 1 ? 0 : s / stamps;
        const x = next ? point.x + (next.x - point.x) * t : point.x;
        const y = next ? point.y + (next.y - point.y) * t : point.y;
        const size = next ? point.size + (next.size - point.size) * t : point.size;
        const hardness = next ? point.hardness + (next.hardness - point.hardness) * t : point.hardness;
        const opacity = next ? point.opacity + (next.opacity - point.opacity) * t : point.opacity;
        stampBrush(alpha, width, height, x * width, y * height, size * minDim, hardness, opacity, erase);
      }
    }
  }

  return alpha;
};

const stampBrush = (
  alpha: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  diameter: number,
  hardness: number,
  opacity: number,
  erase: boolean,
) => {
  const radius = Math.max(0.5, diameter / 2);
  const hard = Math.max(0, Math.min(1, hardness));
  const inner = radius * hard;
  const strength = Math.max(0, Math.min(1, opacity)) * 255;
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > radius) {
        continue;
      }
      let cover = 1;
      if (dist > inner && radius > inner) {
        cover = 1 - (dist - inner) / (radius - inner);
      }
      const value = Math.round(strength * cover);
      const index = y * width + x;
      alpha[index] = erase ? Math.max(0, alpha[index]! - value) : Math.max(alpha[index]!, value);
    }
  }
};

const rasterizeRadial = (
  shape: Extract<LocalMaskShape, { type: 'radial' }>,
  width: number,
  height: number,
): Buffer => {
  const alpha = Buffer.alloc(width * height, 0);
  const cx = shape.cx * width;
  const cy = shape.cy * height;
  const rx = Math.max(1, shape.radiusX * width);
  const ry = Math.max(1, shape.radiusY * height);
  const feather = Math.max(0, Math.min(1, shape.feather));
  const innerScale = 1 - feather;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.hypot(nx, ny);
      let value = 0;
      if (d <= innerScale) {
        value = 255;
      } else if (d < 1) {
        value = Math.round(255 * (1 - (d - innerScale) / Math.max(0.0001, 1 - innerScale)));
      }
      alpha[y * width + x] = value;
    }
  }

  return alpha;
};

const rasterizeLinear = (
  shape: Extract<LocalMaskShape, { type: 'linear' }>,
  width: number,
  height: number,
): Buffer => {
  const alpha = Buffer.alloc(width * height, 0);
  const x1 = shape.x1 * width;
  const y1 = shape.y1 * height;
  const x2 = shape.x2 * width;
  const y2 = shape.y2 * height;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const feather = Math.max(0.01, Math.min(1, shape.feather || 0.35));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = ((x - x1) * dx + (y - y1) * dy) / lengthSq;
      let value = 0;
      if (t <= 0) {
        value = 255;
      } else if (t >= 1) {
        value = 0;
      } else {
        // Soft falloff across the gradient span, widened by feather.
        const soft = Math.min(1, Math.max(0, (1 - t) / feather));
        value = Math.round(255 * soft);
      }
      alpha[y * width + x] = value;
    }
  }

  return alpha;
};

const blendPixel = (base: number, adjusted: number, amount: number) =>
  Math.round(base * (1 - amount) + adjusted * amount);

/**
 * Apply local (masked) color adjustments on top of a decoded RGBA/RGB buffer.
 * Returns a new raw buffer with the same dimensions/channels.
 */
export const applyLocalAdjustToBuffer = async (
  data: Buffer,
  info: RawImageInfo,
  params: LocalAdjustParameters,
): Promise<Buffer> => {
  if (!params.masks?.length) {
    return data;
  }

  let current = Buffer.from(data);
  const { width, height, channels } = info;

  for (const mask of params.masks) {
    if (isDefaultColorAdjust(mask.adjustments)) {
      continue;
    }

    const alpha = rasterizeMask(mask, width, height);
  const adjusted = await applyColorAdjust(
      sharp(current, {
        raw: { width, height, channels: channels as 1 | 2 | 3 | 4 },
      }),
      mask.adjustments as ColorAdjustParameters,
    )
      .raw()
      .toBuffer();

    const next = Buffer.alloc(current.length);
    for (let i = 0; i < width * height; i++) {
      const amount = (alpha[i] ?? 0) / 255;
      const offset = i * channels;
      for (let c = 0; c < Math.min(3, channels); c++) {
        next[offset + c] = blendPixel(current[offset + c]!, adjusted[offset + c]!, amount);
      }
      if (channels > 3) {
        next[offset + 3] = current[offset + 3]!;
      }
    }
    current = next;
  }

  return current;
};
