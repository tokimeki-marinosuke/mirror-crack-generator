import { EditorState } from '../src/state/editorState';
import { GlassMaterialState, type GlassMaterialFrame } from '../src/state/glassMaterialState';
import { renderCompositeImage } from '../src/render/renderShardImage';
import { renderImpacts } from '../src/render/renderImpacts';
import { renderGlassScene } from '../src/render/renderGlassScene';
import { exportPng } from '../src/image/exportPng';
import type { ShardComposition } from '../src/state/shardImageState';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const images = new Map<string, HTMLImageElement>();
for (const name of ['light', 'dark', 'transparent']) {
  const image = new Image(); image.src = new URL(`../docs/samples/${name}.png`, import.meta.url).href; await image.decode(); images.set(name, image);
}
let image: HTMLImageElement, state: EditorState, material: GlassMaterialState, composition: ShardComposition | undefined;
let revision = 0;
function diagnostic(frame: GlassMaterialFrame): void {
  const c = get<HTMLCanvasElement>('diagnostic'); c.width = image.naturalWidth; c.height = image.naturalHeight;
  const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0); ctx.fillStyle = '#10141d99'; ctx.fillRect(0, 0, c.width, c.height);
  if (frame.geometry.ok) for (const strip of frame.geometry.geometry.strips) for (const side of ['left', 'right'] as const) {
    if (strip.type !== 'radial') continue;
    ctx.strokeStyle = side === 'left' ? '#ff7878' : '#70b9ff'; ctx.lineWidth = 1; ctx.beginPath();
    strip.samples.forEach((sample, i) => { const p = sample[side].point; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
    for (let i = 2; i < strip.samples.length; i += 8) {
      const { point: p, normal: n } = strip.samples[i][side]; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + n.x * 8, p.y + n.y * 8); ctx.stroke();
    }
  }
  const light = frame.light.screenDirection; ctx.strokeStyle = '#ffe580'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(55, 55); ctx.lineTo(55 + light.x * 35, 55 + light.y * 35); ctx.stroke();
}
async function draw(): Promise<void> {
  const current = ++revision; get('summary').dataset.status = 'running';
  const capturedState = state, capturedImage = image, capturedComposition = composition;
  material.update({ enabled: get<HTMLInputElement>('enabled').checked, interiorReflection: get<HTMLInputElement>('interior').valueAsNumber, microDetail: get<HTMLInputElement>('detail').valueAsNumber, lightDirection: get<HTMLInputElement>('light').valueAsNumber, edgeReflection: get<HTMLInputElement>('reflection').valueAsNumber, thickness: get<HTMLInputElement>('thickness').valueAsNumber });
  const frame = material.prepare(capturedState.impacts, capturedComposition), size = capturedState.size;
  get<HTMLOutputElement>('light-value').value = `${frame.light.angle}°`; get<HTMLOutputElement>('thickness-value').value = `${frame.settings.thickness}%`;
  const legacy = get<HTMLCanvasElement>('baseline'), next = get<HTMLCanvasElement>('material');
  legacy.width = next.width = size.width; legacy.height = next.height = size.height;
  const oldCtx = legacy.getContext('2d')!, newCtx = next.getContext('2d')!;
  renderCompositeImage(oldCtx, capturedImage, size, capturedComposition); renderImpacts(oldCtx, capturedState.impacts, size);
  const status = renderGlassScene(newCtx, capturedImage, capturedState.impacts, size, 'composite', capturedComposition, frame);
  const oldData = oldCtx.getImageData(0, 0, size.width, size.height).data, newData = newCtx.getImageData(0, 0, size.width, size.height).data;
  let differences = 0; for (let i = 0; i < oldData.length; i++) if (oldData[i] !== newData[i]) differences++;
  // 将来の描画入口の出力を既存の実PNG出力と比較する（合成・透過の両方）。
  let pngsEqual = true;
  for (const mode of ['composite', 'cracks'] as const) {
    const c = document.createElement('canvas'); c.width = size.width; c.height = size.height;
    renderGlassScene(c.getContext('2d')!, capturedImage, capturedState.impacts, size, mode, capturedComposition, frame);
    const expected = c.getContext('2d')!.getImageData(0, 0, size.width, size.height).data;
    const blob = status.effectsApplied ? await new Promise<Blob>((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png')) : await exportPng(capturedImage, capturedState.impacts, mode, capturedComposition);
    const bitmap = await createImageBitmap(blob);
    const decoded = document.createElement('canvas'); decoded.width = size.width; decoded.height = size.height;
    const ctx = decoded.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const actual = ctx.getImageData(0, 0, size.width, size.height).data;
    if (!expected.every((v, i) => v === actual[i])) pngsEqual = false;
  }
  if (current !== revision) return;
  diagnostic(frame);
  const interior = frame.interior?.ok ? frame.interior.plan : undefined;
  get('texture-status').textContent = `内部反射: ${interior?.surfaces.length ?? 0}破片 / 保護 ${interior?.protectedCount ?? 0} / 上限据え置き ${interior?.budgetCount ?? 0} / 微細欠け候補 ${frame.details?.length ?? 0}。内部反射は合成のみ・元画像の透過を保持。${frame.interior && !frame.interior.ok ? frame.interior.message : ''}`;
  const summary = get('summary');
  Object.assign(summary.dataset, { status: (status.effectsApplied || differences === 0) && pngsEqual ? 'passed' : 'failed', differences: String(differences), pngsEqual: String(pngsEqual), builds: String(material.preparations), requested: String(status.requested), effectsApplied: String(status.effectsApplied), interiors: String(interior?.surfaces.length ?? 0), details: String(frame.details?.length ?? 0) });
  summary.textContent = `表示差分 ${differences} / PNG比較 ${pngsEqual ? '一致' : '不一致'} / 材質用幾何の準備 ${material.preparations}回 / 材質効果 ${status.effectsApplied ? '適用' : '無効（旧描画）'}`;
  if (frame.geometry.ok) {
    const g = frame.geometry.geometry;
    get('geometry-status').textContent = `${g.strips.length}経路区間 / ${g.strips.reduce((n, s) => n + s.samples.length, 0)}サンプル / ${g.shards.length}破片 / 破片境界に接続した元辺 ${g.edgeBindings.filter(b => b.shardSides.length).length}本`;
    summary.dataset.strips = String(g.strips.length); summary.dataset.shards = String(g.shards.length);
  } else get('geometry-status').textContent = `${frame.geometry.reason}: ${frame.geometry.message}（描画は従来どおり継続）`;
}
function rebuild(): void {
  const seed = get<HTMLInputElement>('seed').valueAsNumber;
  if (!Number.isSafeInteger(seed)) { get('summary').textContent = 'シードは安全な整数で指定してください。'; get('summary').dataset.status = 'failed'; return; }
  image = images.get(get<HTMLSelectElement>('sample').value)!; state = new EditorState({ width: image.naturalWidth, height: image.naturalHeight }); material = new GlassMaterialState(state.size);
  const count = Number(get<HTMLSelectElement>('count').value);
  for (let i = 0; i < count; i++) {
    state.add({ x: state.size.width * (i ? .7 : .4), y: state.size.height * (i ? .65 : .45) });
    state.update({ seed, params: { centerDensity: Number(get<HTMLSelectElement>('density').value) } });
    state.updateSurface({ widthPercent: Number(get<HTMLSelectElement>('width').value), chipDensity: 40 });
  }
  if (get<HTMLInputElement>('motion').checked) state.shards.update({ displacement: 30, rotation: 20, reflection: 30, gap: 15 });
  composition = state.shards.resolve(state.impacts); void draw();
}
for (const id of ['sample', 'count', 'seed', 'density', 'width', 'motion']) get(id).addEventListener('change', rebuild);
for (const id of ['enabled', 'light', 'thickness', 'reflection', 'interior', 'detail']) get(id).addEventListener('input', () => { void draw(); });
rebuild();
