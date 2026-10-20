import { clipSegment, type Point, type Segment, type Size } from './geometry';

/** idは衝撃点IDなどで名前空間を分ける。不可視の基準経路ではなく可視線分を渡す。 */
export type ShardSegment = Segment & { id: string };
export type ShardVertex = { id: string; point: Point };
export type ShardEdge = {
  id: string; startVertexId: string; endVertexId: string; sourceIds: string[];
  kind: 'image-boundary' | 'shard-boundary' | 'decoration';
  leftFaceId: string | null; rightFaceId: string | null;
};
export type ShardRegion = {
  id: string; outer: Point[]; holes: Point[][]; area: number; centroid: Point;
  boundaryEdgeIds: string[];
};
export type ShardGraph = { vertices: ShardVertex[]; edges: ShardEdge[]; regions: ShardRegion[] };
export const SHARD_LIMITS = Object.freeze({
  inputSegments: 10000, edges: 30000, vertices: 30000, regions: 10000,
  intersectionChecks: 2000000, splitEvents: 120000, containmentChecks: 2000000,
});
export type ShardLimits = { [K in keyof typeof SHARD_LIMITS]: number };
export type ShardExtraction = { ok: true; graph: ShardGraph } |
  { ok: false; reason: 'invalid-input' | 'limit-exceeded' | 'invalid-geometry'; message: string };

const EPS = 1e-10; // 全座標を画像長辺で正規化した上で使う。元画像／描画座標は変更しない。
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const at = (s: Segment, t: number): Point => ({ x: s.start.x + (s.end.x - s.start.x) * t, y: s.start.y + (s.end.y - s.start.y) * t });
const clamp = (t: number) => Math.max(0, Math.min(1, t));
class Failure extends Error {
  constructor(readonly reason: 'invalid-input' | 'limit-exceeded' | 'invalid-geometry', message: string) { super(message); }
}
function requireGeometry(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Failure('invalid-geometry', message);
}
function area(ring: readonly Point[]): number {
  // 原点から遠い小領域でも桁落ちを抑える。
  const origin = ring[0]; let sum = 0;
  for (let i = 1; i + 1 < ring.length; i++) sum += cross(sub(ring[i], origin), sub(ring[i + 1], origin));
  return sum / 2;
}
function hash(value: string): string {
  let a = 2166136261, b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b ^ value.charCodeAt(i), 0x85ebca6b); }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

