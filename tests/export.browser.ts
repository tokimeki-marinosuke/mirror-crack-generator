import { ShardImageState } from '../src/state/shardImageState';
import { exportPng } from '../src/image/exportPng';
import { loadImage } from '../src/image/loadImage';
import { containRect, screenToImage } from '../src/core/geometry';
import { EditorState, type Impact } from '../src/state/editorState';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function rejects(action: () => Promise<unknown>, text: string): Promise<void> {
  try { await action(); } catch (error) {
    assert(error instanceof Error && error.message.includes(text), `期待したエラー: ${text}`); return;
  }
  throw new Error('失敗すべき処理が成功しました。');
}
function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
}
async function asBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob(blob => blob ? resolve(blob) : reject(new Error('テスト画像の生成失敗'))));
}
async function pixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  assert(blob.type === 'image/png', 'PNG MIME形式');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value), 'PNGシグネチャ');
  const bitmap = await createImageBitmap(blob);
  try {
    const c = canvas(bitmap.width, bitmap.height); const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return { width: c.width, height: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
  } finally { bitmap.close(); }
}
const source = canvas(320, 240);
source.getContext('2d')!.fillStyle = 'rgba(80, 120, 200, .5)';
source.getContext('2d')!.fillRect(20, 20, 60, 60);
const sourceBlob = await asBlob(source);
const image = await loadImage(new File([sourceBlob], 'test.png', { type: 'image/png' }));
const baseline = await pixels(sourceBlob);
const size = { width: 320, height: 240 };
const state = new EditorState(size);
const rect = containRect(size, { left: 100, top: 80, width: 640, height: 640 });
const origin = screenToImage({ x: 420, y: 400 }, size, rect)!;
const impact: Impact = {
  ...state.add(origin),
  params: { ...state.active!.params, lineWidth: 6, opacity: 100, highlight: 0 },
  pattern: { origin, seed: 1, segments: [{ start: origin, end: { x: 240, y: 120 }, type: 'radial' }] },
};
const alpha = (data: Uint8ClampedArray, x: number, y: number) => data[(y * size.width + x) * 4 + 3];
async function shardFixture() {
  const c=canvas(size.width,size.height),ctx=c.getContext('2d')!;
  const gradient=ctx.createLinearGradient(0,0,size.width,size.height);gradient.addColorStop(0,'rgba(80,130,200,.5)');gradient.addColorStop(1,'rgba(220,90,40,.5)');ctx.fillStyle=gradient;ctx.fillRect(0,0,size.width,size.height);
  ctx.clearRect(25,25,15,15);
  const picture=await loadImage(new File([await asBlob(c)],'shards.png',{type:'image/png'}));
  const point={x:80,y:120};
  const cut:Impact={...impact,origin:point,pattern:{origin:point,seed:42,segments:[{start:{x:160,y:0},end:{x:160,y:240},type:'radial'}]}};
  return {picture,cut};
}
const tests: [string, () => Promise<void>][] = [
  ['合成PNGの元解像度・元画像の透過を保持（衝撃点なし）', async () => {
    const result = await pixels(await exportPng(image, [], 'composite'));
    assert(result.width === 320 && result.height === 240, '元解像度');
    assert(result.data.every((value, i) => value === baseline.data[i]), '元画像と全画素一致');
    assert(alpha(result.data, 0, 0) === 0 && alpha(result.data, 30, 30) > 0 && alpha(result.data, 30, 30) < 255, '透明・半透明');
  }],
  ['透過PNGの非亀裂領域は透明・元画像を含めない', async () => {
    const empty = await pixels(await exportPng(image, [], 'cracks'));
    assert(empty.data.every(value => value === 0), '衝撃点なしは完全透明');
    const result = await pixels(await exportPng(image, [impact], 'cracks'));
    assert(result.width === 320 && result.height === 240, '元解像度');
    assert(alpha(result.data, 30, 30) === 0, '元画像の色領域が含まれない');
    assert(alpha(result.data, 170, 120) > 0, '指定した線分が存在');
  }],
  ['画面クリックから元画像座標へ一致・マーカーを含めない', async () => {
    assert(origin.x === 160 && origin.y === 120, '余白込みの画面座標の逆変換');
    const result = await pixels(await exportPng(image, [impact], 'cracks'));
    assert(alpha(result.data, 161, 120) > 0, '衝撃点から線分が始まる');
    assert(alpha(result.data, 160, 130) === 0, '半径11pxの編集マーカーは出力しない');
    assert(alpha(result.data, 156, 120) === 0, '衝撃点の手前に線分がない');
  }],
  ['合成PNGで亀裂外の半透明画素を維持', async () => {
    const result = await pixels(await exportPng(image, [impact], 'composite'));
    for (const [x, y] of [[0, 0], [30, 30], [100, 100]]) {
      const index = (y * size.width + x) * 4;
      assert(result.data.slice(index, index + 4).every((value, i) => value === baseline.data[index + i]), '非亀裂領域のRGBA一致');
    }
    assert(alpha(result.data, 170, 120) > 0, '合成画像に亀裂が存在');
  }],
  ['不透明度0で透過PNGは完全透明・合成PNGは元画像と一致', async () => {
    const hidden = { ...impact, params: { ...impact.params, opacity: 0, highlight: 100 } };
    const cracks = await pixels(await exportPng(image, [hidden], 'cracks'));
    assert(cracks.data.every(value => value === 0), '輪郭・芯・ハイライト全て透明');
    const composite = await pixels(await exportPng(image, [hidden], 'composite'));
    assert(composite.data.every((value, i) => value === baseline.data[i]), '元画像と一致');
  }],
  ['複数衝撃点・選択状態に依存しない安定した出力', async () => {
    const second = { ...impact, id: 2, origin: { x: 160, y: 180 },
      pattern: { ...impact.pattern, origin: { x: 160, y: 180 }, segments: [{ start: { x: 160, y: 180 }, end: { x: 240, y: 180 }, type: 'radial' as const }] } };
    const first = await pixels(await exportPng(image, [impact, second], 'cracks'));
    const repeat = await pixels(await exportPng(image, [impact, second], 'cracks'));
    assert(alpha(first.data, 170, 120) > 0 && alpha(first.data, 170, 180) > 0, '両方の点を描画');
    assert(first.data.every((value, i) => value === repeat.data[i]), '繰り返しPNGの画素一致');
  }],
  ['中心密度0で太線・ハイライトも中心内に入らず、合成では元画像を保持', async () => {
    const editor = new EditorState(size);
    editor.add({ x: 50, y: 50 });
    for (const preset of ['realistic', 'anime'] as const) {
      editor.update({ preset, params: { centerRadius: 25, centerDensity: 0, lineWidth: 6, highlight: 100 } });
      const radius = editor.active!.pattern.centerRadius!;
      const cracks = await pixels(await exportPng(image, editor.impacts, 'cracks'));
      const composite = await pixels(await exportPng(image, editor.impacts, 'composite'));
      let visible = false;
      for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
        const index = (y * size.width + x) * 4;
        if (Math.hypot(x + 0.5 - 50, y + 0.5 - 50) < radius - 2) {
          assert(cracks.data[index + 3] === 0, '中心内の亀裂レイヤーが透明');
          assert(composite.data.slice(index, index + 4).every((value, i) => value === baseline.data[index + i]), '中心内の元画像RGBAを保持');
        } else if (cracks.data[index + 3] > 0) visible = true;
      }
      assert(visible, '外側の亀裂は表示する');
    }
  }],
  ['破断面の幅・暗部・反射を透過PNGへ描画し、中心保護と元画像の透過を維持', async () => {
    const editor = new EditorState(size); editor.add({ x: 50, y: 50 });
    editor.update({ params: { centerRadius: 25, centerDensity: 0, opacity: 100, highlight: 100 } });
    const pattern = editor.active!.pattern;
    editor.updateSurface({ widthPercent: 100, darkness: 100 });
    const geometry = editor.active!.fracture;
    const wide = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    const composite = await pixels(await exportPng(image, editor.impacts, 'composite'));
    const radius = pattern.centerRadius!;
    let darkPixels = 0;
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
      const index = (y * size.width + x) * 4;
      if (Math.hypot(x + 0.5 - 50, y + 0.5 - 50) < radius - 2) {
        assert(wide.data[index + 3] === 0, '破断面と反射が中心内に入らない');
        assert(composite.data.slice(index, index + 4).every((v, i) => v === baseline.data[index + i]), '保護領域の元画像RGBAを保持');
      } else if (wide.data[index + 3] > 0 && wide.data[index] < 40) darkPixels++;
    }
    assert(darkPixels > 0, '透過レイヤーに暗い破断面を含む');
    editor.updateSurface({ darkness: 0 });
    assert(editor.active!.pattern === pattern && editor.active!.fracture === geometry, '暗部変更で幾何を再生成しない');
    const noDark = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    assert(!wide.data.every((v, i) => v === noDark.data[i]), '暗部スライダーの効果');
    editor.update({ params: { highlight: 0 } });
    const noReflection = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    assert(!noDark.data.every((v, i) => v === noReflection.data[i]), '反射スライダーの効果');
    editor.update({ params: { opacity: 0 } });
    assert((await pixels(await exportPng(image, editor.impacts, 'cracks'))).data.every(v => v === 0), '不透明度0で破断面も透明');
  }],
  ['最大欠け密度の三角形を透過PNGへ描画し、中心保護と元画像の透過を維持', async () => {
    const editor = new EditorState(size); editor.add({ x: 50, y: 50 });
    editor.update({ params: { centerRadius: 25, centerDensity: 0, opacity: 100, highlight: 100 } });
    const pattern = editor.active!.pattern;
    editor.updateSurface({ widthPercent: 100, darkness: 100, chipDensity: 100 });
    const geometry = editor.active!.fracture;
    const wide = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    const composite = await pixels(await exportPng(image, editor.impacts, 'composite'));
    const radius = pattern.centerRadius!;
    let darkPixels = 0;
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
      const index = (y * size.width + x) * 4;
      if (Math.hypot(x + 0.5 - 50, y + 0.5 - 50) < radius - 2) {
        assert(wide.data[index + 3] === 0, '破断面と反射が中心内に入らない');
        assert(composite.data.slice(index, index + 4).every((v, i) => v === baseline.data[index + i]), '保護領域の元画像RGBAを保持');
      } else if (wide.data[index + 3] > 0 && wide.data[index] < 40) darkPixels++;
    }
    assert(darkPixels > 0, '透過レイヤーに暗い破断面を含む');
    editor.updateSurface({ darkness: 0 });
    assert(editor.active!.pattern === pattern && editor.active!.fracture === geometry, '暗部変更で幾何を再生成しない');
    const noDark = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    assert(!wide.data.every((v, i) => v === noDark.data[i]), '暗部スライダーの効果');
    editor.update({ params: { highlight: 0 } });
    const noReflection = await pixels(await exportPng(image, editor.impacts, 'cracks'));
    assert(!noDark.data.every((v, i) => v === noReflection.data[i]), '反射スライダーの効果');
    editor.update({ params: { opacity: 0 } });
    assert((await pixels(await exportPng(image, editor.impacts, 'cracks'))).data.every(v => v === 0), '不透明度0で破断面も透明');
  }],
  ['幅0へ戻すと従来PNGに一致し、暗部・反射0では元画像を消去しない', async () => {
    const editor = new EditorState(size); editor.add({ x: 160, y: 120 }); editor.update({ params: { highlight: 0 } });
    const original = await pixels(await exportPng(image, editor.impacts, 'composite'));
    editor.updateSurface({ widthPercent: 100, darkness: 0 });
    const transparent = await pixels(await exportPng(image, editor.impacts, 'composite'));
    assert(original.data.every((v, i) => v === transparent.data[i]), '塗りが無効なら元画像の画素を消さない');
    editor.updateSurface({ darkness: 100 }); editor.updateSurface({ widthPercent: 0 });
    const reset = await pixels(await exportPng(image, editor.impacts, 'composite'));
    assert(original.data.every((v, i) => v === reset.data[i]), '幅0で既存PNGに完全復帰');
  }],
  ['破片の4設定は合成PNGにだけ適用し、0へ戻すと全RGBA画素一致',async()=>{
    const {picture,cut}=await shardFixture(),shards=new ShardImageState(size);
    const original=await pixels(await exportPng(picture,[cut],'composite'));
    const oldCracks=await pixels(await exportPng(picture,[cut],'cracks'));
    for(const key of ['displacement','rotation','reflection','gap'] as const){
      shards.update({displacement:0,rotation:0,reflection:0,gap:0,[key]:100});
      const composition=shards.resolve([cut]);
      const changed=await pixels(await exportPng(picture,[cut],'composite',composition));
      assert(changed.width===size.width&&changed.height===size.height,'変形後も元解像度');
      assert(!changed.data.every((v,i)=>v===original.data[i]),`${key}が合成画像に作用`);
      const cracks=await pixels(await exportPng(picture,[cut],'cracks',composition));
      assert(cracks.data.every((v,i)=>v===oldCracks.data[i]),`${key}が亀裂のみPNGに入らない`);
    }
    assert(shards.extractions===1,'4設定で分割を再抽出しない');
    shards.update({displacement:0,rotation:0,reflection:0,gap:0});
    const reset=await pixels(await exportPng(picture,[cut],'composite',shards.resolve([cut])));
    assert(reset.data.every((v,i)=>v===original.data[i]),'全設定0で従来PNGと完全一致');
  }],
  ['破片の明暗差は半透明のアルファを維持し、暗い隙間とは独立',async()=>{
    const {picture,cut}=await shardFixture(),shards=new ShardImageState(size);
    const original=await pixels(await exportPng(picture,[cut],'composite'));
    shards.update({reflection:100});
    const changed=await pixels(await exportPng(picture,[cut],'composite',shards.resolve([cut])));
    for(let y=5;y<235;y++)for(let x=5;x<315;x++){
      if(Math.abs(x-160)<5)continue;const index=(y*size.width+x)*4;
      assert(changed.data[index+3]===original.data[index+3],'明暗差で元画像のアルファを変えない');
    }
  }],
  ['中心保護円だけでなく重なる破片全体を明暗・隙間から保護',async()=>{
    const {picture,cut}=await shardFixture();cut.pattern.protectedRadius=25;
    const original=await pixels(await exportPng(picture,[cut],'composite'));
    const shards=new ShardImageState(size);shards.update({displacement:100,rotation:100,reflection:100,gap:100});
    const composition=shards.resolve([cut]);assert(composition?.plan?.motions.filter(m=>m.reason==='protected').length===1,'保護対象が1破片');
    const changed=await pixels(await exportPng(picture,[cut],'composite',composition));
    for(let y=3;y<237;y++)for(let x=3;x<155;x++){const index=(y*size.width+x)*4;assert(changed.data.slice(index,index+4).every((v,i)=>v===original.data[index+i]),'円の外も含め左破片全体のRGBAを維持');}
  }],
  ['抽出失敗と未分割では合成PNGも元画像＋亀裂に戻る',async()=>{
    const {picture,cut}=await shardFixture();const shards=new ShardImageState(size,{edges:1});shards.update({displacement:100,reflection:100,gap:100});
    const composition=shards.resolve([cut]);assert(composition?.extraction.ok===false,'予算超過を再現');
    const old=await pixels(await exportPng(picture,[cut],'composite'));
    const fallback=await pixels(await exportPng(picture,[cut],'composite',composition));
    assert(old.data.every((v,i)=>v===fallback.data[i]),'失敗時の合成RGBA一致');
  }],
  ['大きい画像も縮小せずPNG出力（2048×1024）', async () => {
    const big = await loadImage(new File([await asBlob(canvas(2048, 1024))], 'large.png', { type: 'image/png' }));
    const output = await pixels(await exportPng(big, [], 'composite'));
    assert(output.width === 2048 && output.height === 1024, '大画像の元解像度');
  }],
  ['過大画像の読み込みを拒否し、通常画像の出力は継続', async () => {
    const file = new File([await asBlob(canvas(8193, 1))], 'oversize.png', { type: 'image/png' });
    await rejects(() => loadImage(file), '大きすぎ');
    const forged = new Image();
    Object.defineProperty(forged, 'naturalWidth', { value: 8193 });
    Object.defineProperty(forged, 'naturalHeight', { value: 1 });
    await rejects(() => exportPng(forged, [], 'composite'), '大きすぎ');
    assert((await exportPng(image, [], 'composite')).size > 0, '失敗後の出力');
  }],
  ['Canvas確保・PNG変換の失敗を説明し、再試行できる', async () => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    try {
      HTMLCanvasElement.prototype.getContext = (() => null) as typeof getContext;
      await rejects(() => exportPng(image, [], 'cracks'), '書き出せません');
      HTMLCanvasElement.prototype.getContext = getContext;
      HTMLCanvasElement.prototype.toBlob = function (callback) { callback(null); };
      await rejects(() => exportPng(image, [], 'cracks'), '書き出せません');
      HTMLCanvasElement.prototype.toBlob = function () { throw new Error('encoder failure'); };
      await rejects(() => exportPng(image, [], 'cracks'), '書き出せません');
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
      HTMLCanvasElement.prototype.toBlob = toBlob;
    }
    assert((await exportPng(image, [impact], 'cracks')).size > 0, '回復後の出力');
  }],
];
let failed = 0;
for (const [name, run] of tests) {
  const item = document.createElement('li');
  try { await run(); item.textContent = `PASS: ${name}`; }
  catch (error) { failed++; item.textContent = `FAIL: ${name} — ${String(error)}`; item.dataset.status = 'failed'; }
  document.querySelector('#results')!.append(item);
}
const summary = document.querySelector<HTMLElement>('#summary')!;
summary.textContent = `${tests.length - failed} passed / ${failed} failed`;
summary.dataset.status = failed ? 'failed' : 'passed';
