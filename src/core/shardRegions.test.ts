import { describe, expect, it } from 'vitest';
import { extractShardRegions, SHARD_LIMITS, type ShardSegment, type ShardGraph, type ShardLimits } from './shardRegions';
import { generateCracks, DEFAULT_CRACK_PARAMS } from './generateCracks';
import { createRandom } from './random';
const size = { width: 100, height: 100 };
const line = (id: string, x: number, y: number, xx: number, yy: number): ShardSegment => ({ id, start: { x, y }, end: { x: xx, y: yy } });
const square = (prefix: string, a: number, b: number) => [line(prefix+'a',a,a,b,a), line(prefix+'b',b,a,b,b), line(prefix+'c',b,b,a,b), line(prefix+'d',a,b,a,a)];
function graph(input: ShardSegment[], image = size): ShardGraph {
  const result = extractShardRegions(image, input);
  if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
  expect(result.graph.regions.reduce((sum, r) => sum + r.area, 0)).toBeCloseTo(image.width * image.height, 7);
  expect(result.graph.regions.every(r => r.area > 0 && Number.isFinite(r.centroid.x) && Number.isFinite(r.centroid.y))).toBe(true);
  const ids = new Set(result.graph.regions.map(r => r.id));
  expect(result.graph.edges.every(e => [e.leftFaceId, e.rightFaceId].every(id => id === null || ids.has(id)))).toBe(true);
  return result.graph;
}
const boundaries = (g: ShardGraph) => g.edges.filter(e => e.kind === 'shard-boundary');
const decorations = (g: ShardGraph) => g.edges.filter(e => e.kind === 'decoration');

