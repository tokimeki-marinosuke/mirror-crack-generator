import type { Point } from './geometry';
export type Vector3 = Readonly<{ x: number; y: number; z: number }>;
export type GlassMaterialSettings = Readonly<{
  enabled: boolean;
  thickness: number;
  edgeReflection: number;
  interiorReflection: number;
  microDetail: number;
  /** 画像座標で0=右、90=下。左上は225度。強度ではない。 */
  lightDirection: number;
}>;
/** 低レベルの初期値は無効・全0。製品のシネマティック初期化はEditorStateが行う。 */
export const DEFAULT_GLASS_MATERIAL: GlassMaterialSettings = Object.freeze({
  enabled: false, thickness: 0, edgeReflection: 0, interiorReflection: 0, microDetail: 0, lightDirection: 225,
});
export type GlassLight = Readonly<{ angle: number; screenDirection: Readonly<Point>; direction: Vector3 }>;
export function resolveGlassMaterial(patch: Partial<GlassMaterialSettings> = {}): GlassMaterialSettings {
  const result = { ...DEFAULT_GLASS_MATERIAL, ...patch };
  if (typeof result.enabled !== 'boolean' || ![result.thickness, result.edgeReflection, result.interiorReflection, result.microDetail].every(v => Number.isFinite(v) && v >= 0 && v <= 100) || !Number.isFinite(result.lightDirection)) throw new Error('材質設定が不正です。');
  result.lightDirection = ((result.lightDirection % 360) + 360) % 360;
  return Object.freeze(result);
}
export function isGlassMaterialActive(settings: GlassMaterialSettings): boolean {
  return settings.enabled && [settings.thickness, settings.edgeReflection, settings.interiorReflection, settings.microDetail].some(v => v > 0);
}
/** スタイライズ用の共通光源。zは擬似的な高さであり物理光学ではない。 */
export function createGlassLight(angle: number): GlassLight {
  if (!Number.isFinite(angle)) throw new Error('光源方向は有限数で指定してください。');
  const normalized = ((angle % 360) + 360) % 360, radians = normalized * Math.PI / 180;
  const x = Math.cos(radians), y = Math.sin(radians), slope = Math.SQRT1_2;
  return Object.freeze({ angle: normalized, screenDirection: Object.freeze({ x, y }), direction: Object.freeze({ x: x * slope, y: y * slope, z: slope }) });
}

/** Material presets change shading only; geometry, gaps, line width and image transforms stay independent. */
export const GLASS_MATERIAL_PRESETS = Object.freeze({
  cinematic: Object.freeze({ label: 'シネマティック', settings: resolveGlassMaterial({ enabled: true, thickness: 32, edgeReflection: 60, interiorReflection: 25, microDetail: 15, lightDirection: 225 }) }),
  real: Object.freeze({ label: 'リアル', settings: resolveGlassMaterial({ enabled: true, thickness: 12, edgeReflection: 30, interiorReflection: 12, microDetail: 5, lightDirection: 225 }) }),
  dramatic: Object.freeze({ label: 'ドラマティック', settings: resolveGlassMaterial({ enabled: true, thickness: 65, edgeReflection: 90, interiorReflection: 45, microDetail: 55, lightDirection: 225 }) }),
});
export type GlassMaterialPreset = keyof typeof GLASS_MATERIAL_PRESETS;
