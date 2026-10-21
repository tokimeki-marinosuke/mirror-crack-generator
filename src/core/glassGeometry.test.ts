import { expect, it } from 'vitest';
import { prepareGlassGeometry, GLASS_GEOMETRY_LIMITS, type GlassGeometry } from './glassGeometry';
import { generateCracks, DEFAULT_CRACK_PARAMS } from './generateCracks';
import { generateFractureSurface } from './generateFractureSurface';
import { EditorState } from '../state/editorState';
import { GlassMaterialState } from '../state/glassMaterialState';
const size = { width: 800, height: 500 }, origin = { x: 360, y: 230 };
function fixture(centerDensity = 50, width = 60) {
  const pattern = generateCracks(size, origin, 42, { ...DEFAULT_CRACK_PARAMS, centerDensity });
  return { id: 1, pattern, fracture: generateFractureSurface(pattern, size, width, 70) };
}
function geometry(input = fixture()): GlassGeometry {
  const result = prepareGlassGeometry([input], size); if (!result.ok) throw new Error(result.message); return result.geometry;
}
it('既存の両側輪郭をそのまま使い、有限な単位法線と安定経路位置を保持する', () => {
  const input = fixture(), g = geometry(input);
  for (const face of input.fracture.faces.filter(f => !f.kind)) {
    const strips = g.strips.filter(s => s.pathId === face.pathId && s.region === face.region && s.strength === face.strength);
    expect(strips).toHaveLength(1);
    const strip = strips[0], half = face.polygon.length / 2;
    expect(strip.samples.map(s => s.left.point)).toEqual(face.polygon.slice(0, half));
    expect(strip.samples.map(s => s.right.point)).toEqual(face.polygon.slice(half).reverse());
  }
  for (const strip of g.strips) for (let i = 0; i < strip.samples.length; i++) {
    const s = strip.samples[i]; if (i) expect(s.position).toBeGreaterThan(strip.samples[i - 1].position);
    expect(Math.hypot(s.left.normal.x, s.left.normal.y)).toBeCloseTo(1, 12);
    expect(Math.hypot(s.right.normal.x, s.right.normal.y)).toBeCloseTo(1, 12);
    expect(Math.hypot(s.tangent.x, s.tangent.y)).toBeCloseTo(1, 12);
  }
});
it('同一入力で再現し、亀裂・破断面・トポロジーを変更しない', () => {
  const input = fixture(), before = structuredClone(input), first = geometry(input);
  expect(geometry(input)).toEqual(first); expect(input).toEqual(before);
});
it('隙間幅0でも法線と両側の基準輪郭を準備できる', () => {
  const input = fixture(0, 0), g = geometry(input);
  expect(g.strips.length).toBeGreaterThan(0);
  expect(g.strips.every(s => s.samples.every(p => p.left.point.x === p.center.x && p.right.point.y === p.center.y))).toBe(true);
  expect(g.strips.every(s => s.region === 'outer')).toBe(true);
  expect(g.protections[0].protectedCore!.radius).toBe(input.pattern.protectedRadius);
});
it('中心密度変更で外側の材質データが変わらない', () => {
  const outer = (density: number) => geometry(fixture(density)).strips.filter(s => s.region === 'outer');
  expect(outer(0)).toEqual(outer(100));
});
it('光源・厚み・強度では幾何も既存の分割も更新しない', () => {
  const state = new EditorState(size); state.add(origin); state.updateSurface({ widthPercent: 60 }); state.shards.update({ displacement: 30 });
  const composition = state.shards.resolve(state.impacts), material = new GlassMaterialState(size);
  const first = material.prepare(state.impacts, composition), before = structuredClone(state.impacts);
  material.update({ enabled: true, lightDirection: 90, thickness: 100, edgeReflection: 60 });
  const next = material.prepare(state.impacts, state.shards.resolve(state.impacts));
  expect(next.geometry).toBe(first.geometry); expect(material.preparations).toBe(1); expect(state.shards.extractions).toBe(1);
  expect(state.impacts).toEqual(before); expect(next.light.angle).toBe(90);
  state.updateSurface({ widthPercent: 30 }); material.prepare(state.impacts, state.shards.resolve(state.impacts));
  expect(material.preparations).toBe(2); expect(state.shards.extractions).toBe(1);
});
it('破片境界への由来と左右領域を接続し、元の破片を変更しない', () => {
  const state = new EditorState(size); state.add(origin); state.update({ seed: 42 }); state.shards.update({ displacement: 30 });
  const composition = state.shards.resolve(state.impacts)!;
  expect(composition.extraction.ok).toBe(true); const before = structuredClone(composition);
  const result = prepareGlassGeometry(state.impacts, size, composition.extraction.ok ? composition.extraction.graph : undefined);
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.geometry.shards.length).toBeGreaterThan(0);
  expect(result.geometry.edgeBindings.some(b => b.shardSides.length > 0)).toBe(true);
  expect(result.geometry.shards.every(s => s.surfaceNormal.z === 1)).toBe(true); expect(composition).toEqual(before);
});
it('旧形式・空・退化経路も扱い、不正データや予算超過は部分結果を返さない', () => {
  const legacy = { id: 1, pattern: { origin, seed: 42, segments: [] } };
  const old = prepareGlassGeometry([legacy], size); expect(old.ok && old.geometry.unsupportedImpactIds).toEqual([1]);
  expect(prepareGlassGeometry([], size).ok).toBe(true);
  const input = fixture(); input.pattern.topology!.edges[0].segmentIndex = -1;
  expect(prepareGlassGeometry([input], size)).toMatchObject({ ok: false, reason: 'invalid-geometry' });
  const many = fixture(); many.pattern.topology!.edges = Array.from({ length: GLASS_GEOMETRY_LIMITS.edges + 1 }, () => many.pattern.topology!.edges[0]);
  expect(prepareGlassGeometry([many], size)).toMatchObject({ ok: false, reason: 'limit-exceeded' });
});
it('画像境界・最大設定でも有限でサンプル上限以内', () => {
  const pattern = generateCracks(size, { x: 0, y: 0 }, 42, { ...DEFAULT_CRACK_PARAMS, radialCount: 24, complexity: 100, centerDensity: 100, centerRadius: 80 });
  const fracture = generateFractureSurface(pattern, size, 100, 100);
  const result = prepareGlassGeometry([{ id: 1, pattern, fracture }], size); expect(result.ok).toBe(true);
  if (result.ok) expect(result.geometry.strips.reduce((sum, s) => sum + s.samples.length, 0)).toBeLessThanOrEqual(GLASS_GEOMETRY_LIMITS.samples);
});
it('直線の左右法線は逆向きで、X字分割後の左右領域も元経路の向きに一致', async () => {
  const { TopologyBuilder } = await import('./crackTopology');
  const { extractShardRegions } = await import('./shardRegions');
  const segments = [
    { start: { x: 400, y: 500 }, end: { x: 400, y: 0 }, type: 'radial' as const },
    { start: { x: 0, y: 250 }, end: { x: 800, y: 250 }, type: 'radial' as const },
  ];
  const builder = new TopologyBuilder(); segments.forEach((s, i) => { builder.register(`p${i}`, 'radial', [s.start, s.end]); builder.add(i, s, `p${i}`, 'outer'); });
  const pattern = { origin, seed: 42, segments, topology: builder.finish(origin, 0, 100) };
  const extracted = extractShardRegions(size, segments.map((s, i) => ({ ...s, id: `impact-1/${i}` })));
  if (!extracted.ok) throw new Error(extracted.message);
  const result = prepareGlassGeometry([{ id: 1, pattern }], size, extracted.graph);
  if (!result.ok) throw new Error(result.message);
  for (const strip of result.geometry.strips) for (const s of strip.samples) {
    expect(s.left.normal.x).toBeCloseTo(-s.right.normal.x); expect(s.left.normal.y).toBeCloseTo(-s.right.normal.y);
  }
  for (const binding of result.geometry.edgeBindings) {
    expect(binding.shardSides).toHaveLength(2);
    const segment = segments[binding.pathId === 'p0' ? 0 : 1], dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    for (const link of binding.shardSides) for (const side of ['leftRegionId', 'rightRegionId'] as const) {
      const center = extracted.graph.regions.find(r => r.id === link[side])!.centroid;
      const cross = dx * (center.y - segment.start.y) - dy * (center.x - segment.start.x);
      if (side === 'leftRegionId') expect(cross).toBeGreaterThan(0); else expect(cross).toBeLessThan(0);
    }
  }
});
it('不正な光源・経路で以前の状態や入力を壊さない', () => {
  const state = new GlassMaterialState(size), before = state.settings, light = state.light;
  expect(() => state.update({ lightDirection: Infinity })).toThrow(); expect(state.settings).toBe(before); expect(state.light).toBe(light);
  const input = fixture(); input.pattern.topology!.paths[0].reference[0].x = NaN;
  expect(prepareGlassGeometry([input], size)).toMatchObject({ ok: false, reason: 'invalid-geometry' });
});
