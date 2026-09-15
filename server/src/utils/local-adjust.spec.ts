import { describe, expect, it } from 'vitest';
import { rasterizeMask } from 'src/utils/local-adjust';
import { DEFAULT_COLOR_ADJUST } from 'src/utils/color-adjust';

describe('local-adjust', () => {
  it('rasterizes a radial mask with a bright center', () => {
    const alpha = rasterizeMask(
      {
        id: '1',
        opacity: 1,
        invert: false,
        adjustments: DEFAULT_COLOR_ADJUST,
        shapes: [
          {
            type: 'radial',
            cx: 0.5,
            cy: 0.5,
            radiusX: 0.4,
            radiusY: 0.4,
            feather: 0.2,
            invert: false,
            mode: 'add',
          },
        ],
      },
      20,
      20,
    );

    expect(alpha[10 * 20 + 10]).toBe(255);
    expect(alpha[0]).toBe(0);
  });

  it('supports brush stamps', () => {
    const alpha = rasterizeMask(
      {
        id: 'brush',
        opacity: 1,
        invert: false,
        adjustments: DEFAULT_COLOR_ADJUST,
        shapes: [
          {
            type: 'brush',
            invert: false,
            mode: 'add',
            strokes: [
              {
                erase: false,
                points: [{ x: 0.5, y: 0.5, size: 0.3, hardness: 1, opacity: 1 }],
              },
            ],
          },
        ],
      },
      32,
      32,
    );

    expect(alpha[16 * 32 + 16]).toBeGreaterThan(200);
    expect(alpha[0]).toBe(0);
  });
});
