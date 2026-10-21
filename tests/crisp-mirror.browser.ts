import { EditorState } from '../src/state/editorState';
import { GlassMaterialState } from '../src/state/glassMaterialState';
import { renderGlassScene } from '../src/render/renderGlassScene';
import { renderGlassScene as renderOld } from './fixtures/renderGlassScene.v1';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="bg"><stop stop-color="#536584"/><stop offset="1" stop-color="#d2b9cc"/></linearGradient></defs><rect width="800" height="500" fill="url(#bg)"/><circle cx="120" cy="150" r="180" fill="#90b5c7" opacity=".35"/><path d="M385 500Q390 340 535 325Q685 350 710 500" fill="#334b70"/><path d="M413 232Q402 96 542 96Q685 120 657 290L612 360L447 328Z" fill="#222c46"/><ellipse cx="537" cy="243" rx="91" ry="110" fill="#efc9b9"/><path d="M444 222Q438 124 537 122Q635 123 632 222Q584 200 550 162Q525 204 444 222" fill="#29344f"/><path d="M468 244Q485 229 506 243M559 243Q581 229 604 244" fill="none" stroke="#36445c" stroke-width="5"/><path d="M520 295Q540 305 558 293" fill="none" stroke="#a36771" stroke-width="3"/><path d="M500 350L535 402L574 350" fill="#e3e6ed"/><text x="40" y="62" font-family="sans-serif" font-size="28" fill="#fff" letter-spacing="5">MIRROR / REFLECTION</text><text x="40" y="444" font-family="sans-serif" font-size="19" fill="#fff">Original image · face, colour and text visibility</text></svg>`;
const images = new Map<string, HTMLImageElement>();
for (const name of ['portrait', 'light', 'dark', 'transparent']) {
  const image = new Image(); image.src = name === 'portrait' ? 'data:image/svg+xml,' + encodeURIComponent(portrait) : new URL(`../docs/samples/${name}.png`, import.meta.url).href;
  await image.decode(); images.set(name, image);
}
function draw() {
  const seed = get<HTMLInputElement>('seed').valueAsNumber; if (!Number.isSafeInteger(seed)) return;
  const image = images.get(get<HTMLSelectElement>('sample').value)!, size = { width: image.naturalWidth, height: image.naturalHeight };
  const editor = new EditorState(size); editor.add({ x: size.width * .4, y: size.height * .45 }); editor.update({ seed, params: { centerDensity: Number(get<HTMLSelectElement>('density').value), lineWidth: get<HTMLInputElement>('width').valueAsNumber } });
  const settings = [
    { enabled: true, thickness: 32, edgeReflection: 60, interiorReflection: 25, microDetail: 15 },
    { enabled: true, thickness: 100, edgeReflection: 100, interiorReflection: 100, microDetail: 100 },
    editor.glass.settings,
    { enabled: true, thickness: 100, edgeReflection: 100, interiorReflection: 100, microDetail: 100 },
  ];
  const ids = ['old-default', 'old-max', 'new-default', 'new-max'];
  ids.forEach((id, i) => {
    const material = new GlassMaterialState(size, i < 2 ? 'legacy' : 'clean'); material.update({ ...settings[i], reflectionWidth: i === 3 ? 100 : get<HTMLInputElement>('reflection-width').valueAsNumber });
    const c = get<HTMLCanvasElement>(id); c.width = size.width; c.height = size.height;
    (i < 2 ? renderOld : renderGlassScene)(c.getContext('2d')!, image, editor.impacts, size, 'composite', undefined, material.prepare(editor.impacts));
  });
  get('summary').textContent = `シード ${seed} / ${editor.impacts[0].pattern.segments.length}線分 / 黒線 ${editor.impacts[0].params.lineWidth}px / 新反射幅 ${get<HTMLInputElement>('reflection-width').value}%。旧破断面の幅・大きな三角形は新描画に使用しません。`;
  get('summary').dataset.status = 'passed';
}
for (const id of ['sample', 'seed', 'density', 'width', 'reflection-width']) get(id).addEventListener('input', draw);
draw();
