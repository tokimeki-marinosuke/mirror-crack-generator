import { expect, it } from 'vitest';
import { segmentWidth, type CrackStyle } from './crackStyle';
import type { CrackSegment } from '../core/generateCracks';
const size = { width: 800, height: 600 };
const origin = { x: 400, y: 300 };
const line: CrackSegment = { start: origin, end: { x: 450, y: 300 }, type: 'radial' };
const style: CrackStyle = { preset: 'anime', lineWidth: 3, opacity: 100, highlight: 65 };
it('主要亀裂は分岐・同心円より太く、遠方では細くなる', () => {
  const width = segmentWidth(line, origin, size, style);
  expect(width).toBeGreaterThan(segmentWidth({ ...line, type: 'branch' }, origin, size, style));
  expect(width).toBeGreaterThan(segmentWidth({ ...line, type: 'concentric' }, origin, size, style));
  expect(width).toBeGreaterThan(segmentWidth({ ...line, start: { x: 700, y: 300 }, end: { x: 750, y: 300 } }, origin, size, style));
});
it('同じ幾何形状でもプリセットに応じて太さが変わり、線幅に比例する', () => {
  const width = segmentWidth(line, origin, size, style);
  expect(width).not.toBe(segmentWidth(line, origin, size, { ...style, preset: 'realistic' }));
  expect(segmentWidth(line, origin, size, { ...style, lineWidth: 6 })).toBeCloseTo(width * 2);
});
it('不透明度とハイライトは線幅・入力幾何形状に影響しない', () => {
  const before = structuredClone(line);
  expect(segmentWidth(line, origin, size, { ...style, opacity: 0, highlight: 0 }))
    .toBe(segmentWidth(line, origin, size, style));
  expect(line).toEqual(before);
});
