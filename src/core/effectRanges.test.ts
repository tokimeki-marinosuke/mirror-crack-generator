import { expect, it } from 'vitest';
import { effectivePercent, displayPercent, effectiveImpactStrength, displayImpactStrength, EXPANDED_LIMITS } from './effectRanges';
import { extractShardRegions } from './shardRegions';
import { createShardTransformPlan } from './shardTransforms';
import { EditorState } from '../state/editorState';
import { generateCracks, DEFAULT_CRACK_PARAMS, MAX_SEGMENTS } from './generateCracks';
const size={width:800,height:500},origin={x:320,y:225};
it('65で旧最大、100でさらに強く、UI変換は連続で可逆',()=>{
 expect(effectivePercent(65)).toBe(100);expect(effectivePercent(100)).toBeGreaterThan(150);
 expect(effectiveImpactStrength(50)).toBe(50);expect(effectiveImpactStrength(65)).toBe(100);
 for(let value=0;value<=100;value++){expect(displayPercent(effectivePercent(value))).toBeCloseTo(value);expect(displayImpactStrength(effectiveImpactStrength(value))).toBeCloseTo(value);}
 for(const value of [NaN,Infinity,-1,101]){expect(()=>effectivePercent(value)).toThrow();expect(()=>effectiveImpactStrength(value)).toThrow();}
});
it('新上限が選択された初期値より大きい',()=>{expect(EXPANDED_LIMITS.radialCount).toBeGreaterThan(29);expect(EXPANDED_LIMITS.lengthPercent).toBeGreaterThan(192);expect(EXPANDED_LIMITS.lineWidth).toBeGreaterThan(1);});
it('映り4項目の65は旧100と完全一致し、100は分割を維持したまま増幅',()=>{
 const result=extractShardRegions(size,[{id:'a',start:{x:400,y:0},end:{x:400,y:500}}]);if(!result.ok)throw new Error(result.message);
 const graph=result.graph,before=structuredClone(graph);
 const old=createShardTransformPlan(graph,size,42,{displacement:100,rotation:100,reflection:100,gap:100});
 const baseline=createShardTransformPlan(graph,size,42,{displacement:65,rotation:65,reflection:65,gap:65},[],'expanded');
 expect(baseline).toEqual(old);
 const strong=createShardTransformPlan(graph,size,42,{displacement:100,rotation:100,reflection:100,gap:100},[],'expanded');
 expect(strong.gap).toBeGreaterThan(old.gap!);
 for(let i=0;i<old.motions.length;i++){expect(Math.hypot(strong.motions[i].dx,strong.motions[i].dy)).toBeGreaterThan(Math.hypot(old.motions[i].dx,old.motions[i].dy));expect(Math.abs(strong.motions[i].angle)).toBeGreaterThan(Math.abs(old.motions[i].angle));expect(Math.abs(strong.motions[i].brightness!)).toBeGreaterThan(Math.abs(old.motions[i].brightness!));}
 expect(graph).toEqual(before);
 const protectedPlan=createShardTransformPlan(graph,size,42,{displacement:100,rotation:100,reflection:100,gap:100},[{kind:'circle',origin:{x:200,y:250},radius:40}],'expanded');
 expect(protectedPlan.motions.find(m=>m.center.x<400)).toMatchObject({reason:'protected',dx:0,dy:0,angle:0,brightness:0});
});
it('製品の映りは拡張範囲だが、強度変更で破片を再抽出しない',()=>{
 const state=new EditorState(size);state.add(origin);state.shards.update({displacement:65});const first=state.shards.resolve(state.impacts)!;
 state.shards.update({displacement:100,rotation:100,reflection:100,gap:100});const second=state.shards.resolve(state.impacts)!;
 expect(state.shards.range).toBe('expanded');expect(second.extraction).toBe(first.extraction);expect(state.shards.extractions).toBe(1);
});
it('新しい上限でも有限・線分上限以内で、中心密度0の保護を維持',()=>{
 for(const point of [origin,{x:0,y:0}]){
  const params={...DEFAULT_CRACK_PARAMS,radialCount:EXPANDED_LIMITS.radialCount,lengthPercent:EXPANDED_LIMITS.lengthPercent,complexity:EXPANDED_LIMITS.complexity,concentricDensity:EXPANDED_LIMITS.concentricDensity,centerDensity:0};
  const pattern=generateCracks(size,point,42,params);expect(pattern.segments.length).toBeLessThanOrEqual(MAX_SEGMENTS);
  expect(pattern.segments.every(s=>[s.start.x,s.start.y,s.end.x,s.end.y].every(Number.isFinite))).toBe(true);
  expect(pattern.protectedRadius).toBeGreaterThan(0);expect(pattern.segments.every(s=>s.strength===undefined)).toBe(true);
  expect(generateCracks(size,point,42,params)).toEqual(pattern);
 }
});
it('衝撃65は旧マクロ100と同じ、100では強まり、個別指定と中心保護を優先',()=>{
 const a=new EditorState(size),b=new EditorState(size);a.add(origin);b.add(origin);a.applyPreset('shattered');b.applyPreset('shattered');
 a.updateStrength(effectiveImpactStrength(65));b.updateStrength(100);expect(a.active!.pattern).toEqual(b.active!.pattern);
 const baseline=a.active!.params;a.updateStrength(effectiveImpactStrength(100));expect(a.active!.params.lengthPercent).toBeGreaterThan(baseline.lengthPercent);expect(a.active!.params.complexity).toBeGreaterThan(baseline.complexity);
 a.update({params:{lengthPercent:30,centerDensity:0,centerRadius:30,lineWidth:9}});a.updateStrength(effectiveImpactStrength(100));expect(a.active!.params).toMatchObject({lengthPercent:30,centerDensity:0,centerRadius:30,lineWidth:9});
});

it('65直後で飽和上限が突然跳ねず、最大設定も有効', async()=>{
 const { resolveFractureSettings }=await import('../state/fractureSettings');
 const { PRESETS }=await import('../state/editorState');
 for(const base of [{...PRESETS.anime,complexity:85},{...PRESETS.realistic,complexity:100,lengthPercent:150}]){
  const at=resolveFractureSettings(base,{impactStrength:effectiveImpactStrength(65)});
  const above=resolveFractureSettings(base,{impactStrength:effectiveImpactStrength(65.00001)});
  expect(Math.abs(at.geometry.complexity-above.geometry.complexity)).toBeLessThan(.001);
  expect(Math.abs(at.geometry.lengthPercent-above.geometry.lengthPercent)).toBeLessThan(.001);
  expect(()=>resolveFractureSettings(base,{impactStrength:154})).not.toThrow();
 }
});
