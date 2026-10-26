import { extractShardRegions, SHARD_LIMITS, type ShardSegment, type ShardExtraction, type ShardLimits } from '../core/shardRegions';
import { createShardTransformPlan, type ShardTransformPlan } from '../core/shardTransforms';
import type { Size } from '../core/geometry';
import type { Impact } from './editorState';
export type ShardImageSettings = { displacement: number; rotation: number; reflection: number; gap: number };
export const DEFAULT_SHARD_IMAGE_SETTINGS: Readonly<ShardImageSettings> = Object.freeze({displacement:0,rotation:0,reflection:0,gap:0});
export type ShardComposition = { extraction: ShardExtraction; plan?: ShardTransformPlan };
/** 画像全体で一つの平面分割。画素やCanvasは保持しない。 */
export class ShardImageState {
  private values: Readonly<ShardImageSettings> = DEFAULT_SHARD_IMAGE_SETTINGS;
  private sources: readonly Impact[] = [];
  private extraction?: ShardExtraction;
  private composition?: ShardComposition;
  private extractionCount = 0;
  constructor(private readonly size: Size, private readonly limits: Partial<ShardLimits> = {}, readonly range: 'legacy' | 'expanded' | 'wide' = 'legacy') {}
  get settings(): Readonly<ShardImageSettings> {return this.values;}
  get extractions(): number {return this.extractionCount;}
  update(patch: Partial<ShardImageSettings>): void {
    const next={...this.values,...patch};
    if(!Object.values(next).every(v=>Number.isFinite(v)&&v>=0&&v<=(this.range==='wide'?200:100)))throw new Error('映りの設定が調整範囲外です。');
    if((Object.keys(next) as (keyof ShardImageSettings)[]).every(k=>next[k]===this.values[k]))return;
    this.values=Object.freeze(next);this.composition=undefined;
  }
  /** requireGeometryは材質用。既定の呼び出しでは全設定0なら従来どおり抽出しない。 */
  resolve(impacts: readonly Impact[], requireGeometry = false): ShardComposition | undefined {
    if(!requireGeometry&&Object.values(this.values).every(v=>v===0))return undefined;
    const visible=impacts.filter(i=>i.params.opacity>0);
    const changed=visible.length!==this.sources.length||visible.some((v,i)=>v.pattern!==this.sources[i].pattern||v.id!==this.sources[i].id);
    if(changed||!this.extraction){
      this.sources=visible.slice();this.composition=undefined;
      // 不透明度は表示の有無だけに使用。中心の弱い線は装飾として描き、分割には使わない。
      const segments: ShardSegment[]=[];
      const maximum=Math.min(this.limits.inputSegments??SHARD_LIMITS.inputSegments,SHARD_LIMITS.inputSegments);
      collect: for(const impact of visible)for(let j=0;j<impact.pattern.segments.length;j++){
        const s=impact.pattern.segments[j];if((s.strength??1)<0.5)continue;
        segments.push({id:`impact-${impact.id}/${j}`,start:s.start,end:s.end});
        if(segments.length>maximum)break collect; // 超過を通知する1辺だけ追加し、それ以上は確保しない。
      }
      this.extraction=extractShardRegions(this.size,segments,this.limits);this.extractionCount++;
    }
    if(this.composition)return this.composition;
    const extraction=this.extraction;
    if(!extraction.ok||!extraction.graph.edges.some(e=>e.kind==='shard-boundary'))return this.composition={extraction};
    const cores=visible.flatMap(i=>{
      const core=i.pattern.topology?.regions.protectedCore;
      if(core)return [core];
      return (i.pattern.protectedRadius??0)>0?[{kind:'circle' as const,origin:i.origin,radius:i.pattern.protectedRadius!}]:[];
    });
    // 既存衝撃点のシードから独立した画像変形用シードを合成する。
    let seed=2166136261;for(const impact of visible)seed=Math.imul(seed^(impact.seed>>>0),16777619);
    return this.composition={extraction,plan:createShardTransformPlan(extraction.graph,this.size,seed>>>0,this.values,cores,this.range)};
  }
}