describe('画像四辺を含む平面分割', () => {
  it('空入力は画像1領域・4辺で重心は画像中心', () => {
    const g = graph([]); expect(g.regions).toHaveLength(1); expect(g.edges).toHaveLength(4);
    expect(g.regions[0]).toMatchObject({ area: 10000, centroid: { x: 50, y: 50 }, holes: [] });
  });
  it('対角線は面積5000の2領域を作る', () => {
    const g = graph([line('d', 0, 0, 100, 100)]);
    expect(g.regions.map(r => r.area)).toEqual([5000, 5000]); expect(boundaries(g)).toHaveLength(1);
    expect(decorations(g)).toHaveLength(0);
  });
  it('X字は交差を共有頂点に分割し、4領域にする', () => {
    const g = graph([line('a',0,0,100,100),line('b',0,100,100,0)]);
    expect(g.regions).toHaveLength(4); expect(g.regions.every(r => r.area === 2500)).toBe(true);
    expect(boundaries(g)).toHaveLength(4);
    const center = g.vertices.find(v => v.point.x === 50 && v.point.y === 50)!;
    expect(g.edges.filter(e => e.startVertexId === center.id || e.endVertexId === center.id)).toHaveLength(4);
  });
  it('T字で画像を3領域に分ける', () => {
    const g = graph([line('a',50,0,50,100),line('b',50,50,100,50)]);
    expect(g.regions.map(r => r.area).sort((a,b)=>a-b)).toEqual([2500,2500,5000]);
    expect(boundaries(g)).toHaveLength(3);
  });
  it('途中で終わるT字分岐は装飾。辺の左右は同じ領域', () => {
    const g = graph([line('a',50,0,50,100),line('b',50,50,80,50)]);
    expect(g.regions).toHaveLength(2); expect(decorations(g)).toHaveLength(1);
    expect(decorations(g)[0].leftFaceId).toBe(decorations(g)[0].rightFaceId);
  });
  it('画像からも切り離された行き止まりX字は全て装飾', () => {
    const g = graph([line('a',20,20,80,80),line('b',20,80,80,20)]);
    expect(g.regions).toHaveLength(1); expect(decorations(g)).toHaveLength(4);
  });
  it('部分・逆方向・完全重複は1つの辺に統合し、元IDを残す', () => {
    const g = graph([line('a',0,50,100,50),line('b',75,50,25,50),line('c',100,50,0,50)]);
    expect(g.regions).toHaveLength(2); expect(boundaries(g)).toHaveLength(3);
    expect(boundaries(g).find(e => e.sourceIds.includes('b'))!.sourceIds).toEqual(['a','b','c']);
  });
  it('同一直線上で端点接触する2経路を接続する', () => {
    const g = graph([line('a',0,50,50,50),line('b',50,50,100,50)]);
    expect(g.regions).toHaveLength(2); expect(boundaries(g)).toHaveLength(2);
  });
  it('画像外を切り取り、画像四辺との重複も統合', () => {
    const g = graph([line('a',-100,50,200,50),line('frame',-10,0,110,0),line('outside',-10,-10,-2,-2)]);
    expect(g.regions).toHaveLength(2);
    expect(g.edges.filter(e => e.sourceIds.includes('frame')).every(e => e.kind === 'image-boundary')).toBe(true);
    expect(g.vertices.every(v => v.point.x >= 0 && v.point.x <= 100 && v.point.y >= 0 && v.point.y <= 100)).toBe(true);
  });
  it('閉じた正方形は外側の穴と内側の破片を作る', () => {
    const g = graph(square('s',25,75));
    expect(g.regions.map(r=>r.area).sort((a,b)=>a-b)).toEqual([2500,7500]);
    expect(g.regions.find(r=>r.area===7500)!.holes).toHaveLength(1);
    expect(g.regions.every(r => Math.abs(r.centroid.x-50)<1e-10 && Math.abs(r.centroid.y-50)<1e-10)).toBe(true);
  });
  it('二重の穴と複数の非連結閉路を正しく帰属させる', () => {
    const nested = graph([...square('outer',10,90), ...square('inner',25,75)]);
    nested.regions.map(r=>r.area).sort((a,b)=>a-b).forEach((a,i)=>expect(a).toBeCloseTo([2500,3600,3900][i],8));
    expect(nested.regions.filter(r=>r.holes.length)).toHaveLength(2);
    const disjoint = graph([...square('left',10,30), ...square('right',60,80)]);
    expect(disjoint.regions.map(r=>Math.round(r.area)).sort((a,b)=>a-b)).toEqual([400,400,9200]);
    expect(disjoint.regions.find(r=>r.area>9000)!.holes).toHaveLength(2);
  });
  it('閉路間の橋と閉路内の行き止まりは装飾として残す', () => {
    const g = graph([...square('s',25,75), line('bridge',0,50,25,50), line('tip',25,50,50,50)]);
    expect(g.regions).toHaveLength(2); expect(decorations(g)).toHaveLength(2);
    expect(decorations(g).find(e=>e.sourceIds.includes('tip'))!.leftFaceId).toBe(g.regions.find(r=>r.area===2500)!.id);
  });
  it('頂点だけ接する2つの閉路も分離し、面積を維持', () => {
    const g = graph([...square('a',10,50),...square('b',50,90)]);
    expect(g.regions).toHaveLength(3); expect(g.regions.map(r=>Math.round(r.area)).sort((a,b)=>a-b)).toEqual([1600,1600,6800]);
  });
  it('同一入力と並べ替え・方向反転でも同じ幾何、入力を変更しない', () => {
    const input = [...square('s',25,75),line('d',0,0,100,100)], before = structuredClone(input);
    const first = graph(input); expect(graph(input)).toEqual(first);
    expect(graph([...input].reverse().map(s=>({...s,start:s.end,end:s.start})))).toEqual(first);
    expect(input).toEqual(before);
  });
  it('細長い画像・極小の画像でも有限', () => {
    for (const image of [{width:1,height:1},{width:8192,height:1},{width:1,height:8192}]) {
      expect(graph([line('d',0,0,image.width,image.height)],image).regions).toHaveLength(2);
    }
  });
  it('浮動小数の多重交差と小さな領域', () => {
    const g = graph([line('a',0,100/3,100,100/3),line('b',100/3,0,100/3,100),line('c',0,0,100,100),line('d',33.334,0,33.334,100)]);
    expect(g.regions.length).toBeGreaterThan(4);
  });
  it('複数衝撃点の可視線分を統合でき、元のシード・線分を変えない', () => {
    const patterns = [{x:30,y:40},{x:75,y:60}].map(p => generateCracks(size,p,42,{...DEFAULT_CRACK_PARAMS,radialCount:6,complexity:15,concentricDensity:30,centerDensity:0}));
    const before = structuredClone(patterns);
    const input = patterns.flatMap((p,i)=>p.segments.map((s,j)=>({...s,id:`impact-${i}/${j}`})));
    const result = graph(input); expect(result.regions.length).toBeGreaterThan(1);
    expect(patterns).toEqual(before); expect(graph(input)).toEqual(result);
  });
});

