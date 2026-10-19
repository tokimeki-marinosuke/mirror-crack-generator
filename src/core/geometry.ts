export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Size & { left: number; top: number };

function validate(size: Size): void {
  if (![size.width, size.height].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('画像と表示領域のサイズは正の有限数である必要があります。');
  }
}

/** object-fit: contain と同じ、余白を除いた画像の画面上の矩形。 */
export function containRect(image: Size, viewport: Rect): Rect {
  validate(image);
  validate(viewport);
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { left: viewport.left + (viewport.width - width) / 2,
    top: viewport.top + (viewport.height - height) / 2, width, height };
}

/** clientX/clientY と getBoundingClientRect はともに CSS px。DPR は不要。 */
export function screenToImage(point: Point, image: Size, rect: Rect): Point | null {
  validate(image);
  validate(rect);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < rect.left || point.y < rect.top ||
      point.x > rect.left + rect.width || point.y > rect.top + rect.height) return null;
  return { x: (point.x - rect.left) * image.width / rect.width,
    y: (point.y - rect.top) * image.height / rect.height };
}

export function imageToScreen(point: Point, image: Size, rect: Rect): Point {
  validate(image);
  validate(rect);
  return { x: rect.left + point.x * rect.width / image.width,
    y: rect.top + point.y * rect.height / image.height };
}
