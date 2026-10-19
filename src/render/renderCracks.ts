import type { CrackPattern } from '../core/generateCracks';
import type { Size } from '../core/geometry';

/** 元画像座標で描画する。プレビュー用の変換は呼び出し側が担当。 */
export function renderCracks(ctx: CanvasRenderingContext2D, pattern: CrackPattern, size: Size): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size.width, size.height);
  ctx.clip();
  ctx.strokeStyle = 'rgba(240, 248, 255, 0.9)';
  ctx.lineWidth = 1.5;
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
