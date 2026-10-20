import { EditorState } from '../src/state/editorState';
import { renderImpacts } from '../src/render/renderImpacts';
const image = new Image(); image.src = new URL('../docs/samples/light.png', import.meta.url).href; await image.decode();
const size = { width: image.naturalWidth, height: image.naturalHeight };
const state = new EditorState(size); state.add({ x: 360, y: 230 });
state.update({ seed: 42, params: { centerRadius: 25, centerDensity: 0, lineWidth: 1.5, highlight: 80 } });
const baseline = state.active!;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function redraw(): void {
  const width = Number(get<HTMLInputElement>('surface-width').value);
  const darkness = Number(get<HTMLInputElement>('surface-dark').value);
  const highlight = Number(get<HTMLInputElement>('surface-highlight').value);
  state.updateSurface({ widthPercent: width, darkness }); state.update({ params: { highlight } });
  get<HTMLOutputElement>('width-value').value = `${width}%`;
  get<HTMLOutputElement>('dark-value').value = `${darkness}%`;
  get<HTMLOutputElement>('highlight-value').value = `${highlight}%`;
  for (const [id, impact] of [['baseline', { ...baseline, params: { ...baseline.params, highlight } }], ['surface', state.active!]] as const) {
    const canvas = get<HTMLCanvasElement>(id); canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); renderImpacts(ctx, [impact], size);
  }
  get('summary').textContent = `幅${width}% → 上限${state.active!.fracture!.maximumWidth.toFixed(1)}px / ${state.active!.fracture!.faces.length}面 / 中心線を再利用`;
  get('summary').dataset.status = 'ready';
}
for (const id of ['surface-width', 'surface-dark', 'surface-highlight']) get(id).addEventListener('input', redraw);
redraw();
