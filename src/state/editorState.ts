import { EXPANDED_LIMITS } from '../core/effectRanges';
import { GlassMaterialState } from './glassMaterialState';
import { ShardImageState } from './shardImageState';
import { generateFractureSurface, type FractureGeometry } from '../core/generateFractureSurface';
import { DEFAULT_SURFACE_SETTINGS, resolveFractureSettings, type SurfaceSettings } from './fractureSettings';
import { DEFAULT_CRACK_PARAMS, generateCracks, type CrackParams, type CrackPattern } from '../core/generateCracks';
import type { Point, Size } from '../core/geometry';

import type { StylePreset } from '../render/crackStyle';
export type { StylePreset } from '../render/crackStyle';
export type ImpactParams = CrackParams & { lineWidth: number; opacity: number; highlight: number };
export type Impact = {
  id: number;
  origin: Point;
  seed: number;
  preset: StylePreset;
  params: ImpactParams;
  pattern: CrackPattern;
  surface?: SurfaceSettings;
  effectPreset?: EffectPreset;
  impactStrength?: number;
  overrides?: Partial<ImpactParams>;
  surfaceOverrides?: Partial<SurfaceSettings>;
  fracture?: FractureGeometry;
};
export const PRESETS: Record<StylePreset, Readonly<ImpactParams>> = {
  realistic: Object.freeze({ ...DEFAULT_CRACK_PARAMS, radialCount: 16, complexity: 75,
    concentricDensity: 50, centerRadius: 20, centerDensity: 40, lineWidth: 1, opacity: 85, highlight: 25 }),
  anime: Object.freeze({ ...DEFAULT_CRACK_PARAMS, radialCount: 8, complexity: 25,
    concentricDensity: 25, centerRadius: 25, centerDensity: 25, lineWidth: 3, opacity: 100, highlight: 65 }),
};
export const EFFECT_PRESETS = {
  delicate: { label: '繊細な放射型', style: 'realistic', params: { radialCount: 10, lengthPercent: 110, complexity: 40, concentricDensity: 15, centerDensity: 0, lineWidth: 0.8, highlight: 30 }, surface: { widthPercent: 10, darkness: 30, chipDensity: 5 } },
  web: { label: '蜘蛛の巣型', style: 'realistic', params: { radialCount: 16, lengthPercent: 100, complexity: 60, concentricDensity: 85, centerDensity: 25, lineWidth: 1, highlight: 50 }, surface: { widthPercent: 20, darkness: 45, chipDensity: 15 } },
  shattered: { label: '激しい破砕型', style: 'anime', params: { radialCount: 18, lengthPercent: 110, complexity: 85, concentricDensity: 60, centerDensity: 90, lineWidth: 1.8, highlight: 85 }, surface: { widthPercent: 65, darkness: 85, chipDensity: 75 } },
} as const;
export type EffectPreset = keyof typeof EFFECT_PRESETS;
const geometryKeys = ['radialCount', 'lengthPercent', 'complexity', 'concentricDensity', 'centerRadius', 'centerDensity', 'maxSegments'] as const;

/** 編集状態はUI/Canvasに依存せず、変更した衝撃点だけを再生成する。 */
export class EditorState {
  private items: Impact[] = [];
  private selected: number | null = null;
  private nextId = 1;
  readonly shards: ShardImageState;
  readonly glass: GlassMaterialState;
  constructor(readonly size: Size, private readonly realisticPreset: Readonly<ImpactParams> = PRESETS.realistic, extended = false) { this.shards = new ShardImageState(size, {}, extended ? 'wide' : 'expanded'); this.glass = new GlassMaterialState(size, 'clean', extended); this.glass.applyPreset('cinematic'); }
  get impacts(): readonly Impact[] { return this.items; }
  get selectedId(): number | null { return this.selected; }
  get active(): Impact | undefined { return this.items.find(impact => impact.id === this.selected); }

