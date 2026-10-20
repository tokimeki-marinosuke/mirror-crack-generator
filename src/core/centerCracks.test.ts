import { expect, it } from 'vitest';
import { DEFAULT_CRACK_PARAMS, generateCracks } from './generateCracks';
import type { Point, Segment } from './geometry';
const size = { width: 1200, height: 1000 }, origin = { x: 600, y: 500 };
function minimumRadius(segment: Segment, center: Point): number {
  const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
  const t = Math.max(0, Math.min(1, ((center.x - segment.start.x) * dx + (center.y - segment.start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(segment.start.x + t * dx - center.x, segment.start.y + t * dy - center.y);
}
it('密度0では全線分が円の外側。円を横切る弦も残さない', () => {
  for (const center of [origin, { x: 0, y: 0 }, { x: 1190, y: 999 }]) for (let seed = 0; seed < 12; seed++) {
    const params = { ...DEFAULT_CRACK_PARAMS, centerRadius: 35, centerDensity: 0, complexity: 100, concentricDensity: 100 };
    const pattern = generateCracks(size, center, seed, params);
    const radius = 1000 * params.lengthPercent / 100 * params.centerRadius / 100;
    expect(pattern.protectedRadius).toBeCloseTo(radius);
    expect(pattern.segments.length).toBeGreaterThan(0);
    expect(pattern.segments.every(segment => minimumRadius(segment, center) >= radius - 1e-6)).toBe(true);
  }
});
it.each([1, 20, 5000])('密度のみを変えても外側の全線分を維持（上限%s）', maxSegments => {
  const params = { ...DEFAULT_CRACK_PARAMS, centerRadius: 30, maxSegments };
  const radius = 1000 * params.lengthPercent / 100 * params.centerRadius / 100;
  const outside = generateCracks(size, origin, 42, { ...params, centerDensity: 0 }).segments;
  for (const centerDensity of [0.1, 25, 50, 75, 100]) {
    const pattern = generateCracks(size, origin, 42, { ...params, centerDensity });
    expect(pattern.segments.filter(segment => minimumRadius(segment, origin) >= radius - 1e-6)).toEqual(outside);
    expect(pattern.segments.length).toBeLessThanOrEqual(maxSegments);
  }
});
it('0〜100で中心の線分量・強度が増加し、中間値でも連続的に変化する', () => {
  const params = { ...DEFAULT_CRACK_PARAMS, centerRadius: 40 };
  let previous = 0;
  for (const centerDensity of [0, 10, 25, 49.9, 50, 50.1, 75, 100]) {
    const pattern = generateCracks(size, origin, 42, { ...params, centerDensity });
    const amount = pattern.segments.filter(s => s.strength !== undefined).reduce((sum, s) => sum + s.strength!, 0);
    expect(amount).toBeGreaterThanOrEqual(previous); previous = amount;
  }
  const middle = generateCracks(size, origin, 42, { ...params, centerDensity: 50 });
  expect(middle.segments.some(s => s.strength !== undefined && s.strength > 0 && s.strength < 1)).toBe(true);
  expect(generateCracks(size, origin, 42, { ...params, centerDensity: 50.1 })).not.toEqual(middle);
});
it('角度間隔・長さが不均一で、主要線の自己交差を起こしにくい放射状構成', () => {
  const pattern = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerRadius: 0, complexity: 0, concentricDensity: 0 });
  const starts = pattern.segments.filter(s => s.start.x === origin.x && s.start.y === origin.y);
  const angles = starts.map(s => Math.atan2(s.end.y - origin.y, s.end.x - origin.x)).sort((a, b) => a - b);
  const gaps = angles.map((angle, i) => (angles[(i + 1) % angles.length] - angle + 2 * Math.PI) % (2 * Math.PI));
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(1.2);
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(3);
  const lengths = starts.map(s => Math.hypot(s.end.x - origin.x, s.end.y - origin.y));
  expect(Math.max(...lengths) / Math.min(...lengths)).toBeGreaterThan(1.5);
});
it('半径0・80、密度0・100、極端な縦横比や画像境界でも有限・上限内', () => {
  for (const image of [{ width: 1, height: 1 }, { width: 100000, height: 1 }, size]) {
    for (const centerRadius of [0, 80]) for (const centerDensity of [0, 100]) for (let seed = 0; seed < 5; seed++) {
      const point = { x: image.width, y: 0 };
      const pattern = generateCracks(image, point, seed, { ...DEFAULT_CRACK_PARAMS, centerRadius, centerDensity, radialCount: 24, complexity: 100, concentricDensity: 100, lengthPercent: 150 });
      expect(pattern.segments.length).toBeLessThanOrEqual(5000);
      expect(pattern.segments.every(s => [s.start, s.end].every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= image.width && p.y <= image.height))).toBe(true);
    }
  }
});
it.each([{ centerRadius: NaN }, { centerRadius: -1 }, { centerRadius: 81 }, { centerDensity: Infinity }, { centerDensity: 101 }, { centerDensity: -1 }])('新パラメータの不正値を拒否: %o', overrides => {
  expect(() => generateCracks(size, origin, 1, { ...DEFAULT_CRACK_PARAMS, ...overrides })).toThrow();
});

it('主要亀裂どうしは原点以外で交差せず、一本の中でも自己交差しない', () => {
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let seed = 0; seed < 4; seed++) {
    const radial = generateCracks(size, origin, seed, { ...DEFAULT_CRACK_PARAMS, centerRadius: 0, complexity: 100, radialCount: 24, lengthPercent: 30 }).segments.filter(s => s.type === 'radial');
    let crossing = false;
    for (let i = 0; i < radial.length; i++) for (let j = i + 1; j < radial.length; j++) {
      const a = radial[i], b = radial[j];
      if (cross(a.start, a.end, b.start) * cross(a.start, a.end, b.end) < -1e-9 &&
          cross(b.start, b.end, a.start) * cross(b.start, b.end, a.end) < -1e-9) crossing = true;
    }
    expect(crossing).toBe(false);
  }
});
