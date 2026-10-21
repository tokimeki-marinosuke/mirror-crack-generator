import { GLASS_MATERIAL_PRESETS, isGlassMaterialActive, type GlassMaterialPreset } from '../core/glassMaterial';
import { DEFAULT_SHARD_IMAGE_SETTINGS } from '../state/shardImageState';
import type { SurfaceSettings } from '../state/fractureSettings';
import { downloadPng, exportFileName, exportPng, type ExportMode } from '../image/exportPng';
import { containRect, imageToScreen, screenToImage, type Point } from '../core/geometry';
import { loadImage } from '../image/loadImage';
import { renderPreview } from '../render/preview';
import { EditorState, EFFECT_PRESETS, type EffectPreset, type ImpactParams, type StylePreset } from '../state/editorState';

const sliders = [
  { key: 'radialCount', label: '主要亀裂数', min: 4, max: 24, step: 1, unit: '本' },
  { key: 'lengthPercent', label: '長さ（画像短辺基準）', min: 10, max: 150, step: 1, unit: '%' },
  { key: 'complexity', label: '不規則性・分岐', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'concentricDensity', label: '蜘蛛の巣の密度', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'centerRadius', label: '中心領域の半径（基準長比）', min: 0, max: 80, step: 1, unit: '%' },
  { key: 'centerDensity', label: '中心の亀裂密度（0で中心を残す）', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'lineWidth', label: '線幅（元画像基準）', min: 0.5, max: 6, step: 0.1, unit: 'px' },
  { key: 'highlight', label: '従来の縁反射', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'opacity', label: '不透明度', min: 0, max: 100, step: 1, unit: '%' },
] as const;

const surfaceSliders = [
  { key: 'widthPercent', label: '破断面の幅（線幅とは独立）' },
  { key: 'darkness', label: '暗部の強さ' },
  { key: 'chipDensity', label: '欠けの密度' },
] as const;

const shardSliders = [
  { key: 'displacement', label: '映りのずれ' },
  { key: 'rotation', label: '映りの回転' },
  { key: 'reflection', label: '破片ごとの明暗差' },
  { key: 'gap', label: '破片間の暗い隙間' },
] as const;

const materialSliders = [
  { key: 'thickness', label: 'ガラスの厚み', max: 100, unit: '%' },
  { key: 'lightDirection', label: '光源方向（0°右・90°下）', max: 360, unit: '°' },
  { key: 'edgeReflection', label: 'エッジ反射強度', max: 100, unit: '%' },
  { key: 'interiorReflection', label: '破片内部の反射強度', max: 100, unit: '%' },
  { key: 'microDetail', label: '微細ディテール量', max: 100, unit: '%' },
] as const;

type Mode = 'add' | 'move';

