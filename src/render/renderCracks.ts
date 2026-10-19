import type { CrackPattern } from '../core/generateCracks';
import type { Size } from '../core/geometry';

/** 元画像座標で描画する。プレビュー用の変換は呼び出し側が担当。 */
export function renderCracks(ctx: CanvasRenderingContext2D, pattern: CrackPattern, size: Size, style: { lineWidth: number; opacity: number }): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size.width, size.height);
  ctx.clip();
  ctx.strokeStyle = '#f0f8ff';
  ctx.globalAlpha = style.opacity / 100;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const segment of pattern.segments) {
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(segment.end.x, segment.end.y);
  }
  ctx.stroke();
  ctx.restore();
}
