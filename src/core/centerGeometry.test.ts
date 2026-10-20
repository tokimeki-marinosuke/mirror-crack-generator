import { expect, it } from 'vitest';
import { splitAtCircle } from './centerGeometry';
it('両端が円外の線分でも内部を分離し、交点を共有する', () => {
  const parts = splitAtCircle({ start: { x: -10, y: 0 }, end: { x: 10, y: 0 } }, { x: 0, y: 0 }, 5);
  expect(parts.outside).toEqual([{ start: { x: -10, y: 0 }, end: { x: -5, y: 0 } }, { start: { x: 5, y: 0 }, end: { x: 10, y: 0 } }]);
  expect(parts.inside).toEqual([{ start: { x: -5, y: 0 }, end: { x: 5, y: 0 } }]);
  expect(parts.inside[0].start).toEqual(parts.outside[0].end);
});
it('内側だけ・接線・半径0を処理する', () => {
  expect(splitAtCircle({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }, { x: 0, y: 0 }, 5).outside).toHaveLength(0);
  expect(splitAtCircle({ start: { x: -5, y: 5 }, end: { x: 5, y: 5 } }, { x: 0, y: 0 }, 5).inside).toHaveLength(0);
  expect(splitAtCircle({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }, { x: 0, y: 0 }, 0).outside).toHaveLength(1);
});