/** Canvas/DOM/乱数に依存しない有界の平面分割。失敗時は部分グラフを返さない。 */
export function extractShardRegions(size: Size, input: readonly ShardSegment[], options: Partial<ShardLimits> = {}): ShardExtraction {
  try { return { ok: true, graph: extract(size, input, options) }; }
  catch (error) {
    if (error instanceof Failure) return { ok: false, reason: error.reason, message: error.message };
    throw error;
  }
}
function extract(size: Size, input: readonly ShardSegment[], options: Partial<ShardLimits>): ShardGraph {
  if (!size || ![size.width, size.height].every(v => Number.isSafeInteger(v) && v > 0 && v <= 8192) || !Array.isArray(input) || !options || typeof options !== 'object') throw new Failure('invalid-input', '画像サイズが不正です。');
  const limits = { ...SHARD_LIMITS, ...options };
  for (const key of Object.keys(limits) as (keyof ShardLimits)[]) {
    if (!(key in SHARD_LIMITS) || !Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > SHARD_LIMITS[key]) throw new Failure('invalid-input', '予算は安全上限以下の正の整数で指定してください。');
  }
  const budget = (value: number, maximum: number) => { if (value > maximum) throw new Failure('limit-exceeded', '破片抽出の安全上限に達しました。'); };
  budget(input.length, limits.inputSegments);
  const scale = Math.max(size.width, size.height), width = size.width / scale, height = size.height / scale;
  const norm = (p: Point): Point => ({ x: p.x / scale, y: p.y / scale });
  const restore = (p: Point): Point => ({ x: p.x * scale, y: p.y * scale });
  type Work = Segment & { sourceId: string | null; cuts: number[]; minX: number; maxX: number; minY: number; maxY: number };
  const work: Work[] = [], ids = new Set<string>();
  const add = (segment: Segment, sourceId: string | null) => {
    const start = norm(segment.start), end = norm(segment.end);
    if (distance(start, end) <= EPS) return; // 描画には触れず、抽出専用の退化辺だけ除く。
    const [a, b] = start.x < end.x || start.x === end.x && start.y < end.y ? [start, end] : [end, start];
    work.push({ start: a, end: b, sourceId, cuts: [0, 1], minX: a.x, maxX: b.x, minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) });
  };
  for (const segment of input) {
    if (!segment || !segment.start || !segment.end || typeof segment.id !== 'string' || segment.id.length === 0 || segment.id.length > 256 || ids.has(segment.id) ||
      ![segment.start.x, segment.start.y, segment.end.x, segment.end.y].every(Number.isFinite)) throw new Failure('invalid-input', '線分IDまたは座標が不正です。');
    ids.add(segment.id);
    const clipped = clipSegment(segment, size); if (clipped) add(clipped, segment.id);
  }
  const corners = [{ x: 0, y: 0 }, { x: size.width, y: 0 }, { x: size.width, y: size.height }, { x: 0, y: size.height }];
  for (let i = 0; i < 4; i++) add({ start: corners[i], end: corners[(i + 1) % 4] }, null);
  work.sort((a, b) => a.minX - b.minX || a.minY - b.minY || a.maxX - b.maxX || a.maxY - b.maxY || ((a.sourceId ?? '') < (b.sourceId ?? '') ? -1 : (a.sourceId ?? '') > (b.sourceId ?? '') ? 1 : 0));
  let checks = 0, events = work.length * 2;
  budget(events, limits.splitEvents);
  const cut = (s: Work, t: number) => { budget(++events, limits.splitEvents); s.cuts.push(clamp(t)); };
  // x方向のsweep-and-prune。候補の最悪二乗時間も検査予算で打ち切る。
  let active: Work[] = [];
  for (const a of work) {
    active = active.filter(b => b.maxX + EPS >= a.minX);
    for (const b of active) {
      budget(++checks, limits.intersectionChecks);
      if (a.maxY + EPS < b.minY || b.maxY + EPS < a.minY) continue;
      const r = sub(a.end, a.start), s = sub(b.end, b.start), q = sub(b.start, a.start);
      const lr = Math.hypot(r.x, r.y), ls = Math.hypot(s.x, s.y), den = cross(r, s);
      if (Math.abs(den) > EPS * lr * ls) {
        const t = cross(q, s) / den, u = cross(q, r) / den;
        if (t >= -EPS / lr && t <= 1 + EPS / lr && u >= -EPS / ls && u <= 1 + EPS / ls) { cut(a, t); cut(b, u); }
      } else if (den !== 0 && cross(q, s) / den > 0 && cross(q, s) / den < 1 && cross(q, r) / den > 0 && cross(q, r) / den < 1) {
        throw new Failure('invalid-geometry', '精度限界に近い角度の交差です。');
      } else if (Math.abs(cross(q, r)) <= EPS * lr) {
        // 同一直線上の接触と部分／完全重複。相手の端点を双方の分割点にする。
        const project = (target: Work, p: Point) => {
          const v = sub(target.end, target.start), l2 = v.x * v.x + v.y * v.y;
          const t = ((p.x - target.start.x) * v.x + (p.y - target.start.y) * v.y) / l2;
          if (t >= -EPS / Math.sqrt(l2) && t <= 1 + EPS / Math.sqrt(l2)) cut(target, t);
        };
        project(a, b.start); project(a, b.end); project(b, a.start); project(b, a.end);
      }
    }
    active.push(a);
  }
  const points: Point[] = [], buckets = new Map<string, number[]>();
  const vertex = (p: Point): number => {
    const x = Math.floor(p.x / EPS), y = Math.floor(p.y / EPS);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const id of buckets.get(`${x + dx},${y + dy}`) ?? []) if (distance(points[id], p) <= EPS) return id;
    }
    budget(points.length + 1, limits.vertices);
    const id = points.length, key = `${x},${y}`;
    points.push(p); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key)!.push(id); return id;
  };
  type Edge = { a: number; b: number; sources: Set<string>; frame: boolean };
  const edges: Edge[] = [], edgeMap = new Map<string, number>();
  for (const line of work) {
    line.cuts.sort((a, b) => a - b);
    const length = distance(line.start, line.end), cuts = line.cuts.filter((t, i, all) => i === 0 || (t - all[i - 1]) * length > EPS);
    for (let i = 1; i < cuts.length; i++) {
      const a = vertex(at(line, cuts[i - 1])), b = vertex(at(line, cuts[i])); if (a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      let index = edgeMap.get(key);
      if (index === undefined) { budget(edges.length + 1, limits.edges); index = edges.length; edgeMap.set(key, index); edges.push({ a: Math.min(a, b), b: Math.max(a, b), sources: new Set(), frame: false }); }
      if (line.sourceId === null) edges[index].frame = true; else edges[index].sources.add(line.sourceId);
    }
  }
  // 各無向辺に2つの半辺。幾何グラフと元線分の由来を別管理する。
  const outgoing = points.map(() => [] as number[]);
  const from = (h: number) => h % 2 === 0 ? edges[h >> 1].a : edges[h >> 1].b;
  const to = (h: number) => from(h ^ 1);
  for (let h = 0; h < edges.length * 2; h++) outgoing[from(h)].push(h);
  // 反復Tarjanで橋を検出。再帰を使わず長い行き止まり経路でもスタックを溢れさせない。
  const discovered = points.map(() => -1), low = points.map(() => -1), parent = points.map(() => -1), bridge = edges.map(() => false);
  let clock = 0, components = 0;
  for (let root = 0; root < points.length; root++) {
    if (discovered[root] >= 0) continue;
    components++;
    discovered[root] = low[root] = clock++;
    const stack = [{ v: root, next: 0 }];
    while (stack.length) {
      const item = stack[stack.length - 1], v = item.v;
      if (item.next < outgoing[v].length) {
        const h = outgoing[v][item.next++], w = to(h);
        if ((h ^ 1) === parent[v]) continue;
        if (discovered[w] < 0) { parent[w] = h; discovered[w] = low[w] = clock++; stack.push({ v: w, next: 0 }); }
        else low[v] = Math.min(low[v], discovered[w]);
      } else {
        stack.pop(); const h = parent[v];
        if (h >= 0) { const p = from(h); low[p] = Math.min(low[p], low[v]); if (low[v] > discovered[p]) bridge[h >> 1] = true; }
      }
    }
  }
  const order = new Int32Array(edges.length * 2);
  for (let v = 0; v < points.length; v++) {
    outgoing[v] = outgoing[v].filter(h => !bridge[h >> 1]);
    outgoing[v].sort((a, b) => Math.atan2(points[to(a)].y - points[v].y, points[to(a)].x - points[v].x) - Math.atan2(points[to(b)].y - points[v].y, points[to(b)].x - points[v].x));
    outgoing[v].forEach((h, i) => { order[h] = i; });
  }
  type Ring = { halfEdges: number[]; points: Point[]; area: number; owner: number | null };
  const rings: Ring[] = [], seen = new Uint8Array(edges.length * 2);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || bridge[start >> 1]) continue;
    const halfEdges: number[] = []; let h = start;
    do {
      requireGeometry(!seen[h], '閉路の巡回が不正です。'); seen[h] = 1; halfEdges.push(h);
      const list = outgoing[to(h)]; h = list[(order[h ^ 1] + list.length - 1) % list.length];
      requireGeometry(halfEdges.length <= edges.length * 2, '閉路の巡回上限です。');
    } while (h !== start);
    const ring = halfEdges.map(e => points[from(e)]), signedArea = area(ring);
    requireGeometry(Math.abs(signedArea) > EPS * EPS, '退化した閉領域です。');
    rings.push({ halfEdges, points: ring, area: signedArea, owner: null });
  }
  const positive = rings.filter(r => r.area > 0); budget(positive.length, limits.regions);
  requireGeometry(positive.length === edges.length - points.length + components, '平面グラフのEuler特性が一致しません。');
  let containment = 0;
  const contains = (ring: readonly Point[], p: Point): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      budget(++containment, limits.containmentChecks);
      const a = ring[i], b = ring[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  positive.forEach((r, i) => { r.owner = i; });
  // 非連結の閉路も、その左側の領域を調べて穴として帰属させる。外枠の外側はowner=null。
  for (const ring of rings.filter(r => r.area < 0)) {
    const a = ring.points[0], b = ring.points[1], length = distance(a, b), offset = Math.min(length * 1e-4, EPS * 16);
    const sample = { x: (a.x + b.x) / 2 - (b.y - a.y) / length * offset, y: (a.y + b.y) / 2 + (b.x - a.x) / length * offset };
    let smallest = Infinity;
    positive.forEach((candidate, i) => { budget(++containment, limits.containmentChecks); if (candidate.area < smallest && contains(candidate.points, sample)) { smallest = candidate.area; ring.owner = i; } });
  }
  const regionIds = positive.map(r => {
    const tokens = r.halfEdges.map(h => `${points[from(h)].x.toPrecision(15)},${points[from(h)].y.toPrecision(15)}`);
    let first = 0; for (let i = 1; i < tokens.length; i++) if (tokens[i] < tokens[first]) first = i;
    return `shard:${hash([...tokens.slice(first), ...tokens.slice(0, first)].join(';'))}`;
  });
  requireGeometry(new Set(regionIds).size === regionIds.length, '領域IDが重複しました。');
  const halfOwners = new Int32Array(edges.length * 2).fill(-1);
  for (const ring of rings) for (const h of ring.halfEdges) halfOwners[h] = ring.owner ?? -1;
  const edgeIds = edges.map(e => `edge:${hash(`${points[e.a].x},${points[e.a].y}:${points[e.b].x},${points[e.b].y}`)}`);
  requireGeometry(new Set(edgeIds).size === edgeIds.length, '辺IDが重複しました。');
  const holesByOwner = positive.map(() => [] as Ring[]);
  for (const ring of rings) if (ring.area < 0 && ring.owner !== null) holesByOwner[ring.owner].push(ring);
  const regions: ShardRegion[] = positive.map((outer, i) => {
    const holes = holesByOwner[i], contours = [outer, ...holes];
    const netArea = contours.reduce((sum, r) => sum + r.area, 0);
    requireGeometry(netArea > EPS * EPS, '穴を除いた面積が不正です。');
    let cx = 0, cy = 0;
    const origin = outer.points[0];
    for (const ring of contours) for (let j = 0; j < ring.points.length; j++) {
      const a = sub(ring.points[j], origin), b = sub(ring.points[(j + 1) % ring.points.length], origin), c = cross(a, b);
      cx += (a.x + b.x) * c; cy += (a.y + b.y) * c;
    }
    return { id: regionIds[i], outer: outer.points.map(restore), holes: holes.map(r => r.points.map(restore)), area: netArea * scale * scale,
      centroid: restore({ x: origin.x + cx / (6 * netArea), y: origin.y + cy / (6 * netArea) }),
      boundaryEdgeIds: [...new Set(contours.flatMap(r => r.halfEdges.map(h => edgeIds[h >> 1])))].sort() };
  });
  const total = regions.reduce((sum, r) => sum + r.area, 0);
  requireGeometry(Math.abs(total - size.width * size.height) <= size.width * size.height * 1e-8, '領域の合計面積が画像面積と一致しません。');
  const graphEdges: ShardEdge[] = edges.map((e, i) => {
    let left = halfOwners[i * 2], right = halfOwners[i * 2 + 1];
    if (bridge[i]) {
      const p = at({ start: points[e.a], end: points[e.b] }, 0.5);
      const owner = positive.findIndex((r, j) => { budget(++containment, limits.containmentChecks); return contains(r.points, p) && !holesByOwner[j].some(h => contains(h.points, p)); });
      requireGeometry(owner >= 0, '装飾辺の所属領域が不明です。'); left = right = owner;
    }
    requireGeometry(e.frame ? (left < 0) !== (right < 0) : left >= 0 && right >= 0, '画像内の辺が領域に接続されていません。');
    return { id: edgeIds[i], startVertexId: `v${e.a}`, endVertexId: `v${e.b}`, sourceIds: [...e.sources].sort(),
      kind: e.frame ? 'image-boundary' : left === right ? 'decoration' : 'shard-boundary',
      leftFaceId: left < 0 ? null : regionIds[left], rightFaceId: right < 0 ? null : regionIds[right] };
  });
  requireGeometry(regions.every(r => Number.isFinite(r.area) && Number.isFinite(r.centroid.x) && Number.isFinite(r.centroid.y)), '領域に非有限値があります。');
  return { vertices: points.map((p, i) => ({ id: `v${i}`, point: restore(p) })), edges: graphEdges, regions };
}
