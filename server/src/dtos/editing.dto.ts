import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export enum AssetEditAction {
  Crop = 'crop',
  Rotate = 'rotate',
  Mirror = 'mirror',
  ColorAdjust = 'colorAdjust',
  LocalAdjust = 'localAdjust',
}

export const AssetEditActionSchema = z
  .enum(AssetEditAction)
  .describe('Type of edit action to perform')
  .meta({ id: 'AssetEditAction' });

export enum MirrorAxis {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

const MirrorAxisSchema = z.enum(['horizontal', 'vertical']).describe('Axis to mirror along').meta({ id: 'MirrorAxis' });

const CropParametersSchema = z
  .object({
    x: z.int().min(0).describe('Top-Left X coordinate of crop'),
    y: z.int().min(0).describe('Top-Left Y coordinate of crop'),
    width: z.int().min(1).describe('Width of the crop'),
    height: z.int().min(1).describe('Height of the crop'),
  })
  .meta({ id: 'CropParameters' });

const RotateParametersSchema = z
  .object({
    angle: z
      .number()
      .refine((v) => [0, 90, 180, 270].includes(v), {
        error: 'Angle must be one of the following values: 0, 90, 180, 270',
      })
      .describe('Rotation angle in degrees'),
  })
  .meta({ id: 'RotateParameters' });

const MirrorParametersSchema = z
  .object({
    axis: MirrorAxisSchema,
  })
  .meta({ id: 'MirrorParameters' });

const ColorAdjustValueSchema = z
  .number()
  .min(-100)
  .max(100)
  .describe('Adjustment amount from -100 to 100 (0 = no change)');

const ColorAdjustParametersSchema = z
  .object({
    brightness: ColorAdjustValueSchema,
    contrast: ColorAdjustValueSchema,
    saturation: ColorAdjustValueSchema,
    exposure: ColorAdjustValueSchema,
    warmth: ColorAdjustValueSchema,
    highlights: ColorAdjustValueSchema.default(0),
    shadows: ColorAdjustValueSchema.default(0),
    vibrance: ColorAdjustValueSchema.default(0),
    tint: ColorAdjustValueSchema.default(0),
    clarity: ColorAdjustValueSchema.default(0),
    fade: ColorAdjustValueSchema.default(0),
  })
  .meta({ id: 'ColorAdjustParameters' });

export type ColorAdjustParameters = z.infer<typeof ColorAdjustParametersSchema>;

const BrushPointSchema = z
  .object({
    x: z.number().min(0).max(1).describe('Normalized X (0-1) in post-geometry image space'),
    y: z.number().min(0).max(1).describe('Normalized Y (0-1) in post-geometry image space'),
    size: z.number().min(0.001).max(1).describe('Brush diameter as fraction of min(image width, height)'),
    hardness: z.number().min(0).max(1).describe('0 = soft edge, 1 = hard edge'),
    opacity: z.number().min(0).max(1).describe('Stamp opacity'),
  })
  .meta({ id: 'BrushPoint' });

const BrushStrokeSchema = z
  .object({
    points: z.array(BrushPointSchema).min(1).max(5000),
    erase: z.boolean().default(false),
  })
  .meta({ id: 'BrushStroke' });

const MaskCombineModeSchema = z.enum(['add', 'subtract']).default('add');

const BrushShapeSchema = z
  .object({
    type: z.literal('brush'),
    strokes: z.array(BrushStrokeSchema).min(1).max(200),
    invert: z.boolean().default(false),
    mode: MaskCombineModeSchema,
  })
  .meta({ id: 'BrushMaskShape' });

const RadialShapeSchema = z
  .object({
    type: z.literal('radial'),
    cx: z.number().min(0).max(1),
    cy: z.number().min(0).max(1),
    radiusX: z.number().min(0.001).max(2),
    radiusY: z.number().min(0.001).max(2),
    feather: z.number().min(0).max(1).default(0.4),
    invert: z.boolean().default(false),
    mode: MaskCombineModeSchema,
  })
  .meta({ id: 'RadialMaskShape' });

const LinearShapeSchema = z
  .object({
    type: z.literal('linear'),
    x1: z.number().min(0).max(1),
    y1: z.number().min(0).max(1),
    x2: z.number().min(0).max(1),
    y2: z.number().min(0).max(1),
    feather: z.number().min(0).max(1).default(0.35),
    invert: z.boolean().default(false),
    mode: MaskCombineModeSchema,
  })
  .meta({ id: 'LinearMaskShape' });

const LocalMaskShapeSchema = z
  .discriminatedUnion('type', [BrushShapeSchema, RadialShapeSchema, LinearShapeSchema])
  .meta({ id: 'LocalMaskShape' });

const LocalMaskSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().max(80).optional(),
    opacity: z.number().min(0).max(1).default(1),
    invert: z.boolean().default(false),
    adjustments: ColorAdjustParametersSchema,
    shapes: z.array(LocalMaskShapeSchema).min(1).max(50),
  })
  .meta({ id: 'LocalMask' });

