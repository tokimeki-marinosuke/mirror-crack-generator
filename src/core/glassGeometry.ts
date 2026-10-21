import type { CircleRegion, CrackPath } from './crackTopology';
import type { CrackPattern, CrackType } from './generateCracks';
import type { FractureFace, FractureGeometry } from './generateFractureSurface';
import type { Point, Size } from './geometry';
import type { ShardGraph } from './shardRegions';
import type { Vector3 } from './glassMaterial';
export const GLASS_GEOMETRY_LIMITS = Object.freeze({ edges: 10000, strips: 4096, samples: 32768 });
export type GlassGeometryInput = Readonly<{ id: number; pattern: CrackPattern; fracture?: FractureGeometry }>;
export type GlassContourSample = {
  position: number; center: Point; tangent: Point;
  left: { point: Point; normal: Point }; right: { point: Point; normal: Point };
};
export type GlassStrip = {
  id: string; impactId: number; pathId: string; type: CrackType; region: 'center' | 'outer'; strength: number;
  sourceEdgeIds: string[]; samples: GlassContourSample[];
};
export type GlassEdgeBinding = {
  impactId: number; sourceId: string; pathId: string; edgeId: string; startPosition: number; endPosition: number;
  shardSides: { edgeId: string; leftRegionId: string | null; rightRegionId: string | null }[];
};
export type GlassShardBinding = {
  id: string; boundaryEdgeIds: string[];
  /** 初期値は正面。将来の擬似的な傾きはこの法線へ反映し、元の破片を変更しない。 */
  surfaceNormal: Vector3;
};
export type GlassGeometry = {
  size: Size; strips: GlassStrip[]; edgeBindings: GlassEdgeBinding[]; shards: GlassShardBinding[];
  protections: { impactId: number; center: CircleRegion | null; protectedCore: CircleRegion | null }[];
  unsupportedImpactIds: number[];
};
export type GlassGeometryResult = { ok: true; geometry: GlassGeometry } | { ok: false; reason: 'limit-exceeded' | 'invalid-geometry'; message: string };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const unit = (dx: number, dy: number, fallback: Point): Point => { const length = Math.hypot(dx, dy); return length > 1e-12 ? { x: dx / length, y: dy / length } : { ...fallback }; };
function pointAt(path: CrackPath, t: number): Point {
  for (let i = 1; i < path.stations.length; i++) if (t <= path.stations[i] || i === path.stations.length - 1) {
    const a = path.reference[i - 1], b = path.reference[i], span = path.stations[i] - path.stations[i - 1];
    const u = span ? clamp((t - path.stations[i - 1]) / span) : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }
  return { ...path.reference[0] };
}
const cloneCircle = (c: CircleRegion | null): CircleRegion | null => c ? { kind: 'circle', origin: { ...c.origin }, radius: c.radius } : null;
/** 可視区間と既存の帯を接続するだけ。厚み・隙間・光源を入力に持たず、元の形状を変更しない。 */
export function prepareGlassGeometry(inputs: readonly GlassGeometryInput[], size: Size, graph?: ShardGraph): GlassGeometryResult {
  const failure = (reason: 'limit-exceeded' | 'invalid-geometry', message: string): GlassGeometryResult => ({ ok: false, reason, message });
  if (inputs.length > GLASS_GEOMETRY_LIMITS.edges) return failure('limit-exceeded', '衝撃点数が材質用データの上限を超えました。');
  if (![size.width, size.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 8192) || inputs.some(i => !Number.isSafeInteger(i.id)) || new Set(inputs.map(i => i.id)).size !== inputs.length) return failure('invalid-geometry', '画像サイズまたは衝撃点IDが不正です。');
  const totalEdges = inputs.reduce((n, i) => n + (i.pattern.topology?.edges.length ?? 0), 0);
  if (inputs.length > GLASS_GEOMETRY_LIMITS.edges || totalEdges > GLASS_GEOMETRY_LIMITS.edges || (graph?.edges.length ?? 0) > 30000 || (graph?.vertices.length ?? 0) > 30000 || (graph?.regions.length ?? 0) > 10000) return failure('limit-exceeded', '材質用幾何データの上限に達しました。');
  const geometry: GlassGeometry = { size: { ...size }, strips: [], edgeBindings: [], shards: [], protections: [], unsupportedImpactIds: [] };
  const shardEdgesBySource = new Map<string, ShardGraph['edges']>();
  let provenance = 0;
  for (const edge of graph?.edges ?? []) for (const source of edge.sourceIds) {
    if (++provenance > 120000) return failure('limit-exceeded', '破片境界の対応情報が上限を超えました。');
    if (!shardEdgesBySource.has(source)) shardEdgesBySource.set(source, []);
    shardEdgesBySource.get(source)!.push(edge);
  }
  const shardVertices = new Map(graph?.vertices.map(v => [v.id, v.point]) ?? []);
  let sampleCount = 0;
  for (const input of inputs) {
    const topology = input.pattern.topology;
    if (!topology) { geometry.unsupportedImpactIds.push(input.id); continue; }
    geometry.protections.push({ impactId: input.id, center: cloneCircle(topology.regions.center), protectedCore: cloneCircle(topology.regions.protectedCore) });
    const paths = new Map(topology.paths.map(p => [p.id, p]));
    const faces = new Map<string, FractureFace[]>();
    for (const face of input.fracture?.faces ?? []) if (!face.kind) {
      const key = `${face.pathId}:${face.region}:${face.strength}`;
      if (!faces.has(key)) faces.set(key, []); faces.get(key)!.push(face);
    }
    const grouped = new Map<string, typeof topology.edges>();
    const validated = new Set<string>();
    for (const edge of topology.edges) {
      const segment = input.pattern.segments[edge.segmentIndex], path = paths.get(edge.pathId);
      if (!segment || !path || path.reference.length < 2 || path.stations.length !== path.reference.length || !Number.isFinite(path.length)) return failure('invalid-geometry', '経路の接続情報が不正です。');
      if (![segment.start.x, segment.start.y, segment.end.x, segment.end.y, edge.start.position, edge.end.position, segment.strength ?? 1].every(Number.isFinite) || edge.start.position < 0 || edge.end.position > 1 || edge.start.position > edge.end.position || (segment.strength ?? 1) < 0 || (segment.strength ?? 1) > 1) return failure('invalid-geometry', '線分の座標または経路位置が不正です。');
      if (!validated.has(path.id)) {
        if (path.length < 0 || path.reference.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || path.stations.some((t, n) => !Number.isFinite(t) || t < 0 || t > 1 || n > 0 && t < path.stations[n - 1])) return failure('invalid-geometry', '基準経路が不正です。');
        validated.add(path.id);
      }
      const sourceId = `impact-${input.id}/${edge.segmentIndex}`;
      const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
      const shardSides: GlassEdgeBinding['shardSides'] = [];
      for (const linked of shardEdgesBySource.get(sourceId) ?? []) {
        const a = shardVertices.get(linked.startVertexId), b = shardVertices.get(linked.endVertexId);
        if (!a || !b) return failure('invalid-geometry', '破片境界の頂点が不明です。');
        const sameDirection = dx * (b.x - a.x) + dy * (b.y - a.y) >= 0;
        shardSides.push({ edgeId: linked.id, leftRegionId: sameDirection ? linked.leftFaceId : linked.rightFaceId, rightRegionId: sameDirection ? linked.rightFaceId : linked.leftFaceId });
      }
      geometry.edgeBindings.push({ impactId: input.id, sourceId, pathId: edge.pathId, edgeId: edge.id, startPosition: edge.start.position, endPosition: edge.end.position, shardSides });
      const key = `${edge.pathId}:${edge.region}:${segment.strength ?? 1}`;
      if (!grouped.has(key)) grouped.set(key, []); grouped.get(key)!.push(edge);
    }
    for (const [key, edges] of grouped) {
      const sorted = [...edges].sort((a, b) => a.start.position - b.start.position);
      const runs: typeof topology.edges[] = [];
      for (const edge of sorted) {
        const run = runs[runs.length - 1];
        if (run?.[run.length - 1].end.vertexId === edge.start.vertexId) run.push(edge); else runs.push([edge]);
      }
      let faceIndex = 0;
      for (const run of runs) {
        const first = run[0], path = paths.get(first.pathId)!, start = first.start.position, end = run[run.length - 1].end.position;
        if (path.length <= 0 || end - start <= 1e-12) continue;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1) return failure('invalid-geometry', '経路位置が不正です。');
        const stations = new Set([start, end, ...path.stations.filter(t => t > start && t < end)]);
        for (let i = 1; i < 32; i++) if (i / 32 > start && i / 32 < end) stations.add(i / 32);
        const positions = [...stations].sort((a, b) => a - b);
        const face = faces.get(key)?.[faceIndex++];
        if (face && face.polygon.length !== positions.length * 2) return failure('invalid-geometry', '既存の帯と経路位置が対応しません。');
        if (geometry.strips.length >= GLASS_GEOMETRY_LIMITS.strips || sampleCount + positions.length > GLASS_GEOMETRY_LIMITS.samples) return failure('limit-exceeded', '材質用サンプルの上限に達しました。');
        const centers = positions.map(t => pointAt(path, t));
        const left = face ? face.polygon.slice(0, positions.length).map(p => ({ ...p })) : centers.map(p => ({ ...p }));
        const right = face ? face.polygon.slice(positions.length).reverse().map(p => ({ ...p })) : centers.map(p => ({ ...p }));
        const samples: GlassContourSample[] = positions.map((t, j) => {
          const a = pointAt(path, clamp(t - 0.0001)), b = pointAt(path, clamp(t + 0.0001));
          const tangent = unit(b.x - a.x, b.y - a.y, { x: 1, y: 0 });
          const l0 = left[Math.max(0, j - 1)], l1 = left[Math.min(left.length - 1, j + 1)];
          const r0 = right[Math.max(0, j - 1)], r1 = right[Math.min(right.length - 1, j + 1)];
          return { position: t, center: centers[j], tangent,
            left: { point: left[j], normal: unit(-(l1.y - l0.y), l1.x - l0.x, { x: -tangent.y, y: tangent.x }) },
            right: { point: right[j], normal: unit(r1.y - r0.y, -(r1.x - r0.x), { x: tangent.y, y: -tangent.x }) } };
        });
        if (!samples.every(s => [s.position, s.center.x, s.center.y, s.left.point.x, s.left.point.y, s.right.point.x, s.right.point.y, s.tangent.x, s.tangent.y, s.left.normal.x, s.left.normal.y, s.right.normal.x, s.right.normal.y].every(Number.isFinite))) return failure('invalid-geometry', '材質用幾何に非有限値があります。');
        sampleCount += samples.length;
        geometry.strips.push({ id: `impact-${input.id}/${path.id}/${first.region}/${start.toFixed(12)}:${end.toFixed(12)}`, impactId: input.id, pathId: path.id, type: path.type, region: first.region, strength: input.pattern.segments[first.segmentIndex].strength ?? 1, sourceEdgeIds: run.map(e => e.id), samples });
      }
    }
  }
  geometry.shards = (graph?.regions ?? []).map(r => ({ id: r.id, boundaryEdgeIds: [...r.boundaryEdgeIds], surfaceNormal: { x: 0, y: 0, z: 1 } }));
  return { ok: true, geometry };
}
