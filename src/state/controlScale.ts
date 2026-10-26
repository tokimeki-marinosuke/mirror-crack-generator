import { EXPANDED_LIMITS } from '../core/effectRanges';
import { APPLICATION_IMPACT_DEFAULTS as impact, APPLICATION_SHARD_DEFAULTS as shard } from './applicationDefaults';
import { GLASS_MATERIAL_PRESETS } from '../core/glassMaterial';
export type ControlScale = Readonly<{ min: number; baseline: number; max: number; integer?: boolean }>;
const scale = (baseline: number, max: number, min = 0, integer = false): ControlScale => Object.freeze({ min, baseline, max, integer });
const glass = GLASS_MATERIAL_PRESETS.cinematic.settings;
/** Only the control position is normalized. Models keep their physical values. */
export const MATERIAL_SCALES = Object.freeze({
  thickness: scale(glass.thickness, 130), reflectionWidth: scale(glass.reflectionWidth!, 130),
  edgeReflection: scale(glass.edgeReflection, 136), interiorReflection: scale(glass.interiorReflection, 120), microDetail: scale(glass.microDetail, 100),
});
export const SHARD_SCALES = Object.freeze({ displacement: scale(shard.displacement, 200), rotation: scale(shard.rotation, 200), reflection: scale(shard.reflection, 200), gap: scale(0, 100) });
export const POINT_SCALES = Object.freeze({
  radialCount: scale(impact.radialCount, 45, 4, true), lengthPercent: scale(impact.lengthPercent, 300, 10),
  complexity: scale(impact.complexity, EXPANDED_LIMITS.complexity), concentricDensity: scale(impact.concentricDensity, EXPANDED_LIMITS.concentricDensity),
  centerRadius: scale(impact.centerRadius, 80), centerDensity: scale(impact.centerDensity, 100),
  lineWidth: scale(impact.lineWidth, 9, .5), opacity: scale(impact.opacity, 100),
});
export const DARKNESS_SCALE = scale(60, 100);
function validate(value: number) { if (!Number.isFinite(value)) throw new Error('調整値が不正です。'); }
export function controlValue(position: number, s: ControlScale): number {
  validate(position); if (position < 0 || position > 100) throw new Error('つまみは0〜100で指定してください。');
  if (position === 50 && s.baseline !== s.min) return s.baseline;
  // A zero default (gap) stays at the left endpoint, avoiding a useless negative half-range.
  const value = s.baseline === s.min ? s.min + (s.max - s.min) * position / 100
    : position <= 50 ? s.min + (s.baseline - s.min) * position / 50 : s.baseline + (s.max - s.baseline) * (position - 50) / 50;
  return s.integer ? Math.round(value) : value;
}
export function controlPosition(value: number, s: ControlScale): number {
  validate(value);
  const position = s.baseline === s.min ? (value - s.min) / (s.max - s.min) * 100
    : value <= s.baseline ? (value - s.min) / (s.baseline - s.min) * 50 : 50 + (value - s.baseline) / (s.max - s.baseline) * 50;
  return Math.max(0, Math.min(100, position));
}