const LocalAdjustParametersSchema = z
  .object({
    masks: z.array(LocalMaskSchema).min(1).max(20),
  })
  .meta({ id: 'LocalAdjustParameters' });

export type LocalMaskShape = z.infer<typeof LocalMaskShapeSchema>;
export type LocalMask = z.infer<typeof LocalMaskSchema>;
export type LocalAdjustParameters = z.infer<typeof LocalAdjustParametersSchema>;

// TODO: ideally we would use the discriminated union directly in the future not only for type support but also for validation and openapi generation
const __AssetEditActionItemSchema = z.discriminatedUnion('action', [
  z.object({ action: AssetEditActionSchema.extract(['Crop']), parameters: CropParametersSchema }),
  z.object({ action: AssetEditActionSchema.extract(['Rotate']), parameters: RotateParametersSchema }),
  z.object({ action: AssetEditActionSchema.extract(['Mirror']), parameters: MirrorParametersSchema }),
  z.object({ action: AssetEditActionSchema.extract(['ColorAdjust']), parameters: ColorAdjustParametersSchema }),
  z.object({ action: AssetEditActionSchema.extract(['LocalAdjust']), parameters: LocalAdjustParametersSchema }),
]);

const AssetEditParametersSchema = z
  .union(
    [
      CropParametersSchema,
      RotateParametersSchema,
      MirrorParametersSchema,
      ColorAdjustParametersSchema,
      LocalAdjustParametersSchema,
    ],
    {
      error: getExpectedKeysByActionMessage,
    },
  )
  .describe('List of edit actions to apply (crop, rotate, mirror, colorAdjust, or localAdjust)');

const actionParameterMap = {
  [AssetEditAction.Crop]: CropParametersSchema,
  [AssetEditAction.Rotate]: RotateParametersSchema,
  [AssetEditAction.Mirror]: MirrorParametersSchema,
  [AssetEditAction.ColorAdjust]: ColorAdjustParametersSchema,
  [AssetEditAction.LocalAdjust]: LocalAdjustParametersSchema,
} as const;

function getExpectedKeysByActionMessage(): string {
  const expectedByAction = Object.entries(actionParameterMap)
    .map(([action, schema]) => `${action}: [${Object.keys(schema.shape).join(', ')}]`)
    .join('; ');

  return `Invalid parameters for action, expected keys by action: ${expectedByAction}`;
}

function isParametersValidForAction(edit: z.infer<typeof AssetEditActionItemSchema>): boolean {
  return actionParameterMap[edit.action].safeParse(edit.parameters).success;
}

const AssetEditActionItemSchema = z
  .object({
    action: AssetEditActionSchema,
    parameters: AssetEditParametersSchema,
  })
  .superRefine((edit, ctx) => {
    if (!isParametersValidForAction(edit)) {
      ctx.addIssue({
        code: 'custom',
        path: ['parameters'],
        message: `Invalid parameters for action '${edit.action}', expecting keys: ${Object.keys(actionParameterMap[edit.action].shape).join(', ')}`,
      });
    }
  })
  .meta({ id: 'AssetEditActionItemDto' });

export type AssetEditActionItem = z.infer<typeof __AssetEditActionItemSchema>;
export type AssetEditParameters = AssetEditActionItem['parameters'];

function uniqueEditActions(edits: z.infer<typeof AssetEditActionItemSchema>[]): boolean {
  const keys = new Set<string>();
  for (const edit of edits) {
    const key = edit.action === 'mirror' ? `mirror-${JSON.stringify(edit.parameters)}` : edit.action;
    if (keys.has(key)) {
      return false;
    }
    keys.add(key);
  }
  return true;
}

const AssetEditsCreateSchema = z
  .object({
    edits: z
      .array(AssetEditActionItemSchema)
      .min(1)
      .describe('List of edit actions to apply (crop, rotate, mirror, or colorAdjust)')
      .refine(uniqueEditActions, { error: 'Duplicate edit actions are not allowed' }),
  })
  .meta({ id: 'AssetEditsCreateDto' });

const AssetEditActionItemResponseSchema = AssetEditActionItemSchema.extend({
  id: z.uuidv4().describe('Asset edit ID'),
}).meta({ id: 'AssetEditActionItemResponseDto' });

const AssetEditsResponseSchema = z
  .object({
    assetId: z.uuidv4().describe('Asset ID these edits belong to'),
    edits: z.array(AssetEditActionItemResponseSchema).describe('List of edit actions applied to the asset'),
  })
  .meta({ id: 'AssetEditsResponseDto' });

export class AssetEditActionItemResponseDto extends createZodDto(AssetEditActionItemResponseSchema) {}
export class AssetEditsCreateDto extends createZodDto(AssetEditsCreateSchema) {}
export class AssetEditsResponseDto extends createZodDto(AssetEditsResponseSchema) {}
export type CropParameters = z.infer<typeof CropParametersSchema>;
