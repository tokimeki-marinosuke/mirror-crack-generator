import { MAX_SEGMENTS, type CrackParams } from '../core/generateCracks';
import type { ImpactParams } from './editorState';

/** 次段階用の破断面設定。現段階ではUI・描画・既存Impactへ接続しない。 */
export type SurfaceSettings = { widthPercent: number; darkness: number; chipDensity: number };
export type FractureSettingsInput = {
  /** 未指定なら現行設定をそのまま使用。50が中立のマクロ。 */
  impactStrength?: number;
  /** プリセット・マクロより優先する個別設定。 */
  overrides?: Partial<ImpactParams>;
  surface?: Partial<SurfaceSettings>;
};
export type ResolvedFractureSettings = {
  geometry: CrackParams;
  line: Pick<ImpactParams, 'lineWidth' | 'opacity' | 'highlight'>;
  surface: SurfaceSettings;
  protection: { preserveCenter: boolean; boundaryTreatment: 'exact' };
};
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
function percent(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('強度と破断面設定は0〜100%で指定してください。');
}

/** 基準設定 → マクロ提案値 → 個別指定。中心密度0と線幅はマクロで上書きしない。 */
export function resolveFractureSettings(base: Readonly<ImpactParams>, input: FractureSettingsInput = {}): ResolvedFractureSettings {
  const macro = input.impactStrength;
  if (macro !== undefined) percent(macro);
  const suggestions = macro === undefined ? {} : {
    lengthPercent: clamp(base.lengthPercent * (0.75 + macro / 200), 10, 150),
    complexity: clamp(base.complexity + (macro - 50) * 0.5),
  };
  const resolved = { ...base, ...suggestions, ...input.overrides };
  const ranges: [keyof ImpactParams, number, number, boolean?][] = [
    ['radialCount', 4, 24, true], ['lengthPercent', 10, 150], ['complexity', 0, 100],
    ['concentricDensity', 0, 100], ['centerRadius', 0, 80], ['centerDensity', 0, 100],
    ['maxSegments', 1, MAX_SEGMENTS, true], ['lineWidth', 0.5, 6], ['opacity', 0, 100], ['highlight', 0, 100],
  ];
  for (const [key, min, max, integer] of ranges) {
    const value = resolved[key];
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`設定 ${key} は ${min}〜${max} の${integer ? '整数' : '有限数'}で指定してください。`);
    }
  }
  const surface = { widthPercent: 0, darkness: 60, chipDensity: macro ?? 0, ...input.surface };
  Object.values(surface).forEach(percent);
  const { lineWidth, opacity, highlight, ...geometry } = resolved;
  return { geometry, line: { lineWidth, opacity, highlight }, surface,
    protection: { preserveCenter: resolved.centerDensity === 0, boundaryTreatment: 'exact' } };
}
