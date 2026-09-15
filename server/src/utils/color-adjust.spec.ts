import sharp from 'sharp';
import { applyColorAdjust } from 'src/utils/color-adjust';

const defaultParams = {
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

describe('applyColorAdjust', () => {
  it('returns unchanged dimensions for default parameters', async () => {
    const input = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .png()
      .toBuffer();

    const { data, info } = await applyColorAdjust(sharp(input), defaultParams)
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(20);
    expect(data[0]).toBe(128);
  });

  it('increases brightness', async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .png()
      .toBuffer();

    const { data } = await applyColorAdjust(sharp(input), {
      ...defaultParams,
      brightness: 50,
    })
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(data[0]).toBeGreaterThan(100);
  });

  it('accepts legacy edits missing advanced fields', async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .png()
      .toBuffer();

    const { data } = await applyColorAdjust(sharp(input), {
      brightness: 30,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      warmth: 0,
    })
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(data[0]).toBeGreaterThan(100);
  });

  it('applies mild negative clarity without throwing (sharp blur sigma floor)', async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .png()
      .toBuffer();

    await expect(
      applyColorAdjust(sharp(input), {
        ...defaultParams,
        clarity: -10,
      })
        .png()
        .toBuffer(),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('applies positive shadows without throwing (sharp gamma floor)', async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .png()
      .toBuffer();

    await expect(
      applyColorAdjust(sharp(input), {
        ...defaultParams,
        shadows: 5,
      })
        .png()
        .toBuffer(),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
