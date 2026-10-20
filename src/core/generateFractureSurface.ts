import type { CrackPattern } from './generateCracks';
import type { CrackEdge, CrackPath } from './crackTopology';
import type { Point, Size } from './geometry';

export const MAX_FRACTURE_VERTICES = 32768;
export const MAX_FRACTURE_FACES = 1024;

export type FractureFace = {
  pathId: string;
  /** 欠けは経路上の安定位置に接続した三角形。省略時は従来の帯。 */
  kind?: 'chip';
  position?: number;
  polygon: Point[];
  reflection: Point[];
  reflectionWidth: number;
  region: 'center' | 'outer';
  strength: number;
};
export type FractureGeometry = { faces: FractureFace[]; maximumWidth: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** 経路IDと固定された位置から求める値。中心線用の乱数系列を消費しない。 */
function noise(seed: number, pathId: string, index: number, channel: number): number {
  let h = (seed >>> 0) ^ Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(channel + 1, 0x27d4eb2d);
  for (let i = 0; i < pathId.length; i++) h = Math.imul(h ^ pathId.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
function profile(seed: number, id: string, t: number, channel: number): number {
  const x = clamp(t) * 16, i = Math.floor(x), f = x - i;
  const smooth = f * f * (3 - 2 * f);
  return noise(seed, id, i, channel) * (1 - smooth) + noise(seed, id, i + 1, channel) * smooth;
}
function pointAt(path: CrackPath, t: number): Point {
  for (let i = 1; i < path.stations.length; i++) {
    if (t <= path.stations[i] || i === path.stations.length - 1) {
      const span = path.stations[i] - path.stations[i - 1];
      const u = span ? clamp((t - path.stations[i - 1]) / span) : 0;
      const a = path.reference[i - 1], b = path.reference[i];
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return path.reference[0];
}
function normalAt(path: CrackPath, t: number): Point {
  const a = pointAt(path, clamp(t - 0.0001)), b = pointAt(path, clamp(t + 0.0001));
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return length > 0 ? { x: -(b.y - a.y) / length, y: (b.x - a.x) / length } : { x: 0, y: 0 };
}

/** 主要経路の可視区間だけを帯状多角形にする。画像／中心領域の最終クリップは描画段階で共有する。 */
export function generateFractureSurface(pattern: CrackPattern, size: Size, widthPercent: number, chipDensity = 0): FractureGeometry {
  if (!Number.isFinite(chipDensity) || chipDensity < 0 || chipDensity > 100) throw new Error('欠け密度は0〜100%で指定してください。');
  if (!Number.isFinite(widthPercent) || widthPercent < 0 || widthPercent > 100) throw new Error('破断面幅は0〜100%で指定してください。');
  if (![size.width, size.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('画像サイズが不正です。');
  const maximumWidth = Math.min(24, Math.min(size.width, size.height) * 0.03) * widthPercent / 100;
  if (maximumWidth === 0 || !pattern.topology) return { faces: [], maximumWidth };
  const topology = pattern.topology;
  const paths = new Map(topology.paths.filter(path => path.type === 'radial' && path.length > 0).map(path => [path.id, path]));
  const grouped = new Map<string, CrackEdge[]>();
  for (const edge of topology.edges) {
    if (!paths.has(edge.pathId)) continue;
    const strength = pattern.segments[edge.segmentIndex].strength ?? 1;
    const key = `${edge.pathId}:${edge.region}:${strength}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(edge);
  }
  const faces: FractureFace[] = [];
  let vertexCount = 0;
  for (const edges of grouped.values()) {
    edges.sort((a, b) => a.start.position - b.start.position);
    const runs: CrackEdge[][] = [];
    for (const edge of edges) {
      const run = runs[runs.length - 1], previous = run?.[run.length - 1];
      if (previous && previous.end.vertexId === edge.start.vertexId) run.push(edge);
      else runs.push([edge]);
    }
    for (const run of runs) {
      const first = run[0], last = run[run.length - 1], path = paths.get(first.pathId)!;
      const start = first.start.position, end = last.end.position;
      if (end - start <= 1e-12) continue;
      // サンプリング基準を固定し、接続頂点の増減で幅模様を変えない。
      const stations = new Set([start, end, ...path.stations.filter(t => t > start && t < end)]);
      for (let i = 1; i < 32; i++) { const t = i / 32; if (t > start && t < end) stations.add(t); }
      const left: Point[] = [], right: Point[] = [];
      for (const t of [...stations].sort((a, b) => a - b)) {
        const p = pointAt(path, t), n = normalAt(path, t);
        const taper = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.55);
        const width = maximumWidth * taper * (0.35 + 0.65 * profile(pattern.seed, path.id, t, 0));
        const asymmetry = 0.3 + 0.4 * profile(pattern.seed, path.id, t, 1);
        left.push({ x: p.x + n.x * width * asymmetry, y: p.y + n.y * width * asymmetry });
        right.push({ x: p.x - n.x * width * (1 - asymmetry), y: p.y - n.y * width * (1 - asymmetry) });
      }
      const normal = normalAt(path, 0.5);
      const reflection = normal.x + normal.y < 0 ? left : right;
      if (faces.length >= MAX_FRACTURE_FACES || vertexCount + left.length + right.length > MAX_FRACTURE_VERTICES) return { faces, maximumWidth };
      vertexCount += left.length + right.length;
      faces.push({ pathId: path.id, polygon: [...left, ...right.slice().reverse()], reflection,
        reflectionWidth: Math.min(1.2, maximumWidth * 0.12), region: first.region,
        strength: pattern.segments[first.segmentIndex].strength ?? 1 });
    }
  }
  // 帯の後に追加。固定セル内の候補を使い、密度や中心の可視範囲で乱数位置をずらさない。
  if (chipDensity > 0) for (const edges of grouped.values()) {
    const first = edges[0], path = paths.get(first.pathId)!;
    const cells = first.region === 'center' ? 96 : 24;
    const sourceStrength = pattern.segments[first.segmentIndex].strength ?? 1;
    for (let i = 0; i < cells; i++) {
      // 最大密度でも全セルを埋めず、鋸歯状の等間隔模様を避ける。
      if (noise(pattern.seed, path.id, i, 14) < (first.region === 'center' ? 0.35 : 0.6)) continue;
      const t = (i + 0.1 + noise(pattern.seed, path.id, i, 10) * 0.8) / cells;
      const rank = noise(pattern.seed, path.id, i, 11) * 0.85;
      const strength = clamp((chipDensity / 100 - rank) / 0.15) * sourceStrength;
      if (strength <= 0) continue;
      const edge = edges.find(e => t > e.start.position && t < e.end.position);
      if (!edge) continue;
      const halfSpan = Math.min(0.3 / cells, maximumWidth * 0.7 / path.length);
      // 候補の底辺を可視区間内に保ち、未描画経路に浮いた欠けを作らない。
      const covered = (position: number) => edges.some(e => position >= e.start.position && position <= e.end.position);
      const a = pointAt(path, covered(t - halfSpan) ? t - halfSpan : edge.start.position);
      const b = pointAt(path, covered(t + halfSpan) ? t + halfSpan : edge.end.position);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) continue;
      const p = pointAt(path, t), n = normalAt(path, t);
      const side = noise(pattern.seed, path.id, i, 12) < 0.5 ? -1 : 1;
      const depth = maximumWidth * (0.65 + noise(pattern.seed, path.id, i, 13) * 1.4) * Math.pow(Math.sin(Math.PI * t), 0.35);
      const tip = { x: p.x + n.x * depth * side, y: p.y + n.y * depth * side };
      if (faces.length >= MAX_FRACTURE_FACES || vertexCount + 3 > MAX_FRACTURE_VERTICES) return { faces, maximumWidth };
      vertexCount += 3;
      faces.push({ kind: 'chip', position: t, pathId: path.id, polygon: [a, tip, b],
        reflection: side < 0 ? [a, tip] : [tip, b], reflectionWidth: Math.min(1.2, maximumWidth * 0.12),
        region: first.region, strength });
    }
  }
  return { faces, maximumWidth };
}
