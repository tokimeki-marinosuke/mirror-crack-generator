import type { CrackPattern } from '../core/generateCracks';
import type { Size } from '../core/geometry';
import { segmentWidth, type CrackStyle } from './crackStyle';

/** 元画像座標で描画。中心の線幅・ハイライトも円内に制限し、外側の描画を維持する。 */
export function renderCracks(ctx: CanvasRenderingContext2D, pattern: CrackPattern, size: Size, style: CrackStyle): void {
  if (style.opacity === 0) return;
  ctx.save();
  try {
    ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const anime = style.preset === 'anime', opacity = style.opacity / 100;
    const radius = pattern.centerRadius ?? pattern.protectedRadius ?? 0;
    for (const interior of [false, true]) {
      const segments = pattern.segments.filter(segment => (segment.strength !== undefined) === interior);
      if (!segments.length) continue;
      ctx.save();
      try {
        if (radius > 0) {
          ctx.beginPath();
          if (!interior) ctx.rect(0, 0, size.width, size.height);
          ctx.moveTo(pattern.origin.x + radius, pattern.origin.y);
          ctx.arc(pattern.origin.x, pattern.origin.y, radius, 0, Math.PI * 2);
          ctx.clip('evenodd');
        }
        for (const pass of ['edge', 'core', 'highlight'] as const) {
          if (pass === 'highlight' && style.highlight === 0) continue;
          ctx.strokeStyle = pass === 'edge' ? '#17232f' : pass === 'core' ? '#c2d6de' : '#ffffff';
          for (const segment of segments) {
            const strength = segment.strength ?? 1;
            if (strength <= 0) continue;
            const width = segmentWidth(segment, pattern.origin, size, style);
            ctx.globalAlpha = opacity * strength * (pass === 'edge' ? (anime ? 0.95 : 0.6)
              : pass === 'core' ? (anime ? 0.9 : 0.65) : style.highlight / 100);
            ctx.lineWidth = width * (pass === 'edge' ? 1 : pass === 'core' ? 0.55 : 0.24);
            const offset = pass === 'highlight' ? -width * 0.3 : 0;
            ctx.beginPath();
            ctx.moveTo(segment.start.x + offset, segment.start.y + offset);
            ctx.lineTo(segment.end.x + offset, segment.end.y + offset);
            ctx.stroke();
          }
        }
      } finally { ctx.restore(); }
    }
  } finally { ctx.restore(); }
}
