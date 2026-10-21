import type { CircleRegion } from './crackTopology';
import type { Point, Size } from './geometry';
import type { GlassGeometry } from './glassGeometry';
import type { GlassLight, Vector3 } from './glassMaterial';
import { createRandom } from './random';
import type { ShardGraph, ShardRegion } from './shardRegions';
import { createShardTransformPlan } from './shardTransforms';
export const GLASS_TEXTURE_LIMITS = Object.freeze({ interiors: 256, details: 256 });
export type GlassInterior = { region: ShardRegion; surfaceNormal: Vector3; variation: number };
export type GlassInteriorPlan = { surfaces: GlassInterior[]; protectedCount: number; budgetCount: number };
export type GlassInteriorResult = { ok: true; plan: GlassInteriorPlan } | { ok: false; message: string };
export type GlassDetail = { impactId: number; region: 'center' | 'outer'; polygon: Point[]; normal: Point; strength: number };
function randomFor(seed: number, key: string): () => number {
  let hash = seed >>> 0;
  for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return createRandom(hash >>> 0);
}
/** Whole-shard protection and area priority reuse the existing transform policy; no shape changes. */
export function prepareGlassInteriors(graph: ShardGraph, size: Size, seed: number, cores: readonly CircleRegion[]): GlassInteriorResult {
  if (graph.regions.length > 10000 || graph.vertices.length > 30000 || graph.edges.length > 30000) return { ok: false, message: '内部反射の幾何上限を超えました。' };
  if (!graph.edges.some(e => e.kind === 'shard-boundary')) return { ok: true, plan: { surfaces: [], protectedCount: 0, budgetCount: 0 } };
  try {
    const motion = createShardTransformPlan(graph, size, seed, { displacement: 0, rotation: 0 }, cores);
    const regions = new Map(graph.regions.map(r => [r.id, r]));
    const surfaces: GlassInterior[] = [];
    for (const shard of motion.motions) if (shard.reason === 'active') {
      const random = randomFor(seed, shard.regionId), heading = random() * Math.PI * 2, tilt = .08 + random() * .12;
      surfaces.push({ region: regions.get(shard.regionId)!, surfaceNormal: { x: Math.cos(heading) * tilt, y: Math.sin(heading) * tilt, z: Math.sqrt(1 - tilt * tilt) }, variation: .55 + random() * .45 });
    }
    return { ok: true, plan: { surfaces, protectedCount: motion.motions.filter(m => m.reason === 'protected').length, budgetCount: motion.motions.filter(m => m.reason === 'budget').length } };
  } catch { return { ok: false, message: '内部反射の入力が不正です。' }; }
}
/** Neutral, weak directional gradient. Angle/light changes never alter the shard partition. */
export function shadeGlassInterior(surface: GlassInterior, light: GlassLight, intensity: number): { start: Point; end: Point; alpha: number } {
  const direction = light.screenDirection, points = surface.region.outer;
  let low = Infinity, high = -Infinity;
  for (const point of points) { const d = point.x * direction.x + point.y * direction.y; low = Math.min(low, d); high = Math.max(high, d); }
  const c = surface.region.centroid, projection = c.x * direction.x + c.y * direction.y;
  const at = (distance: number): Point => ({ x: c.x + direction.x * (distance - projection), y: c.y + direction.y * (distance - projection) });
  const tilt = surface.surfaceNormal.x * direction.x + surface.surfaceNormal.y * direction.y;
  return { start: at(low), end: at(Math.max(low + 1e-6, high)), alpha: .04 * Math.max(0, Math.min(100, intensity)) / 100 * surface.variation * (.7 + tilt) };
}
/** Fixed seed-based candidates; slider values affect opacity, never placement or crack generation. */
export function prepareGlassDetails(geometry: GlassGeometry, seeds: ReadonlyMap<number, number>): GlassDetail[] {
  const details: GlassDetail[] = [], scale = Math.min(2, Math.max(.3, Math.min(geometry.size.width, geometry.size.height) / 400));
  for (const strip of geometry.strips) {
    if (details.length >= GLASS_TEXTURE_LIMITS.details) break;
    if (strip.type !== 'radial' || strip.samples.length < 4) continue;
    const random = randomFor(seeds.get(strip.impactId) ?? 0, strip.id);
    if (random() > .4) continue;
    for (let i = 0; i < 2 && details.length < GLASS_TEXTURE_LIMITS.details; i++) {
      const sample = strip.samples[1 + Math.floor(random() * (strip.samples.length - 2))];
      const side = random() < .5 ? sample.left : sample.right;
      const length = scale * (.7 + random() * .8), depth = scale * (.25 + random() * .4), p = side.point, t = sample.tangent, n = side.normal;
      details.push({ impactId: strip.impactId, region: strip.region, normal: { ...n }, strength: strip.strength,
        polygon: [{ x: p.x - t.x * length, y: p.y - t.y * length }, { x: p.x + t.x * length, y: p.y + t.y * length }, { x: p.x + n.x * depth, y: p.y + n.y * depth }] });
    }
  }
  return details;
}
