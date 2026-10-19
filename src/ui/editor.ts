import { containRect, imageToScreen, screenToImage, type Point } from '../core/geometry';
import { loadImage } from '../image/loadImage';
import { renderPreview } from '../render/preview';
import { EditorState, type ImpactParams, type StylePreset } from '../state/editorState';

const sliders = [
  { key: 'radialCount', label: '主要亀裂数', min: 4, max: 24, step: 1, unit: '本' },
  { key: 'lengthPercent', label: '長さ（画像短辺基準）', min: 10, max: 150, step: 1, unit: '%' },
  { key: 'complexity', label: '複雑さ', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'concentricDensity', label: '同心円密度', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'lineWidth', label: '線幅（元画像基準）', min: 0.5, max: 6, step: 0.1, unit: 'px' },
  { key: 'opacity', label: '不透明度', min: 0, max: 100, step: 1, unit: '%' },
] as const;

type Mode = 'add' | 'move';

export function mountEditor(root: HTMLElement): void {
  root.innerHTML = `
    <header><p class="eyebrow">IMAGE WORKSPACE · PHASE 3</p><h1>Mirror Crack Generator</h1>
    <p>衝撃点を追加し、選択した点ごとに亀裂を調整できます。</p></header>
    <main><section class="panel"><h2>画像</h2>
      <label class="upload">画像を選択<input id="image-file" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="hint">PNG / JPEG / WebP · ドロップ対応</p>
      <p class="metadata">画像未選択</p><hr><h2>衝撃点</h2>
      <div class="tools" role="group" aria-label="衝撃点の操作">
        <button type="button" data-mode="add" aria-pressed="true" disabled>追加</button>
        <button type="button" data-mode="move" aria-pressed="false" disabled>移動</button>
      </div>
      <label class="control">衝撃点を選択<select id="impact-list" disabled><option>衝撃点なし</option></select></label>
      <p class="coordinates" aria-live="polite">未指定</p>
      <button type="button" id="delete-impact" disabled>選択した衝撃点を削除</button>
      <p class="hint">追加モードで画像をクリックすると追加。マーカーをクリックすると選択、ドラッグすると移動できます。移動モードではクリック先へ選択点を移します。</p>
      <p class="hint">画像はブラウザ内で処理され、サーバーへ送信されません。</p>
    </section><section class="workspace" aria-label="画像ドロップ領域">
      <div class="stage"><canvas aria-label="画像プレビュー。クリックで衝撃点を追加、マーカーをドラッグして移動"></canvas>
      <p class="placeholder">ここに画像をドロップ<br><span>または「画像を選択」から開く</span></p></div>
      <p class="status" role="status">画像を読み込むとプレビューが表示されます。</p>
    </section><section class="panel settings"><h2>選択点の調整</h2>
      <fieldset id="settings" disabled><legend class="sr-only">亀裂設定</legend>
      <label class="control">プリセット<select id="preset"><option value="realistic">Realistic</option><option value="anime">Anime</option></select></label>
      <p class="hint">切り替えると調整値を初期化します。位置・シードは保持します。</p>
      ${sliders.map(s => `<label class="control" for="${s.key}">${s.label}<output id="${s.key}-value"></output></label>
      <input type="range" id="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">`).join('')}
      <label class="control" for="seed">シード（整数）</label>
      <input id="seed" type="number" step="1" min="-9007199254740991" max="9007199254740991" value="1">
      <button type="button" id="regenerate">再生成</button>
      <p class="hint">再生成でシードを1つ進めます。スライダー操作ではシードを保持します。</p>
      </fieldset>
    </section></main>`;
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const canvas = get<HTMLCanvasElement>('canvas');
  const input = get<HTMLInputElement>('#image-file');
  const stage = get<HTMLDivElement>('.stage');
  const status = get<HTMLElement>('.status');
  const list = get<HTMLSelectElement>('#impact-list');
  const settings = get<HTMLFieldSetElement>('#settings');
  const seed = get<HTMLInputElement>('#seed');
  const preset = get<HTMLSelectElement>('#preset');
  let image: HTMLImageElement | null = null;
  let state: EditorState | null = null;
  let mode: Mode = 'add';
  let request = 0;
  let drag: { pointerId: number; start: Point; origin: Point; moved: boolean } | null = null;

  function redraw(): void {
    try { renderPreview(canvas, image, state?.impacts ?? [], state?.selectedId ?? null); }
    catch { status.textContent = 'プレビューを描画できません。小さい画像または別のブラウザをお試しください。'; }
  }
  function refresh(): void {
    const active = state?.active;
    list.replaceChildren();
    if (state?.impacts.length) {
      for (const impact of state.impacts) list.add(new Option(`衝撃点 ${impact.id}`, String(impact.id)));
      list.value = String(state.selectedId);
    } else list.add(new Option('衝撃点なし', ''));
    list.disabled = !active;
    settings.disabled = !active;
    get<HTMLButtonElement>('#delete-impact').disabled = !active;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.disabled = button.dataset.mode === 'add' ? !image : !active;
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
    get<HTMLElement>('.coordinates').textContent = active
      ? `X: ${active.origin.x.toFixed(2)} / Y: ${active.origin.y.toFixed(2)} px` : '未指定';
    if (active) {
      preset.value = active.preset;
      seed.value = String(active.seed);
      seed.setCustomValidity('');
      for (const slider of sliders) {
        get<HTMLInputElement>(`#${slider.key}`).value = String(active.params[slider.key]);
        get<HTMLOutputElement>(`#${slider.key}-value`).value = `${active.params[slider.key]} ${slider.unit}`;
      }
      status.textContent = `衝撃点 ${active.id} / ${state!.impacts.length}点 · シード ${active.seed} · ${active.pattern.segments.length}線分`;
    } else status.textContent = image ? '追加モードで画像上をクリックしてください。' : '画像を読み込むとプレビューが表示されます。';
    redraw();
  }
  function edit(action: () => void): void {
    try { action(); refresh(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '編集できませんでした。'; }
  }
  async function open(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const current = ++request;
    if (files.length !== 1) { status.textContent = '画像は1枚ずつ選択してください。'; return; }
    const file = files[0];
    status.textContent = '画像を読み込んでいます…';
    try {
      const next = await loadImage(file);
      if (current !== request) return;
      image = next;
      state = new EditorState({ width: next.naturalWidth, height: next.naturalHeight });
      mode = 'add'; drag = null;
      get<HTMLElement>('.metadata').textContent = `${file.name} · ${next.naturalWidth} × ${next.naturalHeight} px`;
      get<HTMLElement>('.placeholder').hidden = true;
      refresh();
    } catch (error) {
      if (current === request) status.textContent = error instanceof Error ? error.message : '画像を読み込めません。';
    }
  }
  input.addEventListener('change', () => { void open(input.files); input.value = ''; });
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  stage.addEventListener('dragover', event => { event.preventDefault(); stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
  stage.addEventListener('drop', event => {
    event.preventDefault(); stage.classList.remove('dragging'); void open(event.dataTransfer?.files ?? null);
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.addEventListener('click', () => { mode = button.dataset.mode as Mode; refresh(); });
  }
  list.addEventListener('change', () => edit(() => state?.select(Number(list.value))));
  get('#delete-impact').addEventListener('click', () => edit(() => {
    state?.remove();
    if (!state?.active) mode = 'add';
  }));
  preset.addEventListener('change', () => edit(() => state?.update({ preset: preset.value as StylePreset })));
  for (const slider of sliders) {
    const control = get<HTMLInputElement>(`#${slider.key}`);
    control.addEventListener('input', () => edit(() => {
      const params: Partial<ImpactParams> = { [slider.key]: control.valueAsNumber };
      state?.update({ params });
    }));
  }
  function applySeed(): boolean {
    const value = seed.valueAsNumber;
    if (!Number.isSafeInteger(value)) {
      seed.setCustomValidity('シードは安全な整数で指定してください。');
      seed.reportValidity();
      return false;
    }
    seed.setCustomValidity('');
    state?.update({ seed: value });
    return true;
  }
  seed.addEventListener('input', () => seed.setCustomValidity(''));
  seed.addEventListener('change', () => edit(() => { if (!applySeed()) throw new Error('シードは安全な整数で指定してください。'); }));
  get('#regenerate').addEventListener('click', () => edit(() => {
    if (!applySeed()) throw new Error('シードを整数に修正してください。');
    state?.regenerate();
  }));
  const imageRect = () => containRect(state!.size, canvas.getBoundingClientRect());
  const toImage = (event: PointerEvent) => screenToImage({ x: event.clientX, y: event.clientY }, state!.size, imageRect());
  canvas.addEventListener('pointerdown', event => {
    if (!state || event.button !== 0 || !event.isPrimary) return;
    const point = toImage(event);
    if (!point) return;
    const rect = imageRect();
    const hit = [...state.impacts].reverse().find(impact => {
      const p = imageToScreen(impact.origin, state!.size, rect);
      return Math.hypot(p.x - event.clientX, p.y - event.clientY) <= 16;
    });
    edit(() => {
      if (hit) {
        state!.select(hit.id);
        drag = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { ...hit.origin }, moved: false };
        canvas.setPointerCapture(event.pointerId);
      } else if (mode === 'add') state!.add(point);
      else state!.update({ origin: point });
    });
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId || !state) return;
    if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 3 && !drag.moved) return;
    const point = toImage(event);
    if (!point) return;
    drag.moved = true;
    edit(() => state!.update({ origin: point }));
  });
  const stopDrag = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', event => {
    if (drag?.pointerId === event.pointerId && state) edit(() => state!.update({ origin: drag!.origin }));
    stopDrag(event);
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  new ResizeObserver(redraw).observe(stage);
  window.addEventListener('resize', redraw);
  refresh();
}
