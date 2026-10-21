import { expect, it } from 'vitest';
import { extractShardRegions, type ShardGraph } from './shardRegions';
import { prepareGlassDetails, prepareGlassInteriors, shadeGlassInterior, GLASS_TEXTURE_LIMITS } from './glassTexture';
import { createGlassLight } from './glassMaterial';
import { GlassMaterialState } from '../state/glassMaterialState';
import { EditorState } from '../state/editorState';
import { prepareGlassGeometry } from './glassGeometry';
const size = { width: 400, height: 300 };
function graph(): ShardGraph {
  const result = extractShardRegions(size, [{ id: 'split', start: { x: 200, y: 0 }, end: { x: 200, y: 300 } }]);
  if (!result.ok) throw new Error(result.message); return result.graph;
}
function plan(seed = 42) { const result = prepareGlassInteriors(graph(), size, seed, []); if (!result.ok) throw new Error(result.message); return result.plan; }
it('同じシードから同じ内部材質・擬似法線を再現し、別シードで変化する', () => {
  expect(plan()).toEqual(plan()); expect(plan(43)).not.toEqual(plan());
  for (const surface of plan().surfaces) expect(Math.hypot(surface.surfaceNormal.x, surface.surfaceNormal.y, surface.surfaceNormal.z)).toBeCloseTo(1);
});
it('保護領域と重なる破片全体を除外し、円形の画像境界を追加しない', () => {
  const result = prepareGlassInteriors(graph(), size, 42, [{ kind: 'circle', origin: { x: 100, y: 150 }, radius: 30 }]);
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.plan.protectedCount).toBe(1); expect(result.plan.surfaces).toHaveLength(1);
  expect(result.plan.surfaces[0].region.centroid.x).toBeGreaterThan(200);
});
it('大きい破片を優先し、256個を超える小片を据え置く', () => {
  const input = graph(), original = input.regions[0];
  input.regions = Array.from({ length: 300 }, (_, i) => ({ ...original, id: `piece${i}`, area: i + 1 }));
  const result = prepareGlassInteriors(input, size, 42, []); expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.plan.surfaces).toHaveLength(GLASS_TEXTURE_LIMITS.interiors); expect(result.plan.budgetCount).toBe(44);
  expect(result.plan.surfaces[0].region.area).toBe(300); expect(result.plan.surfaces.at(-1)!.region.area).toBe(45);
});
it('光源・強度を変更しても領域は維持され、最大でも非常に弱い非一様な反射', () => {
  const surface = plan().surfaces[0], before = structuredClone(surface);
  const a = shadeGlassInterior(surface, createGlassLight(0), 100), b = shadeGlassInterior(surface, createGlassLight(180), 100);
  expect(a.start.x).toBeLessThan(a.end.x); expect(b.start.x).toBeGreaterThan(b.end.x);
  expect(a.alpha).toBeGreaterThan(0); expect(a.alpha).toBeLessThanOrEqual(.04);
  expect(shadeGlassInterior(surface, createGlassLight(0), 0).alpha).toBe(0);
  expect(shadeGlassInterior(surface, createGlassLight(0), 50).alpha).toBeCloseTo(a.alpha / 2);
  expect(surface).toEqual(before);
});
it('閉じた境界がない場合は内部反射なし、不正・上限超過は安全に失敗', () => {
  const empty = extractShardRegions(size, []); if (!empty.ok) throw new Error(empty.message);
  expect(prepareGlassInteriors(empty.graph, size, 42, [])).toMatchObject({ ok: true, plan: { surfaces: [] } });
  expect(prepareGlassInteriors(graph(), size, NaN, []).ok).toBe(false);
  const invalid = graph(); invalid.regions[0].outer[0].x = NaN;
  expect(prepareGlassInteriors(invalid, size, 42, []).ok).toBe(false);
  expect(prepareGlassInteriors({ ...graph(), regions: Array(10001).fill(graph().regions[0]) }, size, 42, []).ok).toBe(false);
});
it('微細欠けは決定的・少数・有限で、分岐に追加せず、入力を変更しない', () => {
  const editor = new EditorState(size); editor.add({ x: 180, y: 130 }); editor.update({ seed: 42 });
  const result = prepareGlassGeometry(editor.impacts, size); if (!result.ok) throw new Error(result.message);
  const before = structuredClone(result.geometry), seeds = new Map([[editor.impacts[0].id, 42]]);
  const details = prepareGlassDetails(result.geometry, seeds);
  expect(details.length).toBeGreaterThan(0); expect(details.length).toBeLessThanOrEqual(256);
  expect(details).toEqual(prepareGlassDetails(result.geometry, seeds));
  expect(details).not.toEqual(prepareGlassDetails(result.geometry, new Map([[editor.impacts[0].id, 43]])));
  expect(details.every(d => d.polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))).toBe(true);
  expect(prepareGlassDetails({ ...result.geometry, strips: result.geometry.strips.map(s => ({ ...s, type: 'branch' })) }, seeds)).toEqual([]);
  expect(result.geometry).toEqual(before);
});
it('画像変形0でも内部反射を準備し、光源と全材質スライダーで形状を再計算しない', () => {
  const editor = new EditorState(size); editor.add({ x: 180, y: 130 });
  const material = new GlassMaterialState(size); material.update({ enabled: true, interiorReflection: 30 });
  const first = material.prepare(editor.impacts), before = structuredClone(editor.impacts);
  expect(first.interior?.ok).toBe(true); if (first.interior?.ok) expect(first.interior.plan.surfaces.length).toBeGreaterThan(0);
  material.update({ interiorReflection: 100, lightDirection: 90, microDetail: 100, thickness: 100, edgeReflection: 100 });
  const second = material.prepare(editor.impacts);
  expect(second.geometry).toBe(first.geometry); expect(second.interior).toBe(first.interior); expect(second.details).toBe(first.details); expect(material.preparations).toBe(1);
  expect(editor.impacts).toEqual(before); expect(editor.shards.resolve(editor.impacts)).toBeUndefined();
});
it('内部反射0へ戻してもキャッシュを保持し、再有効化で同じデータを使う', () => {
  const editor = new EditorState(size); editor.add({ x: 180, y: 130 });
  const material = new GlassMaterialState(size); material.update({ enabled: true, interiorReflection: 30 }); const first = material.prepare(editor.impacts);
  material.update({ interiorReflection: 0 }); expect(material.prepare(editor.impacts).interior).toBeUndefined();
  material.update({ interiorReflection: 50 }); expect(material.prepare(editor.impacts).interior).toBe(first.interior);
});
it('穴を持つ破片と、その穴にある保護円を正しく区別する', () => {
  const input = graph(), r = input.regions[0];
  r.holes = [[{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 250 }, { x: 50, y: 250 }]];
  const result = prepareGlassInteriors(input, size, 42, [{ kind: 'circle', origin: { x: 100, y: 150 }, radius: 10 }]);
  expect(result.ok && result.plan.protectedCount).toBe(0);
  expect(result.ok && result.plan.surfaces.find(s => s.region.id === r.id)?.region.holes).toEqual(r.holes);
});
it('微細欠け候補が多くても全画像で256個に制限する', () => {
  const editor = new EditorState(size); editor.add({ x: 180, y: 130 });
  const result = prepareGlassGeometry(editor.impacts, size); if (!result.ok) throw new Error(result.message);
  const radial = result.geometry.strips.find(s => s.type === 'radial')!;
  const crowded = { ...result.geometry, strips: Array.from({ length: 4096 }, (_, i) => ({ ...radial, id: `candidate${i}` })) };
  expect(prepareGlassDetails(crowded, new Map([[radial.impactId, 42]]))).toHaveLength(256);
});
it('抽出失敗時は内部反射だけ省略し、亀裂材質と微細欠けのデータを残す', () => {
  const editor = new EditorState(size); editor.add({ x: 180, y: 130 });
  const material = new GlassMaterialState(size); material.update({ enabled: true, interiorReflection: 50, microDetail: 50 });
  const frame = material.prepare(editor.impacts, { extraction: { ok: false, reason: 'limit-exceeded', message: 'test' } });
  expect(frame.geometry.ok).toBe(true); expect(frame.interior?.ok).toBe(false); expect(frame.details!.length).toBeGreaterThan(0);
});
