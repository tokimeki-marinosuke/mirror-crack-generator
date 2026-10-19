import { containRect, imageToScreen, type Point, type Rect } from '../core/geometry';

export function renderPreview(canvas: HTMLCanvasElement, image: HTMLImageElement | null,
  impact: Point | null): Rect | null {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('このブラウザでは Canvas 2D を使用できません。');
  ctx.scale(canvas.width / bounds.width, canvas.height / bounds.height);
  if (!image) return null;
  const size = { width: image.naturalWidth, height: image.naturalHeight };
  const rect = containRect(size, { left: 0, top: 0, width: bounds.width, height: bounds.height });
  ctx.drawImage(image, rect.left, rect.top, rect.width, rect.height);
  if (impact) {
    const p = imageToScreen(impact, size, rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip();
    for (const [color, width] of [['#151b25', 5], ['#5ff5d2', 2]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.moveTo(p.x - 15, p.y); ctx.lineTo(p.x + 15, p.y);
      ctx.moveTo(p.x, p.y - 15); ctx.lineTo(p.x, p.y + 15);
      ctx.stroke();
    }
    ctx.restore();
  }
  return rect;
}
