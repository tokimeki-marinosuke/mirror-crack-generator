import { describe, expect, it } from 'vitest';
import { DEFAULT_CRACK_PARAMS, generateCracks, MAX_SEGMENTS } from './generateCracks';

const size = { width: 1200, height: 800 };
const origin = { x: 600, y: 400 };
describe('亀裂生成', () => {
  it('同一入力は常に同一。別の生成処理や描画サイズに依存しない', () => {
    const input = Object.freeze({ ...origin });
    const params = Object.freeze({ ...DEFAULT_CRACK_PARAMS });
    const pattern = generateCracks(size, input, 42, params);
    generateCracks(size, origin, 100);
    expect(generateCracks(size, input, 42, params)).toEqual(pattern);
    expect(generateCracks(size, input, 43, params).segments).not.toEqual(pattern.segments);
    expect(pattern.origin).not.toBe(input);
    expect(new Set(pattern.segments.map(segment => segment.type)))
      .toEqual(new Set(['radial', 'concentric', 'branch']));
  });
  it('放射線が衝撃点から始まり、分岐・同心円が放射線に接続する', () => {
    // 全頂点が画像内に収まる長さで接続を確認（境界交点は別テスト）。
    const pattern = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, lengthPercent: 30, centerRadius: 0 });
    const radial = pattern.segments.filter(s => s.type === 'radial');
    expect(radial.filter(s => s.start.x === origin.x && s.start.y === origin.y)).toHaveLength(12);
    const vertices = new Set(radial.flatMap(s => [JSON.stringify(s.start), JSON.stringify(s.end)]));
    const rings = pattern.segments.filter(s => s.type === 'concentric');
    expect(rings.length).toBeGreaterThan(0);
    const key = (p: { x: number; y: number }) => JSON.stringify(p);
    const joins = new Map<string, number>();
    for (const ring of rings) for (const point of [ring.start, ring.end]) joins.set(key(point), (joins.get(key(point)) ?? 0) + 1);
    for (const ring of rings) for (const point of [ring.start, ring.end]) {
      expect(vertices.has(key(point)) || (joins.get(key(point)) ?? 0) >= 2).toBe(true);
    }
    expect(pattern.segments.some(s => s.type === 'branch' && vertices.has(JSON.stringify(s.start)))).toBe(true);
  });
  it('複雑さ0・同心円密度0で分岐と同心円を生成しない', () => {
    const pattern = generateCracks(size, origin, 1, { ...DEFAULT_CRACK_PARAMS, complexity: 0, concentricDensity: 0, centerRadius: 0 });
    expect(pattern.segments.length).toBeGreaterThan(0);
    expect(pattern.segments.every(s => s.type === 'radial')).toBe(true);
  });
  it('全ての端点は有限・画像内・非ゼロ長。角や極端な縦横比でも上限以内', () => {
    for (const image of [size, { width: 1, height: 1 }, { width: 1, height: 100000 }, { width: 100000, height: 1 }]) {
      for (const point of [{ x: 0, y: 0 }, { x: image.width, y: image.height }, { x: image.width / 2, y: image.height / 2 }]) {
        for (let seed = 0; seed < 20; seed++) {
          const pattern = generateCracks(image, point, seed, { ...DEFAULT_CRACK_PARAMS,
            radialCount: 24, lengthPercent: 150, complexity: 100, concentricDensity: 100 });
          expect(pattern.segments.length).toBeGreaterThan(0);
          expect(pattern.segments.length).toBeLessThanOrEqual(MAX_SEGMENTS);
          expect(pattern.segments.every(segment => {
            const inBounds = [segment.start, segment.end].every(p =>
              Number.isFinite(p.x) && Number.isFinite(p.y) &&
              p.x >= 0 && p.x <= image.width && p.y >= 0 && p.y <= image.height);
            return inBounds && (segment.start.x !== segment.end.x || segment.start.y !== segment.end.y);
          })).toBe(true);
        }
      }
    }
  });
  it.each([1, 10, 100])('線分数上限 %s を厳守する', maxSegments => {
    const pattern = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, maxSegments });
    expect(pattern.segments).toHaveLength(maxSegments);
  });
  it('衝撃点からの長さが画像短辺基準で制限される', () => {
    const pattern = generateCracks(size, origin, 1, { ...DEFAULT_CRACK_PARAMS, lengthPercent: 10, complexity: 0, concentricDensity: 0, centerRadius: 0 });
    for (const segment of pattern.segments) {
      expect(Math.hypot(segment.end.x - origin.x, segment.end.y - origin.y)).toBeLessThanOrEqual(80 + 1e-9);
    }
  });
  it.each([
    { radialCount: 100000 }, { radialCount: 4.5 }, { lengthPercent: Infinity },
    { complexity: NaN }, { concentricDensity: -1 }, { maxSegments: MAX_SEGMENTS + 1 }, { maxSegments: 0 },
  ])('無効な設定を拒否する: %o', overrides => {
    expect(() => generateCracks(size, origin, 1, { ...DEFAULT_CRACK_PARAMS, ...overrides })).toThrow();
  });
  it('不正な寸法・衝撃点・シードを拒否する', () => {
    expect(() => generateCracks({ width: 0, height: 1 }, origin, 1)).toThrow();
    expect(() => generateCracks(size, { x: -1, y: 0 }, 1)).toThrow();
    expect(() => generateCracks(size, origin, NaN)).toThrow();
  });
});
