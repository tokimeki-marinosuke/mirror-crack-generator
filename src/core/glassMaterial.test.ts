import { expect, it } from 'vitest';
import { createGlassLight, DEFAULT_GLASS_MATERIAL, isGlassMaterialActive, resolveGlassMaterial } from './glassMaterial';
it('初期値は全効果0・無効で、光源角度だけでは有効化しない', () => {
  expect(Object.isFrozen(DEFAULT_GLASS_MATERIAL)).toBe(true);
  expect(isGlassMaterialActive(DEFAULT_GLASS_MATERIAL)).toBe(false);
  expect(isGlassMaterialActive(resolveGlassMaterial({ enabled: true, lightDirection: 0 }))).toBe(false);
  expect(isGlassMaterialActive(resolveGlassMaterial({ enabled: true, thickness: 10 }))).toBe(true);
  expect(isGlassMaterialActive(resolveGlassMaterial({ thickness: 10 }))).toBe(false);
});
it('光源は画像座標の方向を共有し、3次元への拡張に使える単位ベクトル', () => {
  for (const angle of [0, 90, 180, 225, 270, 360, -90]) {
    const light = createGlassLight(angle);
    expect(Math.hypot(light.screenDirection.x, light.screenDirection.y)).toBeCloseTo(1, 12);
    expect(Math.hypot(light.direction.x, light.direction.y, light.direction.z)).toBeCloseTo(1, 12);
    expect(light.direction.z).toBeGreaterThan(0);
  }
  expect(createGlassLight(0).screenDirection).toEqual({ x: 1, y: 0 });
  expect(createGlassLight(90).screenDirection.y).toBeCloseTo(1);
  expect(createGlassLight(-90)).toEqual(createGlassLight(270));
  expect(resolveGlassMaterial({ lightDirection: 720 }).lightDirection).toBe(0);
});
it('厚みは材質設定だけに存在し、隙間・線幅・破片変形の設定を含まない', () => {
  expect(Object.keys(resolveGlassMaterial({ thickness: 100 }))).toEqual(Object.keys(DEFAULT_GLASS_MATERIAL));
  expect('gap' in DEFAULT_GLASS_MATERIAL).toBe(false);
});
it.each([NaN, Infinity, -1, 101])('不正な強度%sを拒否', value => {
  for (const key of ['thickness', 'edgeReflection', 'interiorReflection', 'microDetail'] as const) expect(() => resolveGlassMaterial({ [key]: value })).toThrow();
});
it('非有限光源を拒否し、呼び出し側の設定を変更しない', () => {
  expect(() => createGlassLight(NaN)).toThrow();
  expect(() => resolveGlassMaterial({ lightDirection: Infinity })).toThrow();
  const input = { lightDirection: -90, thickness: 20 }; resolveGlassMaterial(input); expect(input.lightDirection).toBe(-90);
});
