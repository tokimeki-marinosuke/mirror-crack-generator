import { createGlassLight, DEFAULT_GLASS_MATERIAL, GLASS_MATERIAL_PRESETS, type GlassMaterialPreset, resolveGlassMaterial, type GlassLight, type GlassMaterialSettings } from '../core/glassMaterial';
import { prepareGlassGeometry, type GlassGeometryResult } from '../core/glassGeometry';
import type { Size } from '../core/geometry';
import type { Impact } from './editorState';
import { ShardImageState, type ShardComposition } from './shardImageState';
import { prepareGlassDetails, prepareGlassInteriors, type GlassDetail, type GlassInteriorResult } from '../core/glassTexture';
import type { ShardGraph } from '../core/shardRegions';
export type GlassMaterialFrame = Readonly<{ appearance?: 'legacy' | 'clean'; settings: GlassMaterialSettings; light: GlassLight; geometry: GlassGeometryResult; details?: readonly GlassDetail[]; interior?: GlassInteriorResult }>;
/** 画像全体の材質設定。光源・描画強度と幾何キャッシュを分離する。 */
export class GlassMaterialState {
  private selectedPreset: GlassMaterialPreset | undefined;
  private values = DEFAULT_GLASS_MATERIAL;
  private sharedLight = createGlassLight(this.values.lightDirection);
  private inputs: readonly Impact[] = [];
  private graph: ShardComposition | undefined;
  private result?: GlassGeometryResult;
  private builds = 0;
  private details: GlassDetail[] = [];
  private readonly interiorSource: ShardImageState;
  private interiorGraph?: ShardGraph;
  private interiorResult?: GlassInteriorResult;
  private interiorSeed?: number;
  constructor(private readonly size: Size, readonly appearance: 'legacy' | 'clean' = 'legacy') { this.interiorSource = new ShardImageState(size); }
  get preset(): GlassMaterialPreset | undefined { return this.selectedPreset; }
  applyPreset(id: GlassMaterialPreset): void {
    if (!Object.hasOwn(GLASS_MATERIAL_PRESETS, id)) throw new Error('材質プリセットが不正です。');
    this.update(GLASS_MATERIAL_PRESETS[id].settings); this.selectedPreset = id;
  }
  reset(): void { this.update(DEFAULT_GLASS_MATERIAL); }
  get settings(): GlassMaterialSettings { return this.values; }
  get light(): GlassLight { return this.sharedLight; }
  get preparations(): number { return this.builds; }
  update(patch: Partial<GlassMaterialSettings>): void {
    const next = resolveGlassMaterial({ ...this.values, ...patch });
    if (next.lightDirection !== this.values.lightDirection) this.sharedLight = createGlassLight(next.lightDirection);
    this.values = next; this.selectedPreset = undefined;
  }
  prepare(impacts: readonly Impact[], composition?: ShardComposition): GlassMaterialFrame {
    const visible = impacts.filter(i => i.params.opacity > 0);
    const graph = composition?.extraction.ok ? composition.extraction.graph : undefined;
    const oldGraph = this.graph?.extraction.ok ? this.graph.extraction.graph : undefined;
    if (!this.result || graph !== oldGraph || visible.length !== this.inputs.length || visible.some((i, n) => i.id !== this.inputs[n].id || i.pattern !== this.inputs[n].pattern || this.appearance === 'legacy' && i.fracture !== this.inputs[n].fracture)) {
      this.result = prepareGlassGeometry(this.appearance === 'clean' ? visible.map(({ id, pattern }) => ({ id, pattern })) : visible, this.size, graph);
      this.details = this.result.ok ? prepareGlassDetails(this.result.geometry, new Map(visible.map(i => [i.id, i.seed]))) : [];
      this.inputs = visible.slice(); this.graph = composition; this.builds++;
    }
    let interior: GlassInteriorResult | undefined;
    if (this.result.ok && this.values.enabled && this.values.interiorReflection > 0) {
      const source = composition ?? this.interiorSource.resolve(visible, true);
      if (source?.extraction.ok) {
        const graph = source.extraction.graph;
        let seed = 2166136261; for (const impact of visible) seed = Math.imul(seed ^ (impact.seed >>> 0), 16777619);
        if (graph !== this.interiorGraph || seed !== this.interiorSeed || !this.interiorResult) {
          this.interiorResult = prepareGlassInteriors(graph, this.size, seed >>> 0, visible.flatMap(i => {
            const core = i.pattern.topology?.regions.protectedCore;
            return core ? [core] : (i.pattern.protectedRadius ?? 0) > 0 ? [{ kind: 'circle' as const, origin: i.origin, radius: i.pattern.protectedRadius! }] : [];
          }));
          this.interiorGraph = graph; this.interiorSeed = seed;
        }
        interior = this.interiorResult;
      } else interior = { ok: false, message: '破片を抽出できないため内部反射を省略しました。' };
    }
    return { appearance: this.appearance, settings: this.values, light: this.sharedLight, geometry: this.result, details: this.details, interior };
  }
}