export function mountEditor(root: HTMLElement): void {
  root.innerHTML = `
    <header><p class="eyebrow">BROWSER IMAGE EDITOR</p><h1>Mirror Crack Generator</h1>
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
      <hr><h2>PNG出力</h2>
      <button type="button" id="export-composite" disabled>合成PNGを保存</button>
      <button type="button" id="export-cracks" disabled>亀裂のみPNGを保存</button>
      <p class="hint">元画像の解像度で保存します。マーカーは含めません。亀裂のみPNGは背景が透明です。</p>
      <p id="export-status" role="status"></p>
    </section><section class="workspace" aria-label="画像ドロップ領域">
      <div class="stage"><canvas aria-label="画像プレビュー。クリックで衝撃点を追加、マーカーをドラッグして移動"></canvas>
      <p class="placeholder">ここに画像をドロップ<br><span>または「画像を選択」から開く</span></p></div>
      <p class="status" role="status">画像を読み込むとプレビューが表示されます。</p>
    </section><section class="panel settings"><h2>ガラス材質</h2>
      <fieldset id="material-settings" disabled><legend class="sr-only">画像全体のガラス材質</legend>
      <label class="control"><span>材質効果を有効にする</span><input id="material-enabled" type="checkbox"></label>
      <label class="control">材質プリセット<select id="material-preset">${Object.entries(GLASS_MATERIAL_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}<option value="custom" disabled>カスタム</option></select></label>
      <p class="hint">画像全体に適用します。シネマティックは見栄えと視認性のバランス型、リアルは控えめ、ドラマティックは強調型。選択後も自由に調整できます。</p>
      ${materialSliders.map(s=>`<label class="control" for="material-${s.key}">${s.label}<output id="material-${s.key}-value"></output></label><input id="material-${s.key}" type="range" min="0" max="${s.max}" step="1">`).join('')}
      <button type="button" id="material-reset">材質効果を0に戻す</button>
      <p class="hint">厚みは線幅・隙間幅とは独立です。新しいエッジ反射を0にすると各点の「従来の縁反射」を使用します。内部反射は合成PNGだけに適用し、保護領域と重なる破片全体を維持します。</p>
      </fieldset><p id="material-status" role="status"></p><hr><h2>画像全体の映り</h2>
      <fieldset id="shard-settings" disabled><legend class="sr-only">鏡の破片の画像変形</legend>
      <p class="hint">全ての衝撃点で区切られた破片に適用します。亀裂の縁の反射・破断面幅とは別の設定です。</p>
      <button type="button" id="shard-demo">映りの変化を試す</button>
      ${shardSliders.map(s=>`<label class="control" for="shard-${s.key}">${s.label}<output id="shard-${s.key}-value">0%</output></label><input id="shard-${s.key}" type="range" min="0" max="100" step="1" value="0">`).join('')}
      <button type="button" id="shard-reset">映りの変化を0に戻す</button>
      <p class="hint">中心密度0%の領域と重なる破片全体を保護します。大きい破片から最大256個を変更し、小片は元画像のまま残します。合成PNGに反映し、亀裂のみPNGは従来どおりです。</p>
      </fieldset><p id="shard-status" role="status"></p><hr><h2>選択点の調整</h2>
      <fieldset id="settings" disabled><legend class="sr-only">亀裂設定</legend>
      <label class="control">プリセット<select id="preset"><option value="realistic">Realistic</option><option value="anime">Anime</option>${Object.entries(EFFECT_PRESETS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('')}</select></label>
      <p class="hint">切り替えると調整値を初期化します。位置・シードは保持します。</p>
      <label class="control" for="impact-strength">衝撃の強さ<output id="impact-strength-value"></output></label>
      <input id="impact-strength" type="range" min="0" max="100" step="1" value="50">
      <p class="hint">長さ・分岐・欠けをまとめて調整。個別に変更した項目を優先します。プリセットの選び直しで個別調整を解除します。中心保護・線幅・破断面幅は保持します。</p>
      ${surfaceSliders.map(s => `<label class="control" for="surface-${s.key}">${s.label}<output id="surface-${s.key}-value"></output></label><input id="surface-${s.key}" type="range" min="0" max="100" step="1">`).join('')}
      <p class="hint">隙間や欠けを見るには破断面の幅を上げてください。反射は亀裂の縁の光です。破片内の画像のずれ・回転は「画像全体の映り」で調整できます。</p>
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
  let imageName = 'image';
  let loading = false;
  let exporting = false;
  function syncExportControls(): void {
    get<HTMLButtonElement>('#export-composite').disabled = !image || loading || exporting;
    get<HTMLButtonElement>('#export-cracks').disabled = !image || loading || exporting;
  }
  let drag: { pointerId: number; start: Point; origin: Point; moved: boolean } | null = null;

  function redraw(): void {
    try {
      const composition=state?.shards.resolve(state.impacts);
      const material=state && state.impacts.length && isGlassMaterialActive(state.glass.settings) ? state.glass.prepare(state.impacts, composition) : undefined;
      renderPreview(canvas, image, state?.impacts ?? [], state?.selectedId ?? null, composition, material);
      const glassMessage=get('#material-status');
      if(!state?.impacts.length){glassMessage.textContent=image?'衝撃点を追加すると材質効果を確認できます。':'';glassMessage.dataset.status='waiting';}
      else if(!material){glassMessage.textContent='材質効果は無効です（従来描画）。';glassMessage.dataset.status='off';}
      else if(!material.geometry.ok){glassMessage.textContent='材質を安全に準備できないため、従来描画で表示・保存します。';glassMessage.dataset.status='fallback';}
      else if(material.interior && !material.interior.ok){glassMessage.textContent='内部反射を省略しています。亀裂の材質効果は維持します。';glassMessage.dataset.status='partial';}
      else {const p=material.interior?.ok?material.interior.plan:undefined;glassMessage.textContent=p?`内部反射 ${p.surfaces.length}破片 / 保護 ${p.protectedCount} / 小片据え置き ${p.budgetCount}`:'断面・エッジ反射・微細ディテールを適用中。';glassMessage.dataset.status='active';}
      const message=get('#shard-status');
      if(!composition){message.textContent='映りの変化は0です。';message.dataset.status='off';}
      else if(!composition.extraction.ok){message.textContent='破片を安全に抽出できないため、元画像＋亀裂で表示・保存します。主要亀裂数・蜘蛛の巣の密度を下げるか、衝撃点を減らして再試行してください。';message.dataset.status='fallback';}
      else if(!composition.plan){message.textContent='閉じた破片境界がないため、元画像を維持しています。蜘蛛の巣の密度や亀裂の長さを調整してください。';message.dataset.status='undivided';}
      else {
        const motions=composition.plan.motions;
        message.textContent=`${motions.length}破片 / 変更対象${motions.filter(m=>m.reason==='active').length} / 保護${motions.filter(m=>m.reason==='protected').length} / 小片据え置き${motions.filter(m=>m.reason==='budget').length}`;
        message.dataset.status='active';
      }
    }
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
    get<HTMLFieldSetElement>('#material-settings').disabled=!image;
    get<HTMLInputElement>('#material-enabled').checked=state?.glass.settings.enabled??false;
    get<HTMLSelectElement>('#material-preset').value=state?.glass.preset??'custom';
    for(const slider of materialSliders){
      const value=state?.glass.settings[slider.key]??0;
      get<HTMLInputElement>(`#material-${slider.key}`).value=String(value);
      get<HTMLOutputElement>(`#material-${slider.key}-value`).value=`${value}${slider.unit}`;
    }
    get<HTMLFieldSetElement>('#shard-settings').disabled=!image||!state?.impacts.length;
    for(const slider of shardSliders){
      const value=state?.shards.settings[slider.key]??0;
      get<HTMLInputElement>(`#shard-${slider.key}`).value=String(value);
      get<HTMLOutputElement>(`#shard-${slider.key}-value`).value=`${value}%`;
    }
    get<HTMLButtonElement>('#delete-impact').disabled = !active;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.disabled = button.dataset.mode === 'add' ? !image : !active;
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
    get<HTMLElement>('.coordinates').textContent = active
      ? `X: ${active.origin.x.toFixed(2)} / Y: ${active.origin.y.toFixed(2)} px` : '未指定';
    if (active) {
      preset.value = active.effectPreset ?? active.preset;
      get<HTMLInputElement>('#impact-strength').value = String(active.impactStrength ?? 50);
      get<HTMLOutputElement>('#impact-strength-value').value = `${active.impactStrength ?? 50}%`;
      for (const slider of surfaceSliders) {
        const value = active.surface?.[slider.key] ?? 0;
        get<HTMLInputElement>(`#surface-${slider.key}`).value = String(value);
        get<HTMLOutputElement>(`#surface-${slider.key}-value`).value = `${value}%`;
      }
      seed.value = String(active.seed);
      seed.setCustomValidity('');
      for (const slider of sliders) {
        get<HTMLInputElement>(`#${slider.key}`).value = String(active.params[slider.key]);
        get<HTMLOutputElement>(`#${slider.key}-value`).value = `${active.params[slider.key]} ${slider.unit}`;
      }
      status.textContent = `衝撃点 ${active.id} / ${state!.impacts.length}点 · シード ${active.seed} · ${active.pattern.segments.length}線分`;
    } else status.textContent = image ? '追加モードで画像上をクリックしてください。' : '画像を読み込むとプレビューが表示されます。';
    syncExportControls();
    redraw();
  }
  const pending = new Map<string, () => void>();
  let frame = 0;
  function flush(): void {
    cancelAnimationFrame(frame); frame = 0;
    const actions = [...pending.values()]; pending.clear();
    for (const action of actions) action();
  }
  function queue(key: string, action: () => void): void {
    pending.set(key, action);
    if (!frame) frame = requestAnimationFrame(() => edit(() => {}));
  }
  function edit(action: () => void): void {
    try { flush(); action(); refresh(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '編集できませんでした。'; }
  }
  async function open(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const current = ++request;
    if (files.length !== 1) {
      loading = false; syncExportControls();
      status.textContent = '画像は1枚ずつ選択してください。'; return;
    }
    const file = files[0];
    loading = true; syncExportControls();
    status.textContent = '画像を読み込んでいます…';
    try {
      const next = await loadImage(file);
      if (current !== request) return;
      flush();
      image = next; imageName = file.name;
      get('#export-status').textContent = '';
      state = new EditorState({ width: next.naturalWidth, height: next.naturalHeight });
      mode = 'add'; drag = null;
      get<HTMLElement>('.metadata').textContent = `${file.name} · ${next.naturalWidth} × ${next.naturalHeight} px`;
      get<HTMLElement>('.placeholder').hidden = true;
      refresh();
    } catch (error) {
      if (current === request) status.textContent = error instanceof Error ? error.message : '画像を読み込めません。';
    } finally {
      if (current === request) { loading = false; syncExportControls(); }
    }
  }
  async function save(mode: ExportMode): Promise<void> {
    if (!image || !state || loading || exporting) return;
    try { flush(); refresh(); } catch { return; }
    const source = image;
    const impacts = state.impacts;
    const filename = exportFileName(imageName, mode);
    const feedback = get<HTMLElement>('#export-status');
    exporting = true; syncExportControls();
    feedback.textContent = 'PNGを作成しています…';
    try {
      const composition=state.shards.resolve(impacts);
      const material=isGlassMaterialActive(state.glass.settings)&&impacts.length?state.glass.prepare(impacts,composition):undefined;
      const blob = await exportPng(source, impacts, mode, composition, material);
      downloadPng(blob, filename);
      feedback.textContent = `${filename} の保存を開始しました（${source.naturalWidth} × ${source.naturalHeight}px）。`;
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : 'PNGの保存に失敗しました。';
    } finally { exporting = false; syncExportControls(); }
  }
  get('#export-composite').addEventListener('click', () => { void save('composite'); });
  get('#export-cracks').addEventListener('click', () => { void save('cracks'); });
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
  preset.addEventListener('change', () => edit(() => state?.applyPreset(preset.value as StylePreset | EffectPreset)));
  for (const slider of sliders) {
    const control = get<HTMLInputElement>(`#${slider.key}`);
    control.addEventListener('input', () => {
      const value = control.valueAsNumber;
      queue(slider.key, () => state?.update({ params: { [slider.key]: value } }));
    });
  }
  for (const slider of surfaceSliders) {
    const control = get<HTMLInputElement>(`#surface-${slider.key}`);
    control.addEventListener('input', () => {
      const value = control.valueAsNumber;
      queue(`surface-${slider.key}`, () => state?.updateSurface({ [slider.key]: value } as Partial<SurfaceSettings>));
    });
  }
  get<HTMLInputElement>('#impact-strength').addEventListener('input', event => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    queue('strength', () => state?.updateStrength(value));
  });
  for(const slider of shardSliders){
    const control=get<HTMLInputElement>(`#shard-${slider.key}`);
    control.addEventListener('input',()=>{const value=control.valueAsNumber;queue(`shard-${slider.key}`,()=>state?.shards.update({[slider.key]:value}));});
  }
  for(const slider of materialSliders){
    const control=get<HTMLInputElement>(`#material-${slider.key}`);
    control.addEventListener('input',()=>{const value=control.valueAsNumber;queue(`material-${slider.key}`,()=>state?.glass.update({[slider.key]:value}));});
  }
  get('#material-enabled').addEventListener('change',()=>edit(()=>state?.glass.update({enabled:get<HTMLInputElement>('#material-enabled').checked})));
  get('#material-preset').addEventListener('change',()=>edit(()=>state?.glass.applyPreset(get<HTMLSelectElement>('#material-preset').value as GlassMaterialPreset)));
  get('#material-reset').addEventListener('click',()=>edit(()=>state?.glass.reset()));
  get('#shard-demo').addEventListener('click',()=>edit(()=>state?.shards.update({displacement:60,rotation:45,reflection:50,gap:25})));
  get('#shard-reset').addEventListener('click',()=>edit(()=>state?.shards.update(DEFAULT_SHARD_IMAGE_SETTINGS)));
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
