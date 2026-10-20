import { DEFAULT_CRACK_PARAMS, generateCracks, type CrackPattern } from '../src/core/generateCracks';
import type { CircleRegion } from '../src/core/crackTopology';
import type { Point, Size } from '../src/core/geometry';
import type { ShardLimits, ShardRegion, ShardSegment } from '../src/core/shardRegions';

export const SCENARIOS = {
  single: '生成亀裂：1衝撃点', multiple: '生成亀裂：複数衝撃点',
  holes: '既知図形：入れ子の穴と装飾亀裂', junctions: '既知図形：T字・X字・行き止まり',
  grid: '既知図形：289領域', limit: '抽出失敗：安全予算超過', precision: '抽出失敗：精度限界',
} as const;
export type ScenarioId = keyof typeof SCENARIOS;
export type ShardScenario = { segments: ShardSegment[]; patterns: CrackPattern[]; protectedCores: CircleRegion[]; limits?: Partial<ShardLimits> };
export const INSPECTOR_SIZE: Size = { width: 800, height: 500 };
export function createShardScenario(id: ScenarioId, seed: number, centerDensity: number): ShardScenario {
  const line = (name: string, x: number, y: number, xx: number, yy: number): ShardSegment => ({ id: name, start: { x, y }, end: { x: xx, y: yy } });
  const rectangle = (prefix: string, x: number, y: number, width: number, height: number) => [
    line(prefix+'a',x,y,x+width,y),line(prefix+'b',x+width,y,x+width,y+height),
    line(prefix+'c',x+width,y+height,x,y+height),line(prefix+'d',x,y+height,x,y),
  ];
  if (id === 'single' || id === 'multiple') {
    const origins = id === 'single' ? [{ x: 360, y: 230 }] : [{ x: 270, y: 210 }, { x: 590, y: 320 }];
    const patterns = origins.map(p => generateCracks(INSPECTOR_SIZE,p,seed,{ ...DEFAULT_CRACK_PARAMS, centerRadius: 25, centerDensity }));
    return { patterns, segments: patterns.flatMap((p,i)=>p.segments.map((s,j)=>({...s,id:`impact-${i}/${j}`}))),
      protectedCores: patterns.flatMap(p => p.topology?.regions.protectedCore ? [p.topology.regions.protectedCore] : []) };
  }
  let segments: ShardSegment[];
  if (id === 'holes') segments = [...rectangle('outer',140,70,520,360), ...rectangle('inner',290,170,220,160),
    line('bridge',0,250,140,250),line('tip',140,250,230,250)];
  else if (id === 'junctions') segments = [line('vertical',400,0,400,500),line('horizontal',400,250,800,250),
    line('diagonal',0,0,800,500),line('tip',400,250,340,360)];
  else if (id === 'grid') {
    segments = [];
    for (let i=1;i<17;i++) segments.push(line(`x${i}`,i*800/17,0,i*800/17,500),line(`y${i}`,0,i*500/17,800,i*500/17));
  } else if (id === 'precision') segments = [line('a',0,250,800,250+1e-9),line('b',0,250+1e-9,800,250)];
  else segments = [line('a',0,0,800,500),line('b',0,500,800,0)];
  // 穴ケースの保護円は内側の閉領域内。外側の穴付き領域を誤って保護しないか確認する。
  return { patterns: [], segments, protectedCores: id === 'holes' ? [{kind:'circle',origin:{x:400,y:250},radius:45}] : [],
    ...(id === 'limit' ? { limits: { inputSegments: 1 } } : {}) };
}

/** 検証ページ専用の包含判定。輪郭上は保守的に保護する。変形処理には接続しない。 */
export function regionContains(region: ShardRegion, point: Point): boolean {
  const inside = (ring: readonly Point[]) => {
    let result = false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) result=!result;
    }
    return result;
  };
  return inside(region.outer) && !region.holes.some(inside);
}
/** 円と輪郭の接触、円が領域内、領域が円内を扱い、穴の中だけの円を除外する。 */
export function overlapsProtectedCore(region: ShardRegion, circle: CircleRegion): boolean {
  if (circle.radius <= 0) return false;
  if (regionContains(region,circle.origin)) return true;
  for (const ring of [region.outer,...region.holes]) for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,square=dx*dx+dy*dy;
    const t=square ? Math.max(0,Math.min(1,((circle.origin.x-a.x)*dx+(circle.origin.y-a.y)*dy)/square)) : 0;
    if (Math.hypot(a.x+t*dx-circle.origin.x,a.y+t*dy-circle.origin.y)<=circle.radius+1e-7) return true;
  }
  return false;
}
