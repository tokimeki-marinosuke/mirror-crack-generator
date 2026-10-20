import type { Size } from '../core/geometry';
import type { ShardGraph, ShardRegion } from '../core/shardRegions';
import type { ShardTransformPlan } from '../core/shardTransforms';
import type { ShardComposition } from '../state/shardImageState';
function regionPath(ctx: CanvasRenderingContext2D, region: ShardRegion): void {
  ctx.beginPath();for(const ring of [region.outer,...region.holes]) {
    ctx.moveTo(ring[0].x,ring[0].y);for(const p of ring.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
  }
}
/** 背景専用。クリア済みの描画先で、固定輪郭内の映像だけを変える。 */
export function renderShardImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, size: Size,
  graph?: ShardGraph, plan?: ShardTransformPlan): void {
  ctx.save();
  try {
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.drawImage(image,0,0,size.width,size.height);
    if(!graph||!plan)return;
    const regions=new Map(graph.regions.map(r=>[r.id,r]));
    const gapEdges=new Map(graph.edges.filter(e=>e.kind==='shard-boundary').map(e=>[e.id,e]));
    const vertices=new Map(graph.vertices.map(v=>[v.id,v.point]));
    for(const motion of plan.motions) {
      if(motion.reason!=='active')continue;
      const brightness=motion.brightness??0,gap=plan.gap??0;
      const changed=motion.dx!==0||motion.dy!==0||motion.angle!==0||brightness!==0;
      if(!changed&&gap===0)continue;
      const region=regions.get(motion.regionId);if(!region)continue;
      ctx.save();
      try {
        regionPath(ctx,region);ctx.clip('evenodd');
        if(changed){
          ctx.save();
          try {
            ctx.translate(motion.center.x+motion.dx,motion.center.y+motion.dy);
            ctx.rotate(motion.angle);ctx.translate(-motion.center.x,-motion.center.y);
            // old*(1-mask)+new*mask。AAの透明な縫い目と半透明の二重合成を避ける。
            ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000000';ctx.fillRect(0,0,size.width,size.height);
            ctx.globalCompositeOperation='lighter';ctx.filter=`brightness(${1+brightness})`;
            ctx.drawImage(image,0,0,size.width,size.height);
          } finally {ctx.restore();}
        }
        // 境界の内側だけ暗くする。画像四辺・装飾亀裂・保護破片には隙間を追加しない。
        if(gap>0){
          ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.strokeStyle='#080d14';
          ctx.lineWidth=gap;ctx.lineCap='butt';ctx.lineJoin='bevel';ctx.setLineDash([]);ctx.beginPath();
          for(const id of region.boundaryEdgeIds){const edge=gapEdges.get(id);if(!edge)continue;const a=vertices.get(edge.startVertexId)!,b=vertices.get(edge.endVertexId)!;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();
        }
      } finally {ctx.restore();}
    }
  } finally {ctx.restore();}
}
export function renderCompositeImage(ctx: CanvasRenderingContext2D,image: CanvasImageSource,size: Size,composition?: ShardComposition): void {
  const graph=composition?.extraction.ok?composition.extraction.graph:undefined;
  renderShardImage(ctx,image,size,graph,composition?.plan);
}
