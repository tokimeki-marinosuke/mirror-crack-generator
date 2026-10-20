import { generateCracks } from '../src/core/generateCracks';
import { generateCracks as published } from './fixtures/e8accc2/generateCracks';
import { PRESETS, type Impact, type StylePreset } from '../src/state/editorState';
import { renderPreview } from '../src/render/preview';
import { exportPng } from '../src/image/exportPng';

function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
function same(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean { return a.length === b.length && a.every((value, i) => value === b[i]); }
async function decode(blob: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob);
  try {
    assert(bitmap.width === 320 && bitmap.height === 240, '元解像度');
    const c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const ctx = c.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, 320, 240).data;
  } finally { bitmap.close(); }
}
const source = document.createElement('canvas'); source.width = 320; source.height = 240;
const sourceContext = source.getContext('2d')!;
const gradient = sourceContext.createLinearGradient(0, 0, 320, 240);
gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#193448');
sourceContext.fillStyle = gradient; sourceContext.fillRect(0, 0, 320, 240);
sourceContext.clearRect(30, 30, 50, 70); sourceContext.fillStyle = 'rgba(200,100,50,.5)'; sourceContext.fillRect(40, 40, 30, 30);
const image = new Image(); image.src = source.toDataURL(); await image.decode();
const baselineCanvas = document.querySelector<HTMLCanvasElement>('#baseline')!;
const currentCanvas = document.querySelector<HTMLCanvasElement>('#current')!;
const cases = (['realistic', 'anime'] as StylePreset[]).flatMap(preset => [0, 50, 100].map(centerDensity => ({ preset, centerDensity, corner: false, maxSegments: 5000 })));
cases.push({ preset: 'realistic', centerDensity: 0, corner: true, maxSegments: 5000 }, { preset: 'anime', centerDensity: 100, corner: true, maxSegments: 1 });
let failed = 0;
for (const sample of cases) {
  const item = document.createElement('li');
  try {
    const origin = sample.corner ? { x: 0, y: 0 } : { x: 160, y: 120 };
    const params = { ...PRESETS[sample.preset], centerDensity: sample.centerDensity, maxSegments: sample.maxSegments };
    const oldPattern = published({ width: 320, height: 240 }, origin, 42, params);
    const newPattern = generateCracks({ width: 320, height: 240 }, origin, 42, params);
    const oldImpact: Impact = { id: 1, origin, seed: 42, preset: sample.preset, params, pattern: oldPattern };
    const newImpact: Impact = { ...oldImpact, pattern: newPattern };
    renderPreview(baselineCanvas, image, [oldImpact], 1); renderPreview(currentCanvas, image, [newImpact], 1);
    const data = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    assert(same(data(baselineCanvas), data(currentCanvas)), 'プレビュー全画素の一致');
    for (const mode of ['composite', 'cracks'] as const) {
      const a = await decode(await exportPng(image, [oldImpact], mode));
      const b = await decode(await exportPng(image, [newImpact], mode));
      assert(same(a, b), `${mode} PNGの全RGBA画素一致`);
    }
    item.textContent = `PASS: ${sample.preset}, 中心${sample.centerDensity}%, 境界${sample.corner}, 上限${sample.maxSegments} — preview / composite / cracks 一致`;
  } catch (error) { failed++; item.textContent = `FAIL: ${String(error)}`; item.dataset.status = 'failed'; }
  document.querySelector('#results')!.append(item);
}
const summary = document.querySelector<HTMLElement>('#summary')!;
summary.textContent = `${cases.length - failed} passed / ${failed} failed`;
summary.dataset.status = failed ? 'failed' : 'passed';
