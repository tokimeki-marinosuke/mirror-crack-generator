import { clipSegment, type Point, type Segment, type Size } from './geometry';
import { createRandom } from './random';

export type CrackType = 'radial' | 'concentric' | 'branch';
export type CrackSegment = Segment & { type: CrackType };
export type CrackPattern = { origin: Point; segments: CrackSegment[]; seed: number };
export type CrackParams = {
  radialCount: number;
  lengthPercent: number;
  complexity: number;
  concentricDensity: number;
  maxSegments: number;
};
export const MAX_SEGMENTS = 5000;
export const DEFAULT_CRACK_PARAMS: Readonly<CrackParams> = Object.freeze({
  radialCount: 12, lengthPercent: 80, complexity: 55, concentricDensity: 45, maxSegments: MAX_SEGMENTS,
});

function range(value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`生成設定は ${min}～${max} の${integer ? '整数' : '有限数'}で指定してください。`);
  }
}

/** DOM・描画・共有乱数状態に依存しない元画像座標での幾何生成。 */
export function generateCracks(size: Size, origin: Point, seed: number,
  params: Readonly<CrackParams> = DEFAULT_CRACK_PARAMS): CrackPattern {
  // 算術のオーバーフローを避けるため、寸法は実際の画像同様の正の安全な整数。
  range(size.width, 1, Number.MAX_SAFE_INTEGER, true);
  range(size.height, 1, Number.MAX_SAFE_INTEGER, true);
  range(origin.x, 0, size.width);
  range(origin.y, 0, size.height);
  range(params.radialCount, 4, 24, true);
  range(params.lengthPercent, 10, 150);
  range(params.complexity, 0, 100);
  range(params.concentricDensity, 0, 100);
  range(params.maxSegments, 1, MAX_SEGMENTS, true);
  const random = createRandom(seed);
  const segments: CrackSegment[] = [];
  const add = (start: Point, end: Point, type: CrackType): void => {
    if (segments.length >= params.maxSegments) return;
    const clipped = clipSegment({ start, end }, size);
    if (clipped) segments.push({ ...clipped, type });
  };
  const complexity = params.complexity / 100;
  const steps = 8 + Math.round(complexity * 16);
  const length = Math.min(size.width, size.height) * params.lengthPercent / 100;
  const rotation = random() * Math.PI * 2;
  const rays: Point[][] = [];
  // 最大24本×24ステップ。各ループは入力範囲で上限を保証する。
  for (let i = 0; i < params.radialCount; i++) {
    const angle = rotation + (i + (random() - 0.5) * 0.35) * Math.PI * 2 / params.radialCount;
    const radius = length * (0.75 + random() * 0.25);
    const path: Point[] = [{ ...origin }];
    for (let j = 1; j <= steps; j++) {
      const distance = radius * j / steps;
      const sideways = (random() - 0.5) * radius / steps * complexity;
      const point = { x: origin.x + Math.cos(angle) * distance - Math.sin(angle) * sideways,
        y: origin.y + Math.sin(angle) * distance + Math.cos(angle) * sideways };
      add(path[j - 1], point, 'radial');
      path.push(point);
    }
    rays.push(path);
  }
  // 対応する放射線上の頂点を結び、不完全な多角形状の同心円を構成する。
  const rings = Math.round(params.concentricDensity / 100 * 8);
  for (let ring = 1; ring <= rings; ring++) {
    const index = Math.max(1, Math.floor(ring * steps / (rings + 1)));
    for (let i = 0; i < rays.length; i++) {
      if (random() < 0.18) continue;
      add(rays[i][index], rays[(i + 1) % rays.length][index], 'concentric');
    }
  }
  for (const path of rays) {
    for (let j = 2; j < steps; j++) {
      if (random() >= complexity * 0.35) continue;
      let point = path[j];
      const previous = path[j - 1];
      const angle = Math.atan2(point.y - previous.y, point.x - previous.x)
        + (random() < 0.5 ? -1 : 1) * (0.35 + random() * 0.7);
      const branchSteps = 2 + Math.floor(random() * 4);
      for (let k = 0; k < branchSteps; k++) {
        const heading = angle + (random() - 0.5) * 0.4;
        const distance = length / steps * (0.3 + random() * 0.5);
        const next = { x: point.x + Math.cos(heading) * distance, y: point.y + Math.sin(heading) * distance };
        add(point, next, 'branch');
        point = next;
      }
    }
  }
  return { origin: { ...origin }, segments, seed };
}
