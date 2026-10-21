import { EditorState } from '../src/state/editorState';
import { GlassMaterialState, type GlassMaterialFrame } from '../src/state/glassMaterialState';
import { renderGlassScene } from '../src/render/renderGlassScene';
import { renderGlassInteriors } from '../src/render/renderGlassInteriors';
import { createGlassLight } from '../src/core/glassMaterial';
import { regionContains } from '../src/core/shardProtection';
import type { GlassInteriorPlan } from '../src/core/glassTexture';
/** Native Canvas checks invoked by glass-material-ui.cjs, independent of the comparison page controls. */
export function verifyGlassTexture(): string[] {
  const passed: string[] = [], size = { width: 320, height: 240 };
  const check = (condition: boolean, name: string) => { if (!condition) throw new Error(name); passed.push(name); };
  const canvas = () => { const c = document.createElement('canvas'); c.width = size.width; c.height = size.height; return c; };
  const source = canvas(), sourceCtx = source.getContext('2d')!;
  sourceCtx.fillStyle = '#8090a0'; sourceCtx.fillRect(0, 0, 160, 240);
  sourceCtx.fillStyle = '#8090a080'; sourceCtx.fillRect(160, 0, 100, 240);
  const state = new EditorState(size); state.add({ x: 140, y: 120 }); state.update({ seed: 42, params: { centerDensity: 0, centerRadius: 40 } });
  const material = new GlassMaterialState(size); material.update({ enabled: true, interiorReflection: 100 });
  const frame = material.prepare(state.impacts);
  const draw = (f?: GlassMaterialFrame, mode: 'composite' | 'cracks' = 'composite') => {
    const c = canvas(), ctx = c.getContext('2d')!;
    const status = renderGlassScene(ctx, source, state.impacts, size, mode, undefined, f);
    return { c, status, data: ctx.getImageData(0, 0, c.width, c.height).data };
  };
  const original = draw(), active = draw(frame);
  check(active.status.effectsApplied && active.c.toDataURL() !== original.c.toDataURL(), 'interior-only effect works with all image transforms zero');
  check(active.data.every((v, i) => i % 4 !== 3 || v === original.data[i]), 'interior-only drawing preserves every alpha value including transparent pixels');
  check(draw(frame, 'cracks').c.toDataURL() === draw(undefined, 'cracks').c.toDataURL(), 'interior reflection is excluded from crack-only output');
  check(draw(frame).c.toDataURL() === active.c.toDataURL(), 'same input reproduces exact pixels');
  check(frame.interior?.ok === true && frame.interior.plan.protectedCount > 0, 'whole-shard protection applied');
  const cores = frame.geometry.ok ? frame.geometry.geometry.protections : [];
  let protectedDifferences = 0;
  const core = cores[0].protectedCore!;
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) if (Math.hypot(x + .5 - core.origin.x, y + .5 - core.origin.y) < core.radius - 1) {
    const offset = (y * size.width + x) * 4;
    for (let k = 0; k < 4; k++) if (active.data[offset + k] !== original.data[offset + k]) protectedDifferences++;
  }
  check(protectedDifferences === 0, 'protected center remains unchanged');
  const partition = state.shards.resolve(state.impacts, true)!;
  const protectedIds = new Set(partition.plan?.motions.filter(m => m.reason === 'protected').map(m => m.regionId));
  const protectedRegions = partition.extraction.ok ? partition.extraction.graph.regions.filter(r => protectedIds.has(r.id)) : [];
  let protectedShardChanges = 0, checkedOutsideCore = 0;
  for (let y = 2; y < 238; y += 3) for (let x = 2; x < 318; x += 3) {
    if (Math.hypot(x - core.origin.x, y - core.origin.y) <= core.radius + 2) continue;
    if (!protectedRegions.some(r => [-2, 2].every(dx => [-2, 2].every(dy => regionContains(r, { x: x + dx, y: y + dy }))))) continue;
    checkedOutsideCore++;
    const offset = (y * 320 + x) * 4;
    for (let k = 0; k < 4; k++) if (active.data[offset + k] !== original.data[offset + k]) protectedShardChanges++;
  }
  check(checkedOutsideCore > 0 && protectedShardChanges === 0, 'entire protected shards stay unchanged beyond the core circle');
  material.update({ interiorReflection: 0, microDetail: 100 }); const detailFrame = material.prepare(state.impacts);
  check(draw(detailFrame, 'cracks').c.toDataURL() !== draw(undefined, 'cracks').c.toDataURL(), 'micro-detail-only works on transparent crack layer');
  const microPixels = draw(detailFrame, 'cracks').data;
  let leaked = 0;
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) if (Math.hypot(x + .5 - core.origin.x, y + .5 - core.origin.y) < core.radius - 1 && microPixels[(y * size.width + x) * 4 + 3] !== 0) leaked++;
  check(leaked === 0, 'micro details do not leak into protected center');
  material.update({ microDetail: 0 }); check(draw(material.prepare(state.impacts)).c.toDataURL() === original.c.toDataURL(), 'all four new effects zero restores exact legacy pixels');
  // Render a hole-bearing shard alone, so the unpainted hole can be checked directly.
  const ring = [{ x: 10, y: 10 }, { x: 300, y: 10 }, { x: 300, y: 220 }, { x: 10, y: 220 }];
  const hole = [{ x: 80, y: 60 }, { x: 120, y: 60 }, { x: 120, y: 100 }, { x: 80, y: 100 }];
  const plan: GlassInteriorPlan = { protectedCount: 0, budgetCount: 0, surfaces: [{ region: { id: 'donut', outer: ring, holes: [hole], area: 59300, centroid: { x: 155, y: 115 }, boundaryEdgeIds: [] }, surfaceNormal: { x: 0, y: 0, z: 1 }, variation: 1 }] };
  const c = canvas(), ctx = c.getContext('2d')!; ctx.drawImage(source, 0, 0); ctx.globalAlpha = .7; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  renderGlassInteriors(ctx, plan, createGlassLight(0), 100);
  check(ctx.globalAlpha === .7 && ctx.globalCompositeOperation === 'source-over' && ctx.filter === 'none', 'interior rendering restores Canvas state');
  const before = sourceCtx.getImageData(0, 0, 320, 240).data, after = ctx.getImageData(0, 0, 320, 240).data;
  let holes = 0, outside = 0, maxDifference = 0;
  for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) {
    const offset = (y * 320 + x) * 4;
    for (let k = 0; k < 4; k++) {
      const delta = Math.abs(before[offset + k] - after[offset + k]);
      if (x > 82 && x < 118 && y > 62 && y < 98) holes += delta;
      if (x < 8 || x > 302 || y < 8 || y > 222) outside += delta;
      if (before[offset + 3] === 255) maxDifference = Math.max(maxDifference, delta);
    }
  }
  check(holes === 0 && outside === 0, 'holes and outside-shard pixels untouched');
  check(maxDifference > 0 && maxDifference <= 10, 'maximum-strength interior effect stays subtle');
  return passed;
}
