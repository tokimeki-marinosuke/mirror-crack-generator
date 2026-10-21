import { effectivePercent } from './effectRanges';
import type { CircleRegion } from './crackTopology';
import type { Point, Size } from './geometry';
import type { ShardGraph } from './shardRegions';
import { overlapsProtectedCore } from './shardProtection';
export const MAX_TRANSFORMED_SHARDS = 256;
export type ShardTransformSettings = { displacement: number; rotation: number; reflection?: number; gap?: number };
export type ShardMotion = {
  regionId: string; center: Point; dx: number; dy: number; angle: number;
  brightness?: number;
  reason: 'active' | 'protected' | 'budget';
};
export type ShardTransformPlan = { motions: ShardMotion[]; gap?: number };
function value(seed: number, id: string, channel: number): number {
  let h=(seed>>>0)^Math.imul(channel+1,0x9e3779b9);
  for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
  h=Math.imul(h^(h>>>16),0x85ebca6b);return ((h^(h>>>13))>>>0)/4294967296;
}
/** 分割を変更せず、経路の乱数も消費せず、変形量だけを計算する。 */
export function createShardTransformPlan(graph: ShardGraph, size: Size, seed: number,
  settings: ShardTransformSettings, protectedCores: readonly CircleRegion[] = [], range: 'legacy' | 'expanded' = 'legacy'): ShardTransformPlan {
  if(!Number.isSafeInteger(seed)||![size.width,size.height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=8192)||
    ![settings.displacement,settings.rotation,settings.reflection??0,settings.gap??0].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||
    !protectedCores.every(c=>Number.isFinite(c.origin.x)&&Number.isFinite(c.origin.y)&&Number.isFinite(c.radius)&&c.radius>=0)) throw new Error('破片変形の入力が不正です。');
  if (range !== 'legacy' && range !== 'expanded') throw new Error('映りの強度範囲が不正です。');
  const amount=(v:number)=>range==='expanded'?effectivePercent(v):v;
  const displacement=amount(settings.displacement), rotation=amount(settings.rotation), reflection=amount(settings.reflection??0), gap=amount(settings.gap??0);
  const ids=new Set<string>();
  for(const r of graph.regions) {
    if(ids.has(r.id)||!Number.isFinite(r.area)||r.area<=0||![r.centroid.x,r.centroid.y].every(Number.isFinite)||
      r.outer.length<3||![r.outer,...r.holes].every(ring=>ring.length>=3&&ring.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))) throw new Error('破片領域が不正です。');
    ids.add(r.id);
  }
  const sorted=[...graph.regions].sort((a,b)=>b.area-a.area||(a.id<b.id?-1:a.id>b.id?1:0));
  let count=0;
  return { gap: Math.min(6,Math.min(size.width,size.height)*0.002)*gap/100, motions: sorted.map(region=>{
    const protectedRegion=protectedCores.some(c=>overlapsProtectedCore(region,c));
    const reason=protectedRegion?'protected':count>=MAX_TRANSFORMED_SHARDS?'budget':'active';
    if(reason==='active')count++;
    const center={...region.centroid};
    if(reason!=='active')return {regionId:region.id,center,dx:0,dy:0,angle:0,brightness:0,reason};
    const bound=Math.min(12,Math.min(size.width,size.height)*0.005,Math.sqrt(region.area)*0.08);
    const heading=value(seed,region.id,0)*Math.PI*2;
    const shift=bound*(0.25+value(seed,region.id,1)*0.75)*displacement/100;
    const reach=region.outer.reduce((max,p)=>Math.max(max,Math.hypot(p.x-center.x,p.y-center.y)),1);
    const angle=(value(seed,region.id,2)*2-1)*Math.min(Math.PI/180,bound/reach)*rotation/100;
    return {regionId:region.id,center,dx:shift===0?0:Math.cos(heading)*shift,dy:shift===0?0:Math.sin(heading)*shift,angle:settings.rotation===0?0:angle,brightness:(settings.reflection??0)===0?0:(value(seed,region.id,3)*2-1)*0.08*reflection/100,reason};
  }) };
}
