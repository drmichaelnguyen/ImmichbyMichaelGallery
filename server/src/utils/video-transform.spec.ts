import { AssetEditAction, AssetEditActionItem, MirrorAxis } from 'src/dtos/editing.dto';
import { appendVideoTransformToTranscodeCommand, getVideoTransformFilters } from 'src/utils/video-transform';
import { describe, expect, it } from 'vitest';

describe('getVideoTransformFilters', () => {
  it('returns empty for no edits', () => {
    expect(getVideoTransformFilters([])).toEqual([]);
  });

  it('maps rotate and mirror', () => {
    const edits: AssetEditActionItem[] = [
      { action: AssetEditAction.Rotate, parameters: { angle: 90 } },
      { action: AssetEditAction.Mirror, parameters: { axis: MirrorAxis.Horizontal } },
    ];
    expect(getVideoTransformFilters(edits)).toEqual(['transpose=1', 'hflip']);
  });
});

describe('appendVideoTransformToTranscodeCommand', () => {
  it('prepends transform filters to existing -vf', () => {
    const command = {
      inputOptions: [],
      outputOptions: ['-vf', 'scale=720'],
      twoPass: false,
      progress: { frameCount: 1, percentInterval: 5 },
    };

    appendVideoTransformToTranscodeCommand(command, ['transpose=1']);

    expect(command.outputOptions).toEqual(['-vf', 'transpose=1,scale=720']);
  });
});
