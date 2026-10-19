import { generateCracks } from '../src/core/generateCracks';
import { renderCracks } from '../src/render/renderCracks';
import type { StylePreset } from '../src/render/crackStyle';

const size = { width: 800, height: 500 };
const pattern = generateCracks(size, { x: 320, y: 230 }, 42);
for (const sample of ['light', 'dark', 'transparent']) {
  const image = new Image();
  image.src = new URL(`../docs/samples/${sample}.png`, import.meta.url).href;
  await image.decode();
  for (const preset of ['realistic', 'anime'] as StylePreset[]) {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = `${sample} / ${preset}`;
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    canvas.dataset.sample = sample; canvas.dataset.preset = preset;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    renderCracks(ctx, pattern, size, { preset, lineWidth: 3, opacity: 85, highlight: preset === 'anime' ? 65 : 25 });
    figure.append(caption, canvas); document.querySelector('main')!.append(figure);
  }
}
