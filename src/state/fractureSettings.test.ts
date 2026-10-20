import { expect, it } from 'vitest';
import { PRESETS } from './editorState';
import { resolveFractureSettings } from './fractureSettings';

it('未指定では現行の全設定を維持し、破断面は無効', () => {
  for (const base of Object.values(PRESETS)) {
    const result = resolveFractureSettings(base);
    expect({ ...result.geometry, ...result.line }).toEqual(base);
    expect(result.surface.widthPercent).toBe(0);
  }
});
it('マクロは広がり・分岐・破砕の提案値をまとめ、個別指定を最優先する', () => {
  const base = Object.freeze({ ...PRESETS.realistic, centerDensity: 0 });
  const strong = resolveFractureSettings(base, { impactStrength: 100 });
  expect(strong.geometry.lengthPercent).toBeGreaterThan(base.lengthPercent);
  expect(strong.geometry.complexity).toBeGreaterThan(base.complexity);
  expect(strong.surface.chipDensity).toBe(100);
  expect(strong.geometry.centerDensity).toBe(0);
  expect(strong.protection.preserveCenter).toBe(true);
  const custom = resolveFractureSettings(base, { impactStrength: 100,
    overrides: { lengthPercent: 30, complexity: 10, centerDensity: 0 }, surface: { chipDensity: 5 } });
  expect(custom.geometry).toMatchObject({ lengthPercent: 30, complexity: 10, centerDensity: 0 });
  expect(custom.surface.chipDensity).toBe(5);
});
it('中立マクロは中心線設定を維持し、中心領域・線幅・不透明度・反射を変更しない', () => {
  const neutral = resolveFractureSettings(PRESETS.anime, { impactStrength: 50 });
  expect({ ...neutral.geometry, ...neutral.line }).toEqual(PRESETS.anime);
  for (const impactStrength of [0, 100]) {
    const result = resolveFractureSettings(PRESETS.anime, { impactStrength });
    expect(result.geometry.centerRadius).toBe(PRESETS.anime.centerRadius);
    expect(result.geometry.centerDensity).toBe(PRESETS.anime.centerDensity);
    expect(result.line).toEqual(neutral.line);
  }
});
it('細線幅と破断面幅・暗部は独立し、破断面変更では中心線設定を変えない', () => {
  const base = resolveFractureSettings(PRESETS.realistic);
  const wide = resolveFractureSettings(PRESETS.realistic, { surface: { widthPercent: 100, darkness: 0 } });
  expect(wide.geometry).toEqual(base.geometry);
  expect(wide.line).toEqual(base.line);
  expect(wide.surface).toMatchObject({ widthPercent: 100, darkness: 0 });
  const thin = resolveFractureSettings(PRESETS.realistic, { overrides: { lineWidth: 6 } });
  expect(thin.surface).toEqual(base.surface);
});
it.each([NaN, Infinity, -1, 101])('不正な新設定%sを拒否', value => {
  expect(() => resolveFractureSettings(PRESETS.realistic, { impactStrength: value })).toThrow();
  expect(() => resolveFractureSettings(PRESETS.realistic, { surface: { widthPercent: value } })).toThrow();
  expect(() => resolveFractureSettings(PRESETS.realistic, { surface: { darkness: value } })).toThrow();
});

it('個別指定の不正値をマクロで隠さず、入力オブジェクトを変更しない', () => {
  const base = Object.freeze({ ...PRESETS.realistic });
  const overrides = Object.freeze({ centerDensity: 0, lineWidth: 2 });
  resolveFractureSettings(base, { impactStrength: 100, overrides });
  expect(base).toEqual(PRESETS.realistic);
  expect(overrides).toEqual({ centerDensity: 0, lineWidth: 2 });
  expect(() => resolveFractureSettings(base, { impactStrength: 100, overrides: { lengthPercent: 200 } })).toThrow();
  expect(() => resolveFractureSettings(base, { overrides: { radialCount: 4.5 } })).toThrow();
});
