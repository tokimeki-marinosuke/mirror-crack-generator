import { expect, it } from 'vitest';
import { createGlassLight, resolveGlassMaterial } from './glassMaterial';
import { glassProfile, glassResponse, shadeGlassStrip } from './glassShading';
import type { GlassStrip } from './glassGeometry';
const strip: GlassStrip = { id: 'seed42/path1', impactId: 1, pathId: 'path1', type: 'radial', region: 'outer', strength: 1, sourceEdgeIds: [],
  samples: [0, .5, 1].map(position => ({ position, center: { x: position * 100, y: 50 }, tangent: { x: 1, y: 0 },
    left: { point: { x: position * 100, y: 50 }, normal: { x: 0, y: 1 } }, right: { point: { x: position * 100, y: 50 }, normal: { x: 0, y: -1 } } })) };
it('光源と逆向きの輪郭は強く光らず、光源の反転で両側が逆転する', () => {
  expect(glassResponse({ x: 0, y: 1 }, createGlassLight(90))).toBe(1);
  expect(glassResponse({ x: 0, y: -1 }, createGlassLight(90))).toBe(0);
  expect(glassResponse({ x: 0, y: -1 }, createGlassLight(270))).toBe(1);
  expect(glassResponse({ x: 1, y: 0 }, createGlassLight(45))).toBeCloseTo(.25);
});
it('経路変調は再現可能・連続で、経路ごとに異なる', () => {
  expect(glassProfile('a', .3)).toBe(glassProfile('a', .3));
  expect(glassProfile('a', .3)).not.toBe(glassProfile('b', .3));
  expect(Math.abs(glassProfile('a', .3) - glassProfile('a', .30001))).toBeLessThan(.001);
});
it('無効・全効果0・小分岐には新しい帯を生成しない', () => {
  const light = createGlassLight(90);
  for (const settings of [resolveGlassMaterial(), resolveGlassMaterial({ enabled: true }), resolveGlassMaterial({ thickness: 100 })]) expect(shadeGlassStrip(strip, settings, light, 3)).toEqual([]);
  expect(shadeGlassStrip({ ...strip, type: 'branch' }, resolveGlassMaterial({ enabled: true, thickness: 100 }), light, 3)).toEqual([]);
});
it('隙間幅0でも厚みを描け、入力輪郭を変更せず決定的に生成する', () => {
  const before = structuredClone(strip), settings = resolveGlassMaterial({ enabled: true, thickness: 100, edgeReflection: 80 });
  const result = shadeGlassStrip(strip, settings, createGlassLight(90), 3);
  expect(result).toEqual(shadeGlassStrip(strip, settings, createGlassLight(90), 3)); expect(strip).toEqual(before);
  expect(result).toHaveLength(4); expect(result[0].polygon[2].y).toBeGreaterThan(50); expect(result[2].polygon[2].y).toBeLessThan(50);
  expect(result[0].reflection).toBeGreaterThan(0); expect(result[2].reflection).toBe(0);
});
it('厚みと反射は独立し、最大設定でも有限・有界', () => {
  const base = resolveGlassMaterial({ enabled: true, edgeReflection: 100 });
  const a = shadeGlassStrip(strip, base, createGlassLight(90), 10000);
  const b = shadeGlassStrip(strip, { ...base, thickness: 100 }, createGlassLight(90), 10000);
  expect(a.map(p => p.reflection)).toEqual(b.map(p => p.reflection));
  for (const panel of b) {
    expect([panel.alpha, panel.shadow, panel.reflection].every(n => n >= 0 && n <= 1)).toBe(true);
    expect(panel.lineWidth).toBeLessThanOrEqual(1.6);
    expect(panel.polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.y - 50) <= 6)).toBe(true);
  }
});
