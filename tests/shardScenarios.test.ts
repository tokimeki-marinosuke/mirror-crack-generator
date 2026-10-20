import { expect,it } from 'vitest';
import { extractShardRegions } from '../src/core/shardRegions';
import { createShardScenario, INSPECTOR_SIZE, overlapsProtectedCore } from './shardScenarios';
import type { CircleRegion } from '../src/core/crackTopology';
const circle=(x:number,y:number,radius:number):CircleRegion=>({kind:'circle',origin:{x,y},radius});
it('7つの診断ケースが想定どおり成功／失敗する',()=>{
  for(const id of ['single','multiple','holes','junctions','grid','limit','precision'] as const) {
    const scene=createShardScenario(id,42,0),result=extractShardRegions(INSPECTOR_SIZE,scene.segments,scene.limits);
    expect(result.ok,id).toBe(id!=='limit'&&id!=='precision');
    if(result.ok) expect(result.graph.regions.reduce((n,r)=>n+r.area,0)).toBeCloseTo(400000,5);
    if(result.ok&&id==='grid')expect(result.graph.regions).toHaveLength(289);
  }
});
it('保護円が穴の中にある場合に外側の領域を誤って保護しない',()=>{
  const scene=createShardScenario('holes',42,0),result=extractShardRegions(INSPECTOR_SIZE,scene.segments);
  if(!result.ok)throw new Error(result.message);
  const protectedRegions=result.graph.regions.filter(r=>overlapsProtectedCore(r,scene.protectedCores[0]));
  expect(protectedRegions).toHaveLength(1);expect(protectedRegions[0].holes).toHaveLength(0);
});
it('保護の重なりは領域内部・包含・接触を扱い、半径0を除外',()=>{
  const result=extractShardRegions({width:100,height:100},[]);if(!result.ok)throw new Error(result.message);
  const r=result.graph.regions[0];
  expect(overlapsProtectedCore(r,circle(50,50,5))).toBe(true);
  expect(overlapsProtectedCore(r,circle(50,50,500))).toBe(true);
  expect(overlapsProtectedCore(r,circle(-5,50,5))).toBe(true);
  expect(overlapsProtectedCore(r,circle(-6,50,5))).toBe(false);
  expect(overlapsProtectedCore(r,circle(50,50,0))).toBe(false);
});
it('中心密度0だけが保護コアを持ち、同じシードで診断入力を再現',()=>{
  const a=createShardScenario('multiple',42,0);expect(a.protectedCores).toHaveLength(2);
  expect(createShardScenario('multiple',42,0)).toEqual(a);
  expect(createShardScenario('multiple',42,100).protectedCores).toEqual([]);
});
