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
