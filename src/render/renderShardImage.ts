import type { Size } from '../core/geometry';
import type { ShardGraph, ShardRegion } from '../core/shardRegions';
import type { ShardTransformPlan } from '../core/shardTransforms';
function regionPath(ctx: CanvasRenderingContext2D, region: ShardRegion): void {
  ctx.beginPath();for(const ring of [region.outer,...region.holes]) {
    ctx.moveTo(ring[0].x,ring[0].y);for(const p of ring.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
  }
}
/** 元画像を描き、固定輪郭内の映像だけを変形。0なら元画像のdrawImage一回だけ。 */
export function renderShardImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, size: Size,
  graph?: ShardGraph, plan?: ShardTransformPlan): void {
  ctx.save();
  try {
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.drawImage(image,0,0,size.width,size.height);
    if(!graph||!plan)return;
    const regions=new Map(graph.regions.map(r=>[r.id,r]));
    for(const motion of plan.motions) {
      if(motion.reason!=='active'||motion.dx===0&&motion.dy===0&&motion.angle===0)continue;
      const region=regions.get(motion.regionId);if(!region)continue;
      ctx.save();
      try {
        regionPath(ctx,region);ctx.clip('evenodd');
        ctx.translate(motion.center.x+motion.dx,motion.center.y+motion.dy);
        ctx.rotate(motion.angle);ctx.translate(-motion.center.x,-motion.center.y);
        // 画像の有効範囲内だけ置き換える。範囲外は最初に描いた元画像を残す。
        // 同じマスクで元の寄与を引き、変形画像の寄与を加える。
        // clear/copy→source-overでは境界のAAが二重に掛かり、透明な縫い目が出る。
        // destination-out→lighterなら old*(1-mask)+new*mask となり、半透明も保持する。
        ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000000';
        ctx.fillRect(0,0,size.width,size.height);
        ctx.globalCompositeOperation='lighter';ctx.drawImage(image,0,0,size.width,size.height);
      } finally {ctx.restore();}
    }
  } finally {ctx.restore();}
}
