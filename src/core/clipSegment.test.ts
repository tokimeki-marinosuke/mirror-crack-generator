import { expect, it } from 'vitest';
import { clipSegment } from './geometry';
const size = { width: 100, height: 80 };
it('両端が外側の斜線を正確な交点で切る', () => {
  expect(clipSegment({ start: { x: -50, y: -20 }, end: { x: 150, y: 100 } }, size))
    .toEqual({ start: { x: 0, y: 10 }, end: { x: 100, y: 70 } });
});
it('水平線・垂直線・境界上の線を扱う', () => {
  expect(clipSegment({ start: { x: -10, y: 0 }, end: { x: 110, y: 0 } }, size))
    .toEqual({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } });
  expect(clipSegment({ start: { x: 50, y: -10 }, end: { x: 50, y: 90 } }, size))
    .toEqual({ start: { x: 50, y: 0 }, end: { x: 50, y: 80 } });
});
it('画像の外側・長さゼロ・角に触れるだけの線を除去する', () => {
  for (const segment of [
    { start: { x: -2, y: 0 }, end: { x: -2, y: 80 } },
    { start: { x: 2, y: 3 }, end: { x: 2, y: 3 } },
    { start: { x: -10, y: 10 }, end: { x: 10, y: -10 } },
  ]) expect(clipSegment(segment, size)).toBeNull();
});
it('非有限座標と無効サイズを拒否する', () => {
  expect(() => clipSegment({ start: { x: NaN, y: 0 }, end: { x: 0, y: 1 } }, size)).toThrow();
  expect(() => clipSegment({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }, { width: 0, height: 80 })).toThrow();
});
