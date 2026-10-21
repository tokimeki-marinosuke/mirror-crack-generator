import type { GlassGeometry } from '../core/glassGeometry';
import type { GlassLight, GlassMaterialSettings } from '../core/glassMaterial';
import { shadeGlassStrip } from '../core/glassShading';
import type { Impact } from '../state/editorState';
/** No image erasure, offscreen buffers, or geometry mutation. */
export function renderGlassEdges(ctx: CanvasRenderingContext2D, impact: Impact, geometry: GlassGeometry,
  settings: GlassMaterialSettings, light: GlassLight): void {
  const { width, height } = geometry.size;
  const radius = geometry.protections.find(p => p.impactId === impact.id)?.center?.radius ?? 0;
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.lineJoin = 'bevel';
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    for (const region of ['outer', 'center'] as const) {
      ctx.save();
      try {
        if (radius > 0) {
          ctx.beginPath(); if (region === 'outer') ctx.rect(0, 0, width, height);
          ctx.moveTo(impact.origin.x + radius, impact.origin.y); ctx.arc(impact.origin.x, impact.origin.y, radius, 0, Math.PI * 2); ctx.clip('evenodd');
        }
        for (const strip of geometry.strips) {
          if (strip.impactId !== impact.id || strip.region !== region) continue;
          const panels = shadeGlassStrip(strip, settings, light, Math.min(width, height) / 160);
          const alpha = impact.params.opacity / 100 * strip.strength;
          for (const panel of panels) {
            ctx.beginPath(); panel.polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
            ctx.fillStyle = '#afced8'; ctx.globalAlpha = alpha * panel.alpha; ctx.fill();
            ctx.fillStyle = '#091421'; ctx.globalAlpha = alpha * panel.shadow; ctx.fill();
          }
          for (const panel of panels) {
            if (panel.reflection === 0) continue;
            ctx.beginPath(); ctx.moveTo(panel.highlight[0].x, panel.highlight[0].y); ctx.lineTo(panel.highlight[1].x, panel.highlight[1].y);
            ctx.strokeStyle = '#f3fbff'; ctx.globalAlpha = alpha * panel.reflection; ctx.lineWidth = panel.lineWidth; ctx.stroke();
          }
        }
      } finally { ctx.restore(); }
    }
  } finally { ctx.restore(); }
}
