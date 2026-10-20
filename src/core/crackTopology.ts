import type { CrackType } from './generateCracks';
import type { Point, Segment } from './geometry';

export type CircleRegion = Readonly<{ kind: 'circle'; origin: Readonly<Point>; radius: number }>;
export type PathConnection = { position: number; targetPathId: string; targetPosition: number };
export type CrackPath = {
  id: string;
  type: CrackType;
  /** 接続頂点挿入・中心分割・画像クリッピング前の基準経路。位置はこの弧長で正規化する。 */
  reference: Point[];
  stations: number[];
  length: number;
  connections: PathConnection[];
};
export type CrackVertex = { id: string; point: Point };
export type PathEndpoint = { vertexId: string; position: number };
export type CrackEdge = {
  id: string;
  segmentIndex: number;
  pathId: string;
  start: PathEndpoint;
  end: PathEndpoint;
  region: 'center' | 'outer';
};
export type CrackTopology = {
  version: 1;
  paths: CrackPath[];
  vertices: CrackVertex[];
  edges: CrackEdge[];
  regions: {
    center: CircleRegion | null;
    /** 密度0で保護すべき最小領域。将来の開始位置の揺らぎでもこの領域を侵さない。 */
    protectedCore: CircleRegion | null;
    boundaryTreatment: 'exact';
  };
};

/** IDは衝撃点内での識別子。丸めはIDだけに適用し、描画座標は丸めない。 */
export const positionKey = (position: number): string => position.toFixed(12);

/** 幾何生成に乱数・座標変更を持ち込まない、接続情報の記録器。 */
export class TopologyBuilder {
  private paths = new Map<string, CrackPath>();
  private vertices = new Map<string, CrackVertex>();
  private edges: CrackEdge[] = [];

  register(id: string, type: CrackType, reference: readonly Point[], connections: PathConnection[] = []): void {
    if (this.paths.has(id)) throw new Error(`Duplicate crack path: ${id}`);
    const cumulative = [0];
    for (let i = 1; i < reference.length; i++) {
      cumulative.push(cumulative[i - 1] + Math.hypot(reference[i].x - reference[i - 1].x, reference[i].y - reference[i - 1].y));
    }
    const length = cumulative[cumulative.length - 1];
    this.paths.set(id, { id, type, reference: reference.map(p => ({ ...p })), length,
      stations: cumulative.map(value => length ? value / length : 0), connections: connections.map(c => ({ ...c })) });
  }

  /** 追加頂点でも基準経路へ投影するため、細分化した配列の添字に依存しない。 */
  position(pathId: string, point: Point): number {
    const path = this.paths.get(pathId);
    if (!path) throw new Error(`Unknown crack path: ${pathId}`);
    let best = Infinity, position = 0;
    for (let i = 1; i < path.reference.length; i++) {
      const a = path.reference[i - 1], b = path.reference[i];
      if (point.x === a.x && point.y === a.y) return path.stations[i - 1];
      if (point.x === b.x && point.y === b.y) return path.stations[i];
      const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
      const t = square ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / square)) : 0;
      const distance = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
      if (distance < best) {
        best = distance;
        position = path.stations[i - 1] + t * (path.stations[i] - path.stations[i - 1]);
      }
    }
    return position;
  }

  connection(position: number, targetPathId: string, point: Point): PathConnection {
    return { position, targetPathId, targetPosition: this.position(targetPathId, point) };
  }

  add(segmentIndex: number, segment: Segment, pathId: string, region: CrackEdge['region']): void {
    const endpoint = (point: Point): PathEndpoint => {
      // 同座標の端点のみを共有。近接線や単なる交差を勝手に接続しない。
      const id = `vertex:${point.x},${point.y}`;
      if (!this.vertices.has(id)) this.vertices.set(id, { id, point: { ...point } });
      return { vertexId: id, position: this.position(pathId, point) };
    };
    const start = endpoint(segment.start), end = endpoint(segment.end);
    this.edges.push({ id: `${pathId}:${positionKey(start.position)}:${positionKey(end.position)}:${region}`,
      segmentIndex, pathId, start, end, region });
  }

  finish(origin: Point, radius: number, centerDensity: number): CrackTopology {
    const center: CircleRegion | null = radius > 0 ? { kind: 'circle', origin: { ...origin }, radius } : null;
    return { version: 1, paths: [...this.paths.values()], vertices: [...this.vertices.values()], edges: this.edges,
      regions: { center, protectedCore: centerDensity === 0 ? center : null, boundaryTreatment: 'exact' } };
  }
}
