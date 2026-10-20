import { generateCracks, DEFAULT_CRACK_PARAMS } from '../src/core/generateCracks';
import { generateCracks as generateOld } from './fixtures/generateCracks.v1';
import { renderCracks } from '../src/render/renderCracks';
const size = { width: 800, height: 500 }, origin = { x: 360, y: 250 };
const params = { ...DEFAULT_CRACK_PARAMS, centerRadius: 25 };
const image = new Image(); image.src = new URL('../docs/samples/dark.png', import.meta.url).href; await image.decode();
for (const [label, density] of [['旧アルゴリズム', -1], ['新版 · 中心密度0%（中心を残す）', 0], ['新版 · 中心密度50%', 50], ['新版 · 中心密度100%', 100]] as const) {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'), canvas = document.createElement('canvas');
  caption.textContent = label; canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
  const pattern = density === -1 ? generateOld(size, origin, 42, params) : generateCracks(size, origin, 42, { ...params, centerDensity: density });
  renderCracks(ctx, pattern, size, { preset: 'realistic', lineWidth: 3, opacity: 100, highlight: 40 });
  figure.append(caption, canvas); document.querySelector('main')!.append(figure);
}
