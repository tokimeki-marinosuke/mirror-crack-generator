import { clipSegment, type Point, type Segment, type Size } from './geometry';
import { splitAtCircle } from './centerGeometry';
import { createRandom } from './random';

export type CrackType = 'radial' | 'concentric' | 'branch';
export type CrackSegment = Segment & { type: CrackType; strength?: number };
export type CrackPattern = { origin: Point; segments: CrackSegment[]; seed: number; centerRadius?: number; protectedRadius?: number };
export type CrackParams = {
  radialCount: number;
  lengthPercent: number;
  complexity: number;
  concentricDensity: number;
  centerRadius: number;
  centerDensity: number;
  maxSegments: number;
};
export const MAX_SEGMENTS = 5000;
export const DEFAULT_CRACK_PARAMS: Readonly<CrackParams> = Object.freeze({
  radialCount: 12, lengthPercent: 80, complexity: 55, concentricDensity: 45,
  centerRadius: 20, centerDensity: 50, maxSegments: MAX_SEGMENTS,
});
function range(value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`生成設定は ${min}～${max} の${integer ? '整数' : '有限数'}で指定してください。`);
  }
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Candidate = CrackSegment & { parents: number[]; centerOnly?: boolean; rank?: number };

/** DOM・Canvas非依存。外側を先に確定し、中心密度が外側の乱数や予算を変えない。 */
export function generateCracks(size: Size, origin: Point, seed: number,
  params: Readonly<CrackParams> = DEFAULT_CRACK_PARAMS): CrackPattern {
  range(size.width, 1, Number.MAX_SAFE_INTEGER, true); range(size.height, 1, Number.MAX_SAFE_INTEGER, true);
  range(origin.x, 0, size.width); range(origin.y, 0, size.height);
  range(params.radialCount, 4, 24, true); range(params.lengthPercent, 10, 150);
  range(params.complexity, 0, 100); range(params.concentricDensity, 0, 100);
  range(params.centerRadius, 0, 80); range(params.centerDensity, 0, 100);
  range(params.maxSegments, 1, MAX_SEGMENTS, true);
  const radialRandom = createRandom(seed); // seed validation + no shared state
  const webRandom = createRandom((seed >>> 0) ^ 0x51a3be79);
  const branchRandom = createRandom((seed >>> 0) ^ 0x3cf49ab1);
  const centerRandom = createRandom((seed >>> 0) ^ 0x6e820d35);
  const length = Math.min(size.width, size.height) * params.lengthPercent / 100;
  const radius = length * params.centerRadius / 100;
  const density = params.centerDensity / 100, complexity = params.complexity / 100;
  const steps = 12 + Math.round(complexity * 12);
  const distance = (p: Point) => Math.hypot(p.x - origin.x, p.y - origin.y);
  const polar = (r: number, angle: number): Point => ({ x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r });
  // 正の角度間隔を正規化し、極端な集中を避けながら不均一に配置。
  const gaps = Array.from({ length: params.radialCount }, () => 0.55 + radialRandom());
  const sum = gaps.reduce((a, b) => a + b, 0);
  const angles: number[] = [];
  let angle = radialRandom() * Math.PI * 2;
  for (const gap of gaps) { angles.push(angle); angle += gap / sum * Math.PI * 2; }
  const rays: Point[][] = angles.map((base, i) => {
    const corridor = Math.min(gaps[i], gaps[(i + gaps.length - 1) % gaps.length]) / sum * Math.PI * 2 * 0.22;
    const reach = length * (i === 0 || radialRandom() < 0.25 ? 0.92 + radialRandom() * 0.08 : 0.42 + radialRandom() * 0.45);
    const drift = (radialRandom() - 0.5) * corridor;
    let bend = 0;
    const path: Point[] = [{ ...origin }];
    for (let j = 1; j <= steps; j++) {
      bend = bend * 0.7 + (radialRandom() - 0.5) * corridor * 0.3;
      path.push(polar(reach * j / steps, base + complexity * (drift * j / steps + bend)));
    }
    return path;
  });
  // 放射線の線分上に接続頂点を挿入する。同じ半径の再利用では同じ頂点を返す。
  const anchor = (ray: Point[], r: number): Point | null => {
    if (r <= 0 || r > distance(ray[ray.length - 1])) return null;
    for (let i = 1; i < ray.length; i++) {
      const before = distance(ray[i - 1]), after = distance(ray[i]);
      if (Math.abs(after - r) < length * 1e-10) return ray[i];
      if (r > before && r < after) {
        const parts = splitAtCircle({ start: ray[i - 1], end: ray[i] }, origin, r);
        const point = parts.outside[0]?.start;
        if (!point) return null;
        ray.splice(i, 0, point); return point;
      }
    }
    return null;
  };
  const links: Candidate[] = [];
  const rings = Math.round(params.concentricDensity / 100 * 8);
  for (let ring = 1; ring <= rings; ring++) {
    // 外側に行くほど基本間隔を広げ、各接続の半径も独立に揺らす。
    const r = length * (0.06 + 0.85 * Math.pow(ring / (rings + 1), 1.6));
    for (let i = 0; i < rays.length; i++) {
      if (webRandom() < 0.3) continue;
      const next = (i + 1) % rays.length;
      const start = anchor(rays[i], r * (0.72 + webRandom() * 0.56));
      const end = anchor(rays[next], r * (0.72 + webRandom() * 0.56));
      if (!start || !end) continue;
      const jitter = (webRandom() - 0.5) * 0.14 * complexity;
      const mid = { x: (start.x + end.x) / 2 - (end.y - start.y) * jitter,
        y: (start.y + end.y) / 2 + (end.x - start.x) * jitter };
      links.push({ start, end: mid, type: 'concentric', parents: [i, next] },
        { start: mid, end, type: 'concentric', parents: [i, next] });
    }
  }
  // 中心の細かな網目。候補と接続頂点は密度に依存させず、強度で連続的に出現させる。
  if (radius > 0) for (let ring = 1; ring <= 6; ring++) {
    const r = radius * Math.pow(ring / 7, 1.35);
    for (let i = 0; i < rays.length; i++) {
      const next = (i + 1) % rays.length;
      const start = anchor(rays[i], r * (0.62 + centerRandom() * 0.55));
      const end = anchor(rays[next], r * (0.62 + centerRandom() * 0.55));
      const rank = centerRandom();
      if (start && end) links.push({ start, end, type: 'branch', parents: [i, next], centerOnly: true, rank });
    }
  }
  const raw: Candidate[] = [];
  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    for (let j = 1; j < ray.length; j++) raw.push({ start: ray[j - 1], end: ray[j], type: 'radial', parents: [i] });
  }
  raw.push(...links.filter(link => !link.centerOnly));
  // 分岐は既存頂点から外向きに短く伸ばす。候補は各放射線につき最大steps個。
  for (let i = 0; i < rays.length; i++) {
    const candidates = rays[i].filter((_, j) => j > 0 && j % 3 === 0).slice(0, steps);
    for (const start of candidates) {
      if (branchRandom() > complexity * 0.35) continue;
      let point = start;
      let heading = Math.atan2(start.y - origin.y, start.x - origin.x)
        + (branchRandom() < 0.5 ? -1 : 1) * (0.3 + branchRandom() * 0.6);
      const count = 2 + Math.floor(branchRandom() * 3);
      const stepLength = length * (0.015 + branchRandom() * 0.025);
      for (let j = 0; j < count; j++) {
        heading += (branchRandom() - 0.5) * 0.12;
        const end = { x: point.x + Math.cos(heading) * stepLength, y: point.y + Math.sin(heading) * stepLength };
        raw.push({ start: point, end, type: 'branch', parents: [i] }); point = end;
      }
    }
  }
  raw.push(...links.filter(link => link.centerOnly));
  const segments: CrackSegment[] = [];
  const inside: { candidate: Candidate; part: Segment }[] = [];
  const add = (part: Segment, candidate: Candidate, strength?: number) => {
    if (segments.length >= params.maxSegments) return;
    const clipped = clipSegment(part, size);
    if (clipped) segments.push({ ...clipped, type: candidate.type, ...(strength === undefined ? {} : { strength }) });
  };
  // 外側を優先して全て確定。中心が増えても外側の予算を奪わない。
  for (const candidate of raw) {
    const parts = splitAtCircle(candidate, origin, radius);
    if (!candidate.centerOnly) for (const part of parts.outside) add(part, candidate);
    for (const part of parts.inside) inside.push({ candidate, part });
  }
  const ranks = rays.map(() => centerRandom());
  const rayStrength = ranks.map(rank => clamp((density - rank * 0.8) / 0.2));
  for (const { candidate, part } of inside) {
    let strength = Math.min(...candidate.parents.map(i => rayStrength[i]));
    if (candidate.centerOnly) strength *= clamp((density - 0.3 - (candidate.rank ?? 0) * 0.5) / 0.2);
    if (strength > 0) add(part, candidate, strength);
  }
  return { origin: { ...origin }, segments, seed, ...(radius > 0 ? { centerRadius: radius } : {}), ...(density === 0 && radius > 0 ? { protectedRadius: radius } : {}) };
}
