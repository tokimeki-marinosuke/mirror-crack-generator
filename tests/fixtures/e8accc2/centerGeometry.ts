// 公開版 e8accc2 の回帰比較専用スナップショット。変更しない。
import type { Point, Segment } from './geometry';

/** 線分を円の内外に分割。端点だけでなく円を横切る線分も扱う。 */
export function splitAtCircle(segment: Segment, origin: Point, radius: number): { outside: Segment[]; inside: Segment[] } {
  if (radius <= 0) return { outside: [segment], inside: [] };
  const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
  const x = segment.start.x - origin.x, y = segment.start.y - origin.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return { outside: [], inside: [] };
  const b = 2 * (x * dx + y * dy), c = x * x + y * y - radius * radius;
  const disc = b * b - 4 * a * c;
  const cuts = [0, 1];
  if (disc > 0) {
    for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
      if (t > 0 && t < 1) cuts.push(t);
    }
  }
  cuts.sort((p, q) => p - q);
  const at = (t: number): Point => t === 0 ? segment.start : t === 1 ? segment.end
    : { x: segment.start.x + t * dx, y: segment.start.y + t * dy };
  const result: { outside: Segment[]; inside: Segment[] } = { outside: [], inside: [] };
  for (let i = 1; i < cuts.length; i++) {
    const mid = at((cuts[i - 1] + cuts[i]) / 2);
    const part = { start: at(cuts[i - 1]), end: at(cuts[i]) };
    result[Math.hypot(mid.x - origin.x, mid.y - origin.y) < radius ? 'inside' : 'outside'].push(part);
  }
  return result;
}
