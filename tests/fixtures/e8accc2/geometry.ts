// 公開版 e8accc2 の回帰比較専用スナップショット。変更しない。
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

export type Segment = { start: Point; end: Point };

/** Liang–Barsky: 端点を個別に丸めず、線と画像矩形の交点を求める。 */
export function clipSegment(segment: Segment, size: Size): Segment | null {
  validate(size);
  const { start, end } = segment;
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
    throw new Error('線分の座標は有限数で指定してください。');
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;
  for (const [p, q] of [[-dx, start.x], [dx, size.width - start.x],
    [-dy, start.y], [dy, size.height - start.y]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return null;
  }
  // 浮動小数点演算による境界の微小なはみ出しを抑える。
  const at = (t: number): Point => ({
    x: Math.max(0, Math.min(size.width, (t === 0 ? start.x : t === 1 ? end.x : start.x + t * dx))),
    y: Math.max(0, Math.min(size.height, (t === 0 ? start.y : t === 1 ? end.y : start.y + t * dy))),
  });
  const clipped = { start: at(enter), end: at(exit) };
  return clipped.start.x === clipped.end.x && clipped.start.y === clipped.end.y ? null : clipped;
}
