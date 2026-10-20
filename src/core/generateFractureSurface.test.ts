import { generateFractureSurface as stage2 } from '../../tests/fixtures/fractureStage2';
import { expect, it } from 'vitest';
import { generateCracks, DEFAULT_CRACK_PARAMS } from './generateCracks';
import { generateFractureSurface, MAX_FRACTURE_VERTICES, MAX_FRACTURE_FACES } from './generateFractureSurface';
const size = { width: 800, height: 500 }, origin = { x: 400, y: 250 };
const pattern = () => generateCracks(size, origin, 42);
it('同じ経路・シード・幅は同じ破断面になり、入力を変更しない', () => {
  const input = pattern(), before = structuredClone(input);
  const first = generateFractureSurface(input, size, 75);
  expect(first.faces.length).toBeGreaterThan(0);
  expect(generateFractureSurface(input, size, 75)).toEqual(first);
  expect(input).toEqual(before);
  expect(first.faces.every(face => face.pathId.startsWith('radial/'))).toBe(true);
  expect(first.faces.every(face => face.polygon.length >= 4 && face.reflection.length >= 2)).toBe(true);
});
it('幅0と旧形式パターンでは破断面を生成しない', () => {
  expect(generateFractureSurface(pattern(), size, 0).faces).toEqual([]);
  const { topology, ...legacy } = pattern();
  expect(generateFractureSurface(legacy, size, 100).faces).toEqual([]);
});
it('幅変更は中心線と経路を維持し、最大幅に比例する', () => {
  const input = pattern(); const before = structuredClone(input);
  const small = generateFractureSurface(input, size, 25), large = generateFractureSurface(input, size, 100);
  expect(large.maximumWidth).toBe(small.maximumWidth * 4);
  expect(large.faces.map(f => [f.pathId, f.region, f.strength])).toEqual(small.faces.map(f => [f.pathId, f.region, f.strength]));
  expect(input).toEqual(before);
});
it('接続点の追加でも同じ主要経路の幅プロファイルが変わらない', () => {
  const a = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, concentricDensity: 0, centerRadius: 0 });
  const b = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, concentricDensity: 100, centerRadius: 0 });
  expect(generateFractureSurface(a, size, 70)).toEqual(generateFractureSurface(b, size, 70));
});
it('中心密度変更でも外側の破断面を維持し、密度0は中心面を生成しない', () => {
  const zero = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity: 0 });
  const full = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity: 100 });
  const outside = generateFractureSurface(zero, size, 100);
  expect(outside.faces.every(face => face.region === 'outer')).toBe(true);
  expect(generateFractureSurface(full, size, 100).faces.filter(face => face.region === 'outer')).toEqual(outside.faces);
});
it('画像の角・極小画像・最大設定でも有限で、頂点・面の予算を超えない', () => {
  for (const image of [{ width: 1, height: 1 }, size, { width: 8192, height: 2048 }]) for (const centerDensity of [0, 100]) {
    const input = generateCracks(image, { x: image.width, y: 0 }, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity, centerRadius: 80, complexity: 100, radialCount: 24, lengthPercent: 150 });
    const geometry = generateFractureSurface(input, image, 100);
    expect(geometry.faces.length).toBeLessThanOrEqual(MAX_FRACTURE_FACES);
    expect(geometry.faces.reduce((n, face) => n + face.polygon.length, 0)).toBeLessThanOrEqual(MAX_FRACTURE_VERTICES);
    expect(geometry.faces.every(face => [...face.polygon, ...face.reflection].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))).toBe(true);
    expect(geometry.maximumWidth).toBeLessThanOrEqual(24);
  }
});
it.each([NaN, Infinity, -1, 101])('不正な幅%sを拒否', width => {
  expect(() => generateFractureSurface(pattern(), size, width)).toThrow();
});
it('欠けは決定的な主要経路の三角形で、中心線と既存の帯を変更しない', () => {
  const input = pattern(), before = structuredClone(input);
  const result = generateFractureSurface(input, size, 80, 100);
  expect(result).toEqual(generateFractureSurface(input, size, 80, 100));
  expect(result.faces.filter(f => !f.kind)).toEqual(generateFractureSurface(input, size, 80).faces);
  expect(result.faces.filter(f => f.kind).length).toBeGreaterThan(0);
  expect(result.faces.filter(f => f.kind).every(f => f.polygon.length === 3 && f.position! > 0 && f.position! < 1 && f.pathId.startsWith('radial/'))).toBe(true);
  expect(input).toEqual(before);
  expect(generateFractureSurface(input, size, 0, 100).faces).toEqual([]);
});
it('中心密度0で中心の欠けはなく、密度変更でも外側の欠けを維持する', () => {
  const make = (centerDensity: number) => generateFractureSurface(generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity }), size, 100, 100);
  const empty = make(0), full = make(100);
  expect(empty.faces.every(f => f.region === 'outer')).toBe(true);
  expect(full.faces.filter(f => f.region === 'outer')).toEqual(empty.faces);
  expect(full.faces.filter(f => f.region === 'center' && f.kind).length).toBeGreaterThan(0);
});
it('欠け密度の増加で既存候補の位置は変わらず、強度が連続的に増える', () => {
  const low = generateFractureSurface(pattern(), size, 80, 35).faces.filter(f => f.kind);
  const high = generateFractureSurface(pattern(), size, 80, 36).faces.filter(f => f.kind);
  expect(low.length).toBeGreaterThan(0);
  for (const face of low) {
    const next = high.find(f => f.pathId === face.pathId && f.position === face.position && f.region === face.region)!;
    expect(next.polygon).toEqual(face.polygon);
    expect(next.strength).toBeGreaterThanOrEqual(face.strength);
    expect(next.strength - face.strength).toBeLessThanOrEqual(1 / 15 + 1e-12);
  }
});
it('最大欠け・画像境界・多数衝撃点でも有限で予算内', () => {
  for (const point of [origin, { x: 0, y: 0 }, { x: 800, y: 500 }]) {
    const input = generateCracks(size, point, 123, { ...DEFAULT_CRACK_PARAMS, radialCount: 24, centerDensity: 100, complexity: 100, lengthPercent: 150 });
    const result = generateFractureSurface(input, size, 100, 100);
    expect(result.faces.length).toBeLessThanOrEqual(MAX_FRACTURE_FACES);
    expect(result.faces.reduce((n, f) => n + f.polygon.length, 0)).toBeLessThanOrEqual(MAX_FRACTURE_VERTICES);
    expect(result.faces.flatMap(f => f.polygon).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  }
});
it.each([NaN, Infinity, -1, 101])('不正な欠け密度%sを拒否', density => {
  expect(() => generateFractureSurface(pattern(), size, 80, density)).toThrow();
});

it('欠け0は第2段階49abaafの幾何データと完全一致', () => {
  for (const centerDensity of [0, 50, 100]) for (const width of [0, 50, 100]) {
    const input = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity });
    expect(generateFractureSurface(input, size, width, 0)).toEqual(stage2(input, size, width));
  }
});
