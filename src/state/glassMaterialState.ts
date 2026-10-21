import { createGlassLight, DEFAULT_GLASS_MATERIAL, resolveGlassMaterial, type GlassLight, type GlassMaterialSettings } from '../core/glassMaterial';
import { prepareGlassGeometry, type GlassGeometryResult } from '../core/glassGeometry';
import type { Size } from '../core/geometry';
import type { Impact } from './editorState';
import type { ShardComposition } from './shardImageState';
export type GlassMaterialFrame = Readonly<{ settings: GlassMaterialSettings; light: GlassLight; geometry: GlassGeometryResult }>;
/** 第1段階は開発用。既存EditorStateには組み込まず、光源と幾何キャッシュを分離する。 */
export class GlassMaterialState {
  private values = DEFAULT_GLASS_MATERIAL;
  private sharedLight = createGlassLight(this.values.lightDirection);
  private inputs: readonly Impact[] = [];
  private graph: ShardComposition | undefined;
  private result?: GlassGeometryResult;
  private builds = 0;
  constructor(private readonly size: Size) {}
  get settings(): GlassMaterialSettings { return this.values; }
  get light(): GlassLight { return this.sharedLight; }
  get preparations(): number { return this.builds; }
  update(patch: Partial<GlassMaterialSettings>): void {
    const next = resolveGlassMaterial({ ...this.values, ...patch });
    if (next.lightDirection !== this.values.lightDirection) this.sharedLight = createGlassLight(next.lightDirection);
    this.values = next;
  }
  prepare(impacts: readonly Impact[], composition?: ShardComposition): GlassMaterialFrame {
    const visible = impacts.filter(i => i.params.opacity > 0);
    const graph = composition?.extraction.ok ? composition.extraction.graph : undefined;
    const oldGraph = this.graph?.extraction.ok ? this.graph.extraction.graph : undefined;
    if (!this.result || graph !== oldGraph || visible.length !== this.inputs.length || visible.some((i, n) => i.id !== this.inputs[n].id || i.pattern !== this.inputs[n].pattern || i.fracture !== this.inputs[n].fracture)) {
      this.result = prepareGlassGeometry(visible, this.size, graph);
      this.inputs = visible.slice(); this.graph = composition; this.builds++;
    }
    return { settings: this.values, light: this.sharedLight, geometry: this.result };
  }
}
