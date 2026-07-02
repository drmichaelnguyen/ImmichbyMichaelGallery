import { AssetEditAction, AssetEditActionItem } from 'src/dtos/editing.dto';
import { TranscodeCommand } from 'src/types';

/** FFmpeg video filters for rotate / mirror edits (crop is not supported for video). */
export const getVideoTransformFilters = (edits: AssetEditActionItem[]): string[] => {
  const filters: string[] = [];

  for (const edit of edits) {
    if (edit.action === AssetEditAction.Rotate) {
      const angle = ((edit.parameters.angle % 360) + 360) % 360;
      if (angle === 90) {
        filters.push('transpose=1');
      } else if (angle === 180) {
        filters.push('transpose=1', 'transpose=1');
      } else if (angle === 270) {
        filters.push('transpose=2');
      }
    } else if (edit.action === AssetEditAction.Mirror) {
      filters.push(edit.parameters.axis === 'horizontal' ? 'hflip' : 'vflip');
    }
  }

  return filters;
};

export const appendVideoTransformToTranscodeCommand = (
  command: TranscodeCommand,
  transformFilters: string[],
): TranscodeCommand => {
  if (transformFilters.length === 0) {
    return command;
  }

  const transformChain = transformFilters.join(',');
  const vfIndex = command.outputOptions.indexOf('-vf');

  if (vfIndex >= 0 && vfIndex + 1 < command.outputOptions.length) {
    const existing = command.outputOptions[vfIndex + 1];
    command.outputOptions[vfIndex + 1] = `${transformChain},${existing}`;
  } else {
    command.outputOptions.push('-vf', transformChain);
  }

  return command;
};

export const assertVideoEditsSupported = (edits: AssetEditActionItem[]): void => {
  for (const edit of edits) {
    if (edit.action === AssetEditAction.Crop) {
      throw new Error('Crop is not supported for videos');
    }
    if (edit.action === AssetEditAction.ColorAdjust) {
      throw new Error('Color adjustments are not supported for videos');
    }
  }
};
