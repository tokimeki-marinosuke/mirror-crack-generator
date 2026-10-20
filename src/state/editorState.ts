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
};
export const PRESETS: Record<StylePreset, Readonly<ImpactParams>> = {
  realistic: Object.freeze({ ...DEFAULT_CRACK_PARAMS, radialCount: 16, complexity: 75,
    concentricDensity: 50, centerRadius: 20, centerDensity: 40, lineWidth: 1, opacity: 85, highlight: 25 }),
  anime: Object.freeze({ ...DEFAULT_CRACK_PARAMS, radialCount: 8, complexity: 25,
    concentricDensity: 25, centerRadius: 25, centerDensity: 25, lineWidth: 3, opacity: 100, highlight: 65 }),
};
const geometryKeys = ['radialCount', 'lengthPercent', 'complexity', 'concentricDensity', 'centerRadius', 'centerDensity', 'maxSegments'] as const;

/** 編集状態はUI/Canvasに依存せず、変更した衝撃点だけを再生成する。 */
export class EditorState {
  private items: Impact[] = [];
  private selected: number | null = null;
  private nextId = 1;
  constructor(readonly size: Size) {}
  get impacts(): readonly Impact[] { return this.items; }
  get selectedId(): number | null { return this.selected; }
  get active(): Impact | undefined { return this.items.find(impact => impact.id === this.selected); }

  select(id: number): void {
    if (this.items.some(impact => impact.id === id)) this.selected = id;
  }
  add(origin: Point): Impact {
    const seed = 1;
    const params = { ...PRESETS.realistic };
    const impact: Impact = { id: this.nextId, origin: { ...origin }, seed, preset: 'realistic', params,
      pattern: generateCracks(this.size, origin, seed, params) };
    this.nextId++;
    this.items = [...this.items, impact];
    this.selected = impact.id;
    return impact;
  }
  update(patch: { origin?: Point; seed?: number; preset?: StylePreset; params?: Partial<ImpactParams> }): void {
    const current = this.active;
    if (!current) return;
    const params = { ...(patch.preset ? PRESETS[patch.preset] : current.params), ...patch.params };
    if (!Number.isFinite(params.lineWidth) || params.lineWidth < 0.5 || params.lineWidth > 6 ||
        !Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 100 ||
        !Number.isFinite(params.highlight) || params.highlight < 0 || params.highlight > 100) {
      throw new Error('線幅は0.5〜6px、不透明度・ハイライトは0〜100%で指定してください。');
    }
    const origin = patch.origin ? { ...patch.origin } : current.origin;
    const seed = patch.seed ?? current.seed;
    const geometryChanged = seed !== current.seed || origin.x !== current.origin.x || origin.y !== current.origin.y ||
      geometryKeys.some(key => params[key] !== current.params[key]);
    const pattern = geometryChanged ? generateCracks(this.size, origin, seed, params) : current.pattern;
    const next = { ...current, origin, seed, params, preset: patch.preset ?? current.preset, pattern };
    this.items = this.items.map(impact => impact.id === current.id ? next : impact);
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
