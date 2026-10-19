import { expect, it } from 'vitest';
import { createRandom } from './random';

it('既知のシードの系列が安定し、他のインスタンスの呼び出しに影響されない', () => {
  const first = createRandom(1);
  expect(first()).toBe(0.6270739405881613);
  const other = createRandom(1);
  other(); other();
  expect(first()).toBe(0.002735721180215478);
});
it('uint32 正規化と負の整数に対応する', () => {
  expect(createRandom(-1)()).toBe(createRandom(4294967295)());
  expect(createRandom(0)()).toBe(createRandom(4294967296)());
});
it('0以上1未満の乱数を返し、異なるシードで系列が変わる', () => {
  const sample = (seed: number) => { const rng = createRandom(seed); return Array.from({ length: 1000 }, rng); };
  const values = sample(0);
  expect(values.every(value => value >= 0 && value < 1)).toBe(true);
  expect(values).not.toEqual(sample(1));
});
it.each([NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])('無効シード %s を拒否', seed => {
  expect(() => createRandom(seed)).toThrow();
});
