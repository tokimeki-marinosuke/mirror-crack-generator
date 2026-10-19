import type { CrackPattern } from '../core/generateCracks';
import type { Size } from '../core/geometry';
import { segmentWidth, type CrackStyle } from './crackStyle';

/** 画像座標で輪郭・芯・ハイライトを描画。幾何データと乱数状態は変更しない。 */
export function renderCracks(ctx: CanvasRenderingContext2D, pattern: CrackPattern, size: Size, style: CrackStyle): void {
  if (style.opacity === 0) return;
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(0, 0, size.width, size.height);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const anime = style.preset === 'anime';
    const opacity = style.opacity / 100;
    // 全ての輪郭を先に描き、交点で後続の暗線がハイライトを塗り潰すのを避ける。
    for (const pass of ['edge', 'core', 'highlight'] as const) {
      if (pass === 'highlight' && style.highlight === 0) continue;
      ctx.strokeStyle = pass === 'edge' ? '#17232f' : pass === 'core' ? '#c2d6de' : '#ffffff';
      ctx.globalAlpha = opacity * (pass === 'edge' ? (anime ? 0.95 : 0.6)
        : pass === 'core' ? (anime ? 0.9 : 0.65) : style.highlight / 100);
      for (const segment of pattern.segments) {
        const width = segmentWidth(segment, pattern.origin, size, style);
        ctx.lineWidth = width * (pass === 'edge' ? 1 : pass === 'core' ? 0.55 : 0.24);
        // 光源は左上。表示倍率に左右されない元画像px基準のオフセット。
        const offset = pass === 'highlight' ? -width * 0.3 : 0;
        ctx.beginPath();
        ctx.moveTo(segment.start.x + offset, segment.start.y + offset);
        ctx.lineTo(segment.end.x + offset, segment.end.y + offset);
        ctx.stroke();
      }
    }
  } finally { ctx.restore(); }
}
