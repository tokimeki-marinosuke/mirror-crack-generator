import type { CircleRegion } from './crackTopology';
import type { Point } from './geometry';
import type { ShardRegion } from './shardRegions';

/** 外周と穴に対する偶奇規則の包含判定。 */
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
