import {expect,it} from 'vitest';
import {extractShardRegions} from './shardRegions';
import {createShardTransformPlan} from './shardTransforms';
import {createShardScenario,INSPECTOR_SIZE} from '../../tests/shardScenarios';
function fixture(id:'holes'|'grid'|'multiple'='holes') {
 const scene=createShardScenario(id,42,0),result=extractShardRegions(INSPECTOR_SIZE,scene.segments);
 if(!result.ok)throw new Error(result.message);return {scene,graph:result.graph};
}
it('同じシードと入力で再現し、入力を変更しない',()=>{
 const {graph,scene}=fixture(),before=structuredClone(graph);
 const a=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:70,rotation:80},scene.protectedCores);
 expect(createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:70,rotation:80},scene.protectedCores)).toEqual(a);
 expect(graph).toEqual(before);
 expect(createShardTransformPlan(graph,INSPECTOR_SIZE,43,{displacement:70,rotation:80},scene.protectedCores)).not.toEqual(a);
});
it('スライダーは分割・対象・乱数方向を保ち、ずれと回転は独立',()=>{
 const {graph}=fixture();const make=(displacement:number,rotation:number)=>createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement,rotation});
 const a=make(50,50),b=make(100,50),c=make(50,100),zero=make(0,0);
 a.motions.forEach((m,i)=>{expect(b.motions[i].dx).toBeCloseTo(m.dx*2,12);expect(b.motions[i].angle).toBe(m.angle);expect(c.motions[i].dx).toBe(m.dx);expect(c.motions[i].angle).toBeCloseTo(m.angle*2,12);expect(zero.motions[i]).toMatchObject({dx:0,dy:0,angle:0});});
});
it('保護領域と重なる破片全体を無効化し、穴の外側は除外しない',()=>{
 const {graph,scene}=fixture();const plan=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:100,rotation:100},scene.protectedCores);
 expect(plan.motions.filter(m=>m.reason==='protected')).toHaveLength(1);
 expect(plan.motions.filter(m=>m.reason==='protected')[0]).toMatchObject({dx:0,dy:0,angle:0});
 expect(plan.motions.filter(m=>m.reason==='active')).toHaveLength(2);
});
it('大きい破片から256件を選択し、残りは元画像のまま',()=>{
 const {graph}=fixture('grid');const plan=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:100,rotation:100});
 expect(plan.motions.filter(m=>m.reason==='active')).toHaveLength(256);
 expect(plan.motions.filter(m=>m.reason==='budget')).toHaveLength(33);
 expect(plan.motions.filter(m=>m.reason==='budget').every(m=>m.dx===0&&m.dy===0&&m.angle===0)).toBe(true);
 expect(plan.motions.map(m=>m.regionId)).toEqual([...graph.regions].sort((a,b)=>b.area-a.area||(a.id<b.id?-1:a.id>b.id?1:0)).map(r=>r.id));
});
it('最大設定でもずれ12px・回転1度以下、小さい破片はさらに抑制',()=>{
 for(const id of ['grid','multiple'] as const){const {graph}=fixture(id);const plan=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:100,rotation:100});
 for(const m of plan.motions){const r=graph.regions.find(r=>r.id===m.regionId)!;expect(Math.hypot(m.dx,m.dy)).toBeLessThanOrEqual(Math.min(12,2.5,Math.sqrt(r.area)*.08)+1e-12);expect(Math.abs(m.angle)).toBeLessThanOrEqual(Math.PI/180);}}
});
it.each([NaN,Infinity,-1,101])('不正なスライダー値%sを拒否',value=>{
 const {graph}=fixture();expect(()=>createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:value,rotation:0})).toThrow();expect(()=>createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:0,rotation:value})).toThrow();
});
it('対象領域の配列順序が変わっても変形計画は同じ',()=>{
 const {graph}=fixture();const settings={displacement:80,rotation:80};
 expect(createShardTransformPlan({...graph,regions:[...graph.regions].reverse()},INSPECTOR_SIZE,42,settings)).toEqual(createShardTransformPlan(graph,INSPECTOR_SIZE,42,settings));
});
it('保護破片で予算を消費せず、その他の大きい破片を256個選ぶ',()=>{
 const {graph}=fixture('grid');const first=[...graph.regions].sort((a,b)=>b.area-a.area||(a.id<b.id?-1:a.id>b.id?1:0))[0];
 const plan=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:100,rotation:100},[{kind:'circle',origin:first.centroid,radius:.01}]);
 expect(plan.motions.filter(m=>m.reason==='active')).toHaveLength(256);expect(plan.motions.filter(m=>m.reason==='protected')).toHaveLength(1);expect(plan.motions.filter(m=>m.reason==='budget')).toHaveLength(32);
});
it('不正な領域・シード・画像・保護円を拒否',()=>{
 const {graph}=fixture(),settings={displacement:10,rotation:10};
 expect(()=>createShardTransformPlan(graph,INSPECTOR_SIZE,NaN,settings)).toThrow();
 expect(()=>createShardTransformPlan(graph,{width:0,height:500},42,settings)).toThrow();
 expect(()=>createShardTransformPlan({...graph,regions:[graph.regions[0],graph.regions[0]]},INSPECTOR_SIZE,42,settings)).toThrow();
 expect(()=>createShardTransformPlan(graph,INSPECTOR_SIZE,42,settings,[{kind:'circle',origin:{x:0,y:0},radius:-1}])).toThrow();
});
it('極小画像・大画像・細長い画像でも有限な変形を生成する',()=>{
 for(const size of [{width:1,height:1},{width:8192,height:2048},{width:1,height:8192}]) {
  const result=extractShardRegions(size,[{id:'diagonal',start:{x:0,y:0},end:{x:size.width,y:size.height}}]);
  if(!result.ok)throw new Error(result.message);
  const plan=createShardTransformPlan(result.graph,size,42,{displacement:100,rotation:100});
  expect(plan.motions.every(m=>[m.dx,m.dy,m.angle,m.center.x,m.center.y].every(Number.isFinite))).toBe(true);
  expect(plan.motions.every(m=>Math.hypot(m.dx,m.dy)<=12)).toBe(true);
 }
});
it('明暗差と隙間はずれ・回転・対象選択と独立し、保護破片は明暗も変更しない',()=>{
 const {graph,scene}=fixture();const base=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:40,rotation:30},scene.protectedCores);
 const other=createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:40,rotation:30,reflection:100,gap:100},scene.protectedCores);
 expect(other.gap).toBe(1);for(let i=0;i<base.motions.length;i++){const a=base.motions[i],b=other.motions[i];expect([b.dx,b.dy,b.angle,b.reason]).toEqual([a.dx,a.dy,a.angle,a.reason]);expect(Math.abs(b.brightness!)).toBeLessThanOrEqual(.08);if(b.reason==='protected')expect(b.brightness).toBe(0);}
 expect(other.motions.some(m=>m.brightness!==0)).toBe(true);
 for(const key of ['reflection','gap'] as const)expect(()=>createShardTransformPlan(graph,INSPECTOR_SIZE,42,{displacement:0,rotation:0,[key]:101})).toThrow();
});