describe('入力と安全予算', () => {
  it('非有限座標・IDの重複・不正サイズを拒否し、部分グラフを返さない', () => {
    for (const input of [[line('a',NaN,0,100,100)], [line('a',0,0,100,100),line('a',0,100,100,0)], [line('',0,0,100,100)]]) {
      expect(extractShardRegions(size,input)).toMatchObject({ok:false,reason:'invalid-input'});
    }
    for (const invalid of [{width:0,height:100},{width:Infinity,height:100},{width:8193,height:100}]) expect(extractShardRegions(invalid,[]).ok).toBe(false);
    expect(extractShardRegions(size,[line('p',50,50,50,50)]).ok).toBe(true);
  });
  it('全ての予算を強制し、上限を引き上げる指定を拒否', () => {
    const input = [line('a',0,0,100,100),line('b',0,100,100,0)];
    for (const key of Object.keys(SHARD_LIMITS) as (keyof ShardLimits)[]) {
      expect(extractShardRegions(size,input,{[key]:1})).toMatchObject({ok:false,reason:'limit-exceeded'});
      expect(extractShardRegions(size,input,{[key]:SHARD_LIMITS[key]+1})).toMatchObject({ok:false,reason:'invalid-input'});
    }
  });
  it('平行線が多数あっても検査予算で有限時間に失敗', () => {
    const input = Array.from({length:200},(_,i)=>line(`s${i}`,0,i/2,100,i/2));
    expect(extractShardRegions(size,input,{intersectionChecks:100})).toMatchObject({ok:false,reason:'limit-exceeded'});
  });
  it('256領域超でも全面停止せず、全ての領域を抽出する', () => {
    const grid: ShardSegment[] = [];
    for (let i=1;i<17;i++) { grid.push(line(`x${i}`,i*100/17,0,i*100/17,100)); grid.push(line(`y${i}`,0,i*100/17,100,i*100/17)); }
    expect(graph(grid).regions).toHaveLength(289);
  });
});

it('決定的な多数の交差配置でも全領域の面積と隣接が成立する', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const random = createRandom(seed);
    const input = Array.from({ length: 20 }, (_,i) => line(`r${i}`,random()*100,random()*100,random()*100,random()*100));
    graph(input);
  }
});
it('ほぼ平行の交差・近接端点を処理し、明示した精度以下は退化辺として整理する', () => {
  const g = graph([line('a',0,50,100,50.000001),line('b',0,50.000001,100,50),line('tiny',20,20,20+1e-10,20)]);
  expect(g.regions).toHaveLength(4);
  expect(g.edges.some(e=>e.sourceIds.includes('tiny'))).toBe(false);
});

it('精度限界に近い角度の交差は不正な領域を返さず失敗する', () => {
  expect(extractShardRegions(size,[line('a',0,50,100,50+1e-9),line('b',0,50+1e-9,100,50)])).toMatchObject({ok:false,reason:'invalid-geometry'});
});
it('壊れた実行時入力でも安全に入力エラーを返す', () => {
  expect(extractShardRegions(size,[null as unknown as ShardSegment])).toMatchObject({ok:false,reason:'invalid-input'});
});
it('穴を持つ領域が重複や欠落なく画像全体を覆う', () => {
  const g = graph([...square('a',10,90), ...square('b',25,75), line('chord',25,50,75,50)]);
  const inside = (ring: readonly {x:number;y:number}[], x:number, y:number) => {
    let hits = 0;
    for (let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length];
      if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hits++;
    }
    return hits%2===1;
  };
  for (let x=0.37;x<100;x+=3.19) for(let y=0.61;y<100;y+=3.73) {
    expect(g.regions.filter(r=>inside(r.outer,x,y)&&!r.holes.some(h=>inside(h,x,y)))).toHaveLength(1);
  }
});
it('長い装飾経路を再帰スタックなしで処理', () => {
  const chain = Array.from({length:2000},(_,i)=>line(`c${i}`,10+80*i/2000,50,10+80*(i+1)/2000,50));
  const g = graph(chain); expect(g.regions).toHaveLength(1); expect(decorations(g)).toHaveLength(2000);
});
it('既存の標準設定・中心密度0/50/100の複数衝撃点を抽出できる', () => {
  const image = { width: 800, height: 500 };
  for (const seed of [1,42,123]) for (const centerDensity of [0,50,100]) {
    const segments = [{x:300,y:230},{x:600,y:350}].flatMap((p,i)=>
      generateCracks(image,p,seed,{...DEFAULT_CRACK_PARAMS,centerDensity}).segments.map((s,j)=>({...s,id:`${i}/${j}`})));
    const result = extractShardRegions(image,segments);
    expect(result.ok, !result.ok ? `${seed}/${centerDensity}: ${result.message}` : '').toBe(true);
  }
});
