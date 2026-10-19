import type { Impact } from '../state/editorState';
import { renderCracks } from './renderCracks';
import { containRect, imageToScreen, type Rect } from '../core/geometry';

export function renderPreview(canvas: HTMLCanvasElement, image: HTMLImageElement | null,
  impacts: readonly Impact[], selectedId: number | null): Rect | null {
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
  ctx.save();
  ctx.translate(rect.left, rect.top);
  ctx.scale(rect.width / size.width, rect.height / size.height);
  for (const impact of impacts) renderCracks(ctx, impact.pattern, size, impact.params);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.left, rect.top, rect.width, rect.height);
  ctx.clip();
  for (const impact of impacts) {
    const p = imageToScreen(impact.origin, size, rect);
    const selected = impact.id === selectedId;
    ctx.strokeStyle = selected ? '#5ff5d2' : '#ffcf77';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.fillStyle = '#151b25';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = selected ? '#5ff5d2' : '#ffcf77';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(impact.id), p.x, p.y);
  }
  ctx.restore();
  return rect;
}
