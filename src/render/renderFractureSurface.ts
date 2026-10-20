import type { FractureGeometry } from '../core/generateFractureSurface';
import type { CrackPattern } from '../core/generateCracks';
import type { Point, Size } from '../core/geometry';

function trace(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
}
/** 画像消去を行わず、透明レイヤーにも暗部と反射をsource-overで描く。 */
export function renderFractureSurface(ctx: CanvasRenderingContext2D, pattern: CrackPattern,
  geometry: FractureGeometry, size: Size, style: { opacity: number; darkness: number; highlight: number }): void {
  if (style.opacity === 0 || !geometry.faces.length) return;
  ctx.save();
  try {
    ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.lineJoin = 'bevel';
    const radius = pattern.topology?.regions.center?.radius ?? pattern.centerRadius ?? pattern.protectedRadius ?? 0;
    for (const region of ['outer', 'center'] as const) {
      const faces = geometry.faces.filter(face => face.region === region);
      if (!faces.length) continue;
      ctx.save();
      try {
        if (radius > 0) {
          ctx.beginPath();
          if (region === 'outer') ctx.rect(0, 0, size.width, size.height);
          ctx.moveTo(pattern.origin.x + radius, pattern.origin.y);
          ctx.arc(pattern.origin.x, pattern.origin.y, radius, 0, Math.PI * 2); ctx.clip('evenodd');
        }
        // 全ての暗部を先に描き、後から反射縁を描いて接合部の反射を保つ。
        for (const face of faces) {
          if (style.darkness === 0) continue;
          ctx.globalAlpha = style.opacity / 100 * style.darkness / 100 * face.strength;
          ctx.fillStyle = '#080d14'; trace(ctx, face.polygon); ctx.closePath(); ctx.fill();
        }
        for (const face of faces) {
          if (style.highlight === 0) continue;
          ctx.globalAlpha = style.opacity / 100 * style.highlight / 100 * face.strength;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = face.reflectionWidth; trace(ctx, face.reflection); ctx.stroke();
        }
      } finally { ctx.restore(); }
    }
  } finally { ctx.restore(); }
}
