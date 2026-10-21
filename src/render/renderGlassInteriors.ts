import type { GlassLight } from '../core/glassMaterial';
import { shadeGlassInterior, type GlassInteriorPlan } from '../core/glassTexture';
/** Composite only. source-atop preserves the image's alpha, including fully transparent pixels. */
export function renderGlassInteriors(ctx: CanvasRenderingContext2D, plan: GlassInteriorPlan, light: GlassLight, intensity: number): void {
  if (intensity === 0) return;
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1; ctx.filter = 'none';
    for (const surface of plan.surfaces) {
      const shade = shadeGlassInterior(surface, light, intensity);
      ctx.save();
      try {
        ctx.beginPath();
        for (const ring of [surface.region.outer, ...surface.region.holes]) {
          ctx.moveTo(ring[0].x, ring[0].y); for (const p of ring.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath();
        }
        ctx.clip('evenodd');
        const gradient = ctx.createLinearGradient(shade.start.x, shade.start.y, shade.end.x, shade.end.y);
        gradient.addColorStop(0, `rgba(0,0,0,${shade.alpha})`); gradient.addColorStop(.5, 'rgba(255,255,255,0)'); gradient.addColorStop(1, `rgba(255,255,255,${shade.alpha})`);
        ctx.fillStyle = gradient;
        // Fill the clipped region, including concave outlines and holes, without allocating a bitmap.
        ctx.fill('evenodd');
      } finally { ctx.restore(); }
    }
  } finally { ctx.restore(); }
}
