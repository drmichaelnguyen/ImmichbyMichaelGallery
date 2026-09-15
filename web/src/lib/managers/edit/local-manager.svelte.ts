import {
  AssetEditAction,
  type AssetResponseDto,
  type BrushPoint,
  type BrushStroke,
  type LocalAdjustParameters,
  type LocalMask,
  type LocalMaskShape,
} from '@immich/sdk';
import type { EditActions, EditToolManager } from '$lib/managers/edit/edit-manager.svelte';
import {
  DEFAULT_COLOR_ADJUST,
  isDefaultColorAdjust,
  normalizeColorAdjust,
  type ColorAdjustParameters,
} from '$lib/utils/color-adjust';

export type LocalToolMode = 'brush' | 'erase' | 'radial' | 'linear';

const createMaskId = () => `mask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const emptyBrushShape = (): Extract<LocalMaskShape, { type: 'brush' }> => ({
  type: 'brush',
  strokes: [],
  invert: false,
  mode: 'add',
});

export const createEmptyLocalMask = (name = 'Mask 1'): LocalMask => ({
  id: createMaskId(),
  name,
  opacity: 1,
  invert: false,
  adjustments: { ...DEFAULT_COLOR_ADJUST },
  shapes: [emptyBrushShape()],
});

class LocalManager implements EditToolManager {
  masks = $state<LocalMask[]>([]);
  activeMaskId = $state<string | null>(null);
  mode = $state<LocalToolMode>('brush');
  brushSize = $state(0.08);
  brushHardness = $state(0.55);
  brushOpacity = $state(0.85);
  showMaskOverlay = $state(true);
  /** Draft radial/linear placement while dragging on canvas */
  draftShape = $state<LocalMaskShape | null>(null);

  hasChanges = $derived(this.masks.some((mask) => this.maskHasContent(mask)));
  canReset = $derived(this.masks.length > 0);

  get activeMask(): LocalMask | null {
    return this.masks.find((mask) => mask.id === this.activeMaskId) ?? this.masks[0] ?? null;
  }

  get edits() {
    const masks = this.masks.filter((mask) => this.maskHasContent(mask));
    if (masks.length === 0) {
      return [];
    }

    return [
      {
        action: AssetEditAction.LocalAdjust,
        parameters: {
          masks: masks.map((mask) => ({
            ...mask,
            adjustments: normalizeColorAdjust(mask.adjustments),
            shapes: mask.shapes.filter((shape) => {
              if (shape.type === 'brush') {
                return shape.strokes.length > 0;
              }
              return true;
            }),
          })),
        },
      },
    ];
  }

  private maskHasContent(mask: LocalMask) {
    if (mask.shapes.length === 0) {
      return false;
    }
    return mask.shapes.some((shape) => {
      if (shape.type === 'brush') {
        return shape.strokes.some((stroke) => stroke.points.length > 0);
      }
      return true;
    });
  }

  async onActivate(_asset: AssetResponseDto, edits: EditActions): Promise<void> {
    const localEdit = edits.find((edit) => edit.action === AssetEditAction.LocalAdjust);
    if (localEdit?.action === AssetEditAction.LocalAdjust) {
      const parameters = localEdit.parameters as LocalAdjustParameters;
      this.masks = parameters.masks.map((mask) => ({
        ...mask,
        adjustments: normalizeColorAdjust(mask.adjustments),
      }));
      this.activeMaskId = this.masks[0]?.id ?? null;
    } else {
      this.masks = [];
      this.activeMaskId = null;
    }
    this.mode = 'brush';
    this.draftShape = null;
  }

  onDeactivate() {
    this.draftShape = null;
  }

  async resetAllChanges() {
    this.masks = [];
    this.activeMaskId = null;
    this.draftShape = null;
  }

  ensureActiveMask() {
    if (this.activeMask) {
      return this.activeMask;
    }
    const mask = createEmptyLocalMask(`Mask ${this.masks.length + 1}`);
    this.masks = [...this.masks, mask];
    this.activeMaskId = mask.id;
    return mask;
  }

  addMask() {
    const mask = createEmptyLocalMask(`Mask ${this.masks.length + 1}`);
    this.masks = [...this.masks, mask];
    this.activeMaskId = mask.id;
    this.mode = 'brush';
  }

  selectMask(id: string) {
    this.activeMaskId = id;
  }

  removeMask(id: string) {
    this.masks = this.masks.filter((mask) => mask.id !== id);
    if (this.activeMaskId === id) {
      this.activeMaskId = this.masks[0]?.id ?? null;
    }
  }

  setAdjustment(key: keyof ColorAdjustParameters, value: number) {
    const mask = this.ensureActiveMask();
    this.updateMask(mask.id, {
      adjustments: { ...mask.adjustments, [key]: value },
    });
  }

  setMaskOpacity(opacity: number) {
    const mask = this.ensureActiveMask();
    this.updateMask(mask.id, { opacity });
  }

  toggleMaskInvert() {
    const mask = this.ensureActiveMask();
    this.updateMask(mask.id, { invert: !mask.invert });
  }

  private updateMask(id: string, patch: Partial<LocalMask>) {
    this.masks = this.masks.map((mask) => (mask.id === id ? { ...mask, ...patch } : mask));
  }

  beginBrushStroke(point: BrushPoint, erase: boolean) {
    const mask = this.ensureActiveMask();
    const stroke: BrushStroke = { points: [point], erase };
    const hasBrush = mask.shapes.some((shape) => shape.type === 'brush');

    if (!hasBrush) {
      this.updateMask(mask.id, {
        shapes: [...mask.shapes, { ...emptyBrushShape(), strokes: [stroke] }],
      });
      return;
    }

    this.updateMask(mask.id, {
      shapes: mask.shapes.map((shape) =>
        shape.type === 'brush' ? { ...shape, strokes: [...shape.strokes, stroke] } : shape,
      ),
    });
  }

  appendBrushPoint(point: BrushPoint) {
    const mask = this.activeMask;
    if (!mask) {
      return;
    }
    const brush = mask.shapes.find((shape): shape is Extract<LocalMaskShape, { type: 'brush' }> => shape.type === 'brush');
    if (!brush || brush.strokes.length === 0) {
      return;
    }
    const strokes = brush.strokes.map((stroke, index) =>
      index === brush.strokes.length - 1 ? { ...stroke, points: [...stroke.points, point] } : stroke,
    );
    this.updateMask(mask.id, {
      shapes: mask.shapes.map((shape) => (shape.type === 'brush' ? { ...brush, strokes } : shape)),
    });
  }

  setRadialMask(shape: Extract<LocalMaskShape, { type: 'radial' }>) {
    const mask = this.ensureActiveMask();
    const withoutRadial = mask.shapes.filter((item) => item.type !== 'radial');
    this.updateMask(mask.id, { shapes: [...withoutRadial, shape] });
  }

  setLinearMask(shape: Extract<LocalMaskShape, { type: 'linear' }>) {
    const mask = this.ensureActiveMask();
    const withoutLinear = mask.shapes.filter((item) => item.type !== 'linear');
    this.updateMask(mask.id, { shapes: [...withoutLinear, shape] });
  }

  clearActiveMaskShapes() {
    const mask = this.activeMask;
    if (!mask) {
      return;
    }
    this.updateMask(mask.id, { shapes: [emptyBrushShape()], adjustments: { ...DEFAULT_COLOR_ADJUST } });
  }

  activeAdjustments(): ColorAdjustParameters {
    return normalizeColorAdjust(this.activeMask?.adjustments ?? DEFAULT_COLOR_ADJUST);
  }

  hasActiveAdjustments() {
    return !isDefaultColorAdjust(this.activeAdjustments());
  }
}

export const localManager = new LocalManager();
