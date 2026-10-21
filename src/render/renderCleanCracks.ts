import { buildCleanCrack, materialGain } from '../core/cleanCracks';
import { glassResponse } from '../core/glassShading';
import type { Point, Size } from '../core/geometry';
import type { Impact } from '../state/editorState';
import type { GlassMaterialFrame } from '../state/glassMaterialState';
import { renderCracks } from './renderCracks';
function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
}
/** Safe fallback never paints legacy surface faces, even with imported non-zero width/chip settings. */
export function renderCleanCracks(ctx: CanvasRenderingContext2D, impacts: readonly Impact[], size: Size, frame: GlassMaterialFrame): void {
  if (!frame.geometry.ok) {
    for (const impact of impacts) renderCracks(ctx, impact.pattern, size, { ...impact.params, preset: impact.preset, highlight: 0, darkOnly: true });
    return;
  }
  const geometry = frame.geometry.geometry, settings = frame.settings;
  for (const impact of impacts) {
    if (impact.params.opacity === 0) continue;
    if (geometry.unsupportedImpactIds.includes(impact.id)) { renderCracks(ctx, impact.pattern, size, { ...impact.params, preset: impact.preset, highlight: 0, darkOnly: true }); continue; }
    const radius = geometry.protections.find(p => p.impactId === impact.id)?.center?.radius ?? 0;
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.lineJoin = 'bevel';
      ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
      for (const region of ['outer', 'center'] as const) {
        ctx.save();
        try {
          if (radius > 0) {
            ctx.beginPath(); if (region === 'outer') ctx.rect(0, 0, size.width, size.height);
            ctx.moveTo(impact.origin.x + radius, impact.origin.y); ctx.arc(impact.origin.x, impact.origin.y, radius, 0, Math.PI * 2); ctx.clip('evenodd');
          }
          const strips = geometry.strips.filter(s => s.impactId === impact.id && s.region === region);
          const cracks = strips.map(s => ({ strip: s, data: buildCleanCrack(s, impact.params.lineWidth, impact.preset, settings, frame.light, Math.min(size.width, size.height) / 160) }));
          // Draw all dark cores first, then cross-sections and selected reflections at junctions.
          for (const { strip, data } of cracks) {
            polygon(ctx, data.polygon); ctx.fillStyle = '#050a11';
            ctx.globalAlpha = impact.params.opacity / 100 * strip.strength * (impact.surface?.darkness ?? 60) / 100; ctx.fill();
          }
          for (const { strip, data } of cracks) {
            const opacity = impact.params.opacity / 100 * strip.strength;
            for (const panel of data.panels) {
              if (panel.alpha || panel.shadow) {
                polygon(ctx, panel.polygon); ctx.fillStyle = '#b8d3df'; ctx.globalAlpha = opacity * panel.alpha; ctx.fill();
                ctx.fillStyle = '#091421'; ctx.globalAlpha = opacity * panel.shadow; ctx.fill();
              }
            }
          }
          for (const { strip, data } of cracks) for (const panel of data.panels) {
            if (!panel.reflection || !panel.lineWidth) continue;
            ctx.beginPath(); ctx.moveTo(panel.highlight[0].x, panel.highlight[0].y); ctx.lineTo(panel.highlight[1].x, panel.highlight[1].y);
            ctx.strokeStyle = '#f5fcff'; ctx.globalAlpha = impact.params.opacity / 100 * strip.strength * panel.reflection; ctx.lineWidth = panel.lineWidth; ctx.stroke();
          }
          // Bounded hairline glints replace protruding micro triangles in the normal renderer.
          if (settings.enabled && settings.microDetail > 0) for (const detail of frame.details ?? []) {
            if (detail.impactId !== impact.id || detail.region !== region) continue;
            const amount = materialGain(settings.microDetail), a = detail.polygon[0], b = detail.polygon[1];
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, length = Math.min(1.5, amount);
            ctx.beginPath(); ctx.moveTo(cx + (a.x - cx) * length, cy + (a.y - cy) * length); ctx.lineTo(cx + (b.x - cx) * length, cy + (b.y - cy) * length);
            ctx.strokeStyle = '#f5fcff'; ctx.lineWidth = .45;
            ctx.globalAlpha = impact.params.opacity / 100 * detail.strength * Math.min(1, amount) * .5 * glassResponse(detail.normal, frame.light); ctx.stroke();
          }
        } finally { ctx.restore(); }
      }
    } finally { ctx.restore(); }
  }
}
