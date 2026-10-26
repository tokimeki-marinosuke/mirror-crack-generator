import { effectivePercent } from '../core/effectRanges';
import type { Size } from '../core/geometry';
import { EditorState, PRESETS, type ImpactParams } from './editorState';
import type { ShardImageSettings } from './shardImageState';
/** The chosen release look. Intensity values are converted from the visible UI scale. */
export const APPLICATION_IMPACT_DEFAULTS: Readonly<ImpactParams> = Object.freeze({
  ...PRESETS.realistic, radialCount: 29, lengthPercent: 192,
  complexity: effectivePercent(74), concentricDensity: effectivePercent(97),
  centerRadius: 7, centerDensity: 4, lineWidth: 1, opacity: 85,
});
export const APPLICATION_SHARD_DEFAULTS: Readonly<ShardImageSettings> = Object.freeze({
  displacement: 100, rotation: 100, reflection: 100, gap: 0,
});
/** A new image gets these values. Low-level EditorState and zero-reset APIs stay compatible. */
export function createApplicationEditor(size: Size): EditorState {
  const state = new EditorState(size, APPLICATION_IMPACT_DEFAULTS, true);
  state.shards.update(APPLICATION_SHARD_DEFAULTS);
  return state;
}