  select(id: number): void {
    if (this.items.some(impact => impact.id === id)) this.selected = id;
  }
  add(origin: Point): Impact {
    const seed = 1;
    const params = { ...this.realisticPreset };
    const impact: Impact = { id: this.nextId, origin: { ...origin }, seed, preset: 'realistic', params,
      pattern: generateCracks(this.size, origin, seed, params) };
    impact.surface = { ...DEFAULT_SURFACE_SETTINGS };
    impact.fracture = generateFractureSurface(impact.pattern, this.size, 0);
    this.nextId++;
    this.items = [...this.items, impact];
    this.selected = impact.id;
    return impact;
  }
  update(patch: { origin?: Point; seed?: number; preset?: StylePreset; params?: Partial<ImpactParams> }): void {
    const current = this.active;
    if (!current) return;
    const params = { ...(patch.preset ? (patch.preset === 'realistic' ? this.realisticPreset : PRESETS[patch.preset]) : current.params), ...patch.params };
    if (!Number.isFinite(params.lineWidth) || params.lineWidth < 0.5 || params.lineWidth > EXPANDED_LIMITS.lineWidth ||
        !Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 100 ||
        !Number.isFinite(params.highlight) || params.highlight < 0 || params.highlight > 100) {
      throw new Error('線幅は0.5〜9px、不透明度・ハイライトは0〜100%で指定してください。');
    }
    const origin = patch.origin ? { ...patch.origin } : current.origin;
    const seed = patch.seed ?? current.seed;
    const geometryChanged = seed !== current.seed || origin.x !== current.origin.x || origin.y !== current.origin.y ||
      geometryKeys.some(key => params[key] !== current.params[key]);
    const pattern = geometryChanged ? generateCracks(this.size, origin, seed, params) : current.pattern;
    const fracture = geometryChanged && current.surface
      ? generateFractureSurface(pattern, this.size, current.surface.widthPercent, current.surface.chipDensity) : current.fracture;
    const next = { ...current, origin, seed, params, preset: patch.preset ?? current.preset, pattern, fracture,
      overrides: { ...current.overrides, ...patch.params } };
    this.items = this.items.map(impact => impact.id === current.id ? next : impact);
  }
  /** 幅・欠け密度変更だけ破断面を再生成。暗部・反射・線幅で中心線を再生成しない。 */
  updateSurface(patch: Partial<SurfaceSettings>): void {
    const current = this.active;
    if (!current) return;
    const surface = resolveFractureSettings(current.params, {
      surface: { ...DEFAULT_SURFACE_SETTINGS, ...current.surface, ...patch },
    }).surface;
    const fracture = surface.widthPercent !== (current.surface?.widthPercent ?? 0) || surface.chipDensity !== (current.surface?.chipDensity ?? 0) || !current.fracture
      ? generateFractureSurface(current.pattern, this.size, surface.widthPercent, surface.chipDensity) : current.fracture;
    this.items = this.items.map(impact => impact.id === current.id ? { ...current, surface, fracture, surfaceOverrides: { ...current.surfaceOverrides, ...patch } } : impact);
  }
  /** プリセット選択は個別調整をリセット。位置とシードは保持する。 */
  applyPreset(id: EffectPreset | StylePreset): void {
    if (!this.active) return;
    const effect = id === 'realistic' || id === 'anime' ? undefined : EFFECT_PRESETS[id];
    const style = effect?.style ?? id as StylePreset;
    this.update({ preset: style, params: effect ? { ...PRESETS[style], ...effect.params } : undefined });
    this.updateSurface(effect?.surface ?? DEFAULT_SURFACE_SETTINGS);
    const current = this.active!;
    this.items = this.items.map(item => item.id === current.id ? { ...current,
      effectPreset: effect ? id as EffectPreset : undefined, impactStrength: 50,
      overrides: {}, surfaceOverrides: {} } : item);
  }
  /** 常にプリセット基準から計算し、繰り返し操作による累積変化を避ける。 */
  updateStrength(value: number): void {
    const current = this.active;
    if (!current) return;
    const effect = current.effectPreset ? EFFECT_PRESETS[current.effectPreset] : undefined;
    const base = { ...(effect || current.preset !== 'realistic' ? PRESETS[current.preset] : this.realisticPreset), ...effect?.params };
    const baseSurface = effect?.surface ?? DEFAULT_SURFACE_SETTINGS;
    const resolved = resolveFractureSettings(base, { impactStrength: value, overrides: current.overrides,
      surface: { ...baseSurface, chipDensity: Math.max(0, Math.min(100, baseSurface.chipDensity + value - 50)), ...current.surfaceOverrides } });
    const params = { ...resolved.geometry, ...resolved.line };
    const geometryChanged = geometryKeys.some(key => params[key] !== current.params[key]);
    const pattern = geometryChanged ? generateCracks(this.size, current.origin, current.seed, params) : current.pattern;
    const surface = resolved.surface;
    const changed = geometryChanged || surface.widthPercent !== current.surface?.widthPercent || surface.chipDensity !== current.surface?.chipDensity;
    const fracture = changed ? generateFractureSurface(pattern, this.size, surface.widthPercent, surface.chipDensity) : current.fracture;
    this.items = this.items.map(item => item.id === current.id ? { ...current, params, pattern, surface, fracture, impactStrength: value } : item);
  }
  /** Restore appearance defaults without renumbering, moving or removing impacts. */
  resetPoints(): void {
    // Prepare the entire replacement first so a generation failure cannot leave a partial reset.
    const restored = this.items.map(impact => {
      const params = { ...this.realisticPreset }, surface = { ...DEFAULT_SURFACE_SETTINGS };
      const pattern = generateCracks(this.size, impact.origin, 1, params);
      return { id: impact.id, origin: { ...impact.origin }, seed: 1, preset: 'realistic' as const,
        params, surface, pattern, fracture: generateFractureSurface(pattern, this.size, surface.widthPercent, surface.chipDensity),
        impactStrength: 50, overrides: {}, surfaceOverrides: {} };
    });
    this.items = restored;
  }
  regenerate(): void {
    if (this.active) this.update({ seed: ((this.active.seed >>> 0) + 1) >>> 0 });
  }
  remove(): void {
    const index = this.items.findIndex(impact => impact.id === this.selected);
    if (index < 0) return;
    this.items = this.items.filter(impact => impact.id !== this.selected);
    this.selected = this.items[Math.min(index, this.items.length - 1)]?.id ?? null;
  }
}
