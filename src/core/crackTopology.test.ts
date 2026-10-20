import { expect, it } from 'vitest';
import { DEFAULT_CRACK_PARAMS, generateCracks } from './generateCracks';
import { generateCracks as published } from '../../tests/fixtures/e8accc2/generateCracks';
import { TopologyBuilder } from './crackTopology';

it('公開版e8accc2と描画用幾何データを完全一致させる', () => {
  for (const size of [{ width: 800, height: 500 }, { width: 1, height: 1 }, { width: 100000, height: 1 }, { width: Number.MAX_SAFE_INTEGER, height: 1 }]) {
    for (const origin of [{ x: size.width / 2, y: size.height / 2 }, { x: 0, y: size.height }]) {
      for (const seed of [0, 42, -1]) for (const centerDensity of [0, 50, 100]) {
        for (const maxSegments of [1, 5000]) {
          const params = { ...DEFAULT_CRACK_PARAMS, centerDensity, maxSegments };
          const { topology, ...actual } = generateCracks(size, origin, seed, params);
          expect(actual).toEqual(published(size, origin, seed, params));
          expect(topology?.edges.length).toBe(actual.segments.length);
        }
      }
    }
  }
});
it('線分が共有頂点・経路・正規化位置を参照し、接続情報が座標と一致する', () => {
  const pattern = generateCracks({ width: 1200, height: 1000 }, { x: 600, y: 500 }, 42, { ...DEFAULT_CRACK_PARAMS, lengthPercent: 30, centerRadius: 0 });
  const topology = pattern.topology!;
  const vertices = new Map(topology.vertices.map(vertex => [vertex.id, vertex.point]));
  const paths = new Map(topology.paths.map(path => [path.id, path]));
  const uses = new Map<string, Set<string>>();
  for (const edge of topology.edges) {
    expect(vertices.get(edge.start.vertexId)).toEqual(pattern.segments[edge.segmentIndex].start);
    expect(vertices.get(edge.end.vertexId)).toEqual(pattern.segments[edge.segmentIndex].end);
    expect(paths.has(edge.pathId)).toBe(true);
    expect(edge.start.position).toBeGreaterThanOrEqual(0);
    expect(edge.end.position).toBeLessThanOrEqual(1);
    expect(edge.end.position + 1e-10).toBeGreaterThanOrEqual(edge.start.position);
    for (const end of [edge.start, edge.end]) {
      if (!uses.has(end.vertexId)) uses.set(end.vertexId, new Set());
      uses.get(end.vertexId)!.add(edge.pathId);
    }
  }
  expect([...uses.values()].some(set => set.size >= 3)).toBe(true);
  expect(new Set(topology.edges.map(edge => edge.id)).size).toBe(topology.edges.length);
  for (const path of topology.paths) for (const connection of path.connections) {
    expect(paths.has(connection.targetPathId)).toBe(true);
    expect(connection.targetPosition).toBeGreaterThanOrEqual(0);
    expect(connection.targetPosition).toBeLessThanOrEqual(1);
    const endpoint = connection.position === 0 ? path.reference[0] : path.reference[path.reference.length - 1];
    const attached = topology.edges.filter(edge => edge.pathId === connection.targetPathId)
      .flatMap(edge => [vertices.get(edge.start.vertexId), vertices.get(edge.end.vertexId)]);
    expect(attached).toContainEqual(endpoint);
  }
});
it('追加頂点・クリッピングに依存しない基準弧長位置', () => {
  const builder = new TopologyBuilder();
  builder.register('radial/0', 'radial', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  expect(builder.position('radial/0', { x: 5, y: 0 })).toBe(0.25);
  expect(builder.position('radial/0', { x: 10, y: 5 })).toBe(0.75);
  builder.add(0, { start: { x: 3, y: 0 }, end: { x: 7, y: 0 } }, 'radial/0', 'outer');
  const edge = builder.finish({ x: 0, y: 0 }, 0, 0).edges[0];
  expect(edge.start.position).toBe(0.15);
  expect(edge.end.position).toBe(0.35);
});
it('網目の頂点追加や中心密度変更でも主要経路のIDと基準経路を維持する', () => {
  const generate = (concentricDensity: number, centerDensity: number) => generateCracks({ width: 800, height: 500 }, { x: 400, y: 250 }, 42,
    { ...DEFAULT_CRACK_PARAMS, concentricDensity, centerDensity }).topology!;
  const base = generate(0, 0);
  const radial = (topology: typeof base) => topology.paths.filter(path => path.type === 'radial');
  expect(radial(generate(100, 100))).toEqual(radial(base));
  const full = generate(0, 100);
  expect(full.edges.filter(edge => edge.region === 'outer')).toEqual(base.edges);
  expect(full.regions.protectedCore).toBeNull();
  expect(base.regions.protectedCore).toEqual(base.regions.center);
});
it('予算・画像切り取り後も経路IDと位置を元経路に対応させる', () => {
  const params = { ...DEFAULT_CRACK_PARAMS, centerDensity: 100 };
  const full = generateCracks({ width: 800, height: 500 }, { x: 0, y: 0 }, 7, params).topology!;
  const limited = generateCracks({ width: 800, height: 500 }, { x: 0, y: 0 }, 7, { ...params, maxSegments: 3 }).topology!;
  expect(limited.paths).toEqual(full.paths);
  expect(limited.edges).toEqual(full.edges.slice(0, 3));
});

it('最小・最大・小数設定でも公開版の線分と保護情報を維持する', () => {
  const profiles = [
    { centerRadius: 0, complexity: 0, concentricDensity: 0, radialCount: 4, lengthPercent: 10 },
    { centerRadius: 80, complexity: 100, concentricDensity: 100, radialCount: 24, lengthPercent: 150 },
    { centerRadius: 30.5, complexity: 75.5, concentricDensity: 99.9, radialCount: 17, lengthPercent: 110 },
  ];
  for (const profile of profiles) for (const centerDensity of [0, 100]) for (const seed of [0, 42]) {
    const params = { ...DEFAULT_CRACK_PARAMS, ...profile, centerDensity };
    const { topology, ...result } = generateCracks({ width: 800, height: 500 }, { x: 400, y: 250 }, seed, params);
    expect(result).toEqual(published({ width: 800, height: 500 }, { x: 400, y: 250 }, seed, params));
    expect(topology?.edges.length).toBe(result.segments.length);
  }
});
