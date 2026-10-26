import { PRESET_STORAGE_KEY, decodePresets, savePreset, type SavedPreset, type PresetGroup } from '../state/customPresets';
import { MATERIAL_SCALES, SHARD_SCALES, POINT_SCALES, DARKNESS_SCALE, controlPosition, controlValue, type ControlScale } from '../state/controlScale';
import { APPLICATION_SHARD_DEFAULTS, createApplicationEditor, resetApplicationSettings } from '../state/applicationDefaults';
import { effectiveImpactStrength, displayImpactStrength } from '../core/effectRanges';
import { GLASS_MATERIAL_PRESETS, isGlassMaterialActive, type GlassMaterialPreset } from '../core/glassMaterial';
import type { SurfaceSettings } from '../state/fractureSettings';
import { downloadPng, exportFileName, exportPng, type ExportMode } from '../image/exportPng';
import { containRect, imageToScreen, screenToImage, type Point } from '../core/geometry';
import { loadImage } from '../image/loadImage';
import { renderPreview } from '../render/preview';
import { EditorState, EFFECT_PRESETS, type EffectPreset, type ImpactParams, type StylePreset } from '../state/editorState';

const sliders = [
  { key: 'radialCount', label: '主要亀裂数', unit: '本' },
  { key: 'lengthPercent', label: '長さ（画像短辺基準）', unit: '%' },
  { key: 'complexity', label: '不規則性・分岐', unit: '%' },
  { key: 'concentricDensity', label: '蜘蛛の巣の密度', unit: '%' },
  { key: 'centerRadius', label: '中心領域の半径（基準長比）', unit: '%' },
  { key: 'centerDensity', label: '中心の亀裂密度（0で中心を残す）', unit: '%' },
  { key: 'lineWidth', label: '黒い亀裂の太さ（元画像基準）', unit: 'px' },
  { key: 'opacity', label: '不透明度', unit: '%' },
] as const;

const surfaceSliders = [
  { key: 'darkness', label: '黒い亀裂の濃さ' },
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
  { key: 'reflectionWidth', label: '反射幅（黒い亀裂の太さとは独立）', max: 100, unit: '%' },
  { key: 'edgeReflection', label: 'エッジ反射強度', max: 100, unit: '%' },
  { key: 'interiorReflection', label: '破片内部の反射強度', max: 100, unit: '%' },
  { key: 'microDetail', label: '微細ディテール量', max: 100, unit: '%' },
] as const;

function savedControls(group: PresetGroup): string {
 return `<label class="control">保存済みプリセット<select id="${group}-saved"><option value="">選択してください</option></select></label><div class="preset-save"><input id="${group}-name" type="text" maxlength="40" aria-label="保存するプリセット名" placeholder="プリセット名"><button id="${group}-save" type="button">保存</button><button id="${group}-delete" type="button">削除</button></div><p id="${group}-save-status" class="hint" role="status"></p>`;
}
type Mode = 'add' | 'move';

export function mountEditor(root: HTMLElement): void {
  root.innerHTML = `
    <header><p class="eyebrow">BROWSER IMAGE EDITOR</p><h1>Mirror Crack Generator</h1>
    <p>衝撃点を追加し、選択した点ごとに亀裂を調整できます。</p></header>
    <main><section class="panel"><h2>画像</h2>
      <label class="upload">画像を選択<input id="image-file" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="hint">PNG / JPEG / WebP · ドロップ対応</p>
      <p class="metadata">画像未選択</p>      <hr><h2>PNG出力</h2>
      <button type="button" id="export-composite" disabled>合成PNGを保存</button>
      <button type="button" id="export-cracks" disabled>亀裂のみPNGを保存</button>
      <p class="hint">元画像の解像度で保存します。マーカーは含めません。亀裂のみPNGは背景が透明です。</p>
      <p id="export-status" role="status"></p>
<hr><h2>衝撃点</h2>
      <div class="tools" role="group" aria-label="衝撃点の操作">
        <button type="button" data-mode="add" aria-pressed="true" disabled>追加</button>
        <button type="button" data-mode="move" aria-pressed="false" disabled>移動</button>
      </div>
      <label class="control">衝撃点を選択<select id="impact-list" disabled><option>衝撃点なし</option></select></label>
      <p class="coordinates" aria-live="polite">未指定</p>
      <button type="button" id="delete-impact" disabled>選択した衝撃点を削除</button>
      <p class="hint">追加モードで画像をクリックすると追加。マーカーをクリックすると選択、ドラッグすると移動できます。移動モードではクリック先へ選択点を移します。</p>
      <p class="hint">画像はブラウザ内で処理され、サーバーへ送信されません。</p>
      <hr><h2>設定のリセット</h2>
      <button type="button" id="reset-settings" disabled>すべての調整を初期値に戻す</button>
      <p class="hint">材質・映り・全衝撃点を基準の設定に戻します。画像・衝撃点の位置・選択は保持し、シードは1へ戻します。</p>
    </section><section class="workspace" aria-label="画像ドロップ領域">
      <div class="stage"><canvas aria-label="画像プレビュー。クリックで衝撃点を追加、マーカーをドラッグして移動"></canvas>
      <p class="placeholder">ここに画像をドロップ<br><span>または「画像を選択」から開く</span></p></div>
      <p class="status" role="status">画像を読み込むとプレビューが表示されます。</p>
    </section><section class="panel settings"><h2>ガラス材質</h2>
      <fieldset id="material-settings" disabled><legend class="sr-only">画像全体のガラス材質</legend>
      <label class="control"><span>材質効果を有効にする</span><input id="material-enabled" type="checkbox"></label>
      <label class="control">材質プリセット<select id="material-preset">${Object.entries(GLASS_MATERIAL_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}<option value="custom" disabled>カスタム</option></select></label>
      ${savedControls('material')}<details id="material-advanced"><summary>高度な設定</summary>
      <p class="hint">画像全体に適用します。シネマティックは見栄えと視認性のバランス型、リアルは控えめ、ドラマティックは強調型。選択後も自由に調整できます。</p>
      ${materialSliders.map(s=>`<label class="control" for="material-${s.key}">${s.label}<output id="material-${s.key}-value"></output></label><input id="material-${s.key}" type="range" min="0" max="${s.max}" step="0.1">`).join('')}
      <button type="button" id="material-reset">材質をデフォルトに戻す</button>
      <p class="hint">厚み・反射幅・黒い亀裂の太さは独立です。つまみの中央50%が今回の初期の見た目です。横の数値は実際の設定値です。右側でさらに強められます。内部反射は合成PNGだけに適用し、保護領域と重なる破片全体を維持します。</p>
      </details></fieldset><p id="material-status" role="status"></p><hr><h2>画像全体の映り</h2>
      <fieldset id="shard-settings" disabled><legend class="sr-only">鏡の破片の画像変形</legend>
      <label class="control">映りプリセット<select id="shard-preset"><option value="default">デフォルト</option><option value="subtle">控えめ</option><option value="none">変形なし</option><option value="custom" disabled>カスタム</option></select></label>
      ${savedControls('shard')}<details id="shard-advanced"><summary>高度な設定</summary>
      <p class="hint">全ての衝撃点で区切られた破片に適用します。ずれ・回転・明暗差は中央50%が初期の見た目です。横の数値は実効値です。隙間0は左端のままです。</p>
      <button type="button" id="shard-demo">映りの変化を試す</button>
      ${shardSliders.map(s=>`<label class="control" for="shard-${s.key}">${s.label}<output id="shard-${s.key}-value">0%</output></label><input id="shard-${s.key}" type="range" min="0" max="100" step="1" value="0">`).join('')}
      <button type="button" id="shard-reset">映りをデフォルトに戻す</button>
      <p class="hint">中心密度0%の領域と重なる破片全体を保護します。大きい破片から最大256個を変更し、小片は元画像のまま残します。合成PNGに反映し、亀裂のみPNGは従来どおりです。</p>
      </details></fieldset><p id="shard-status" role="status"></p><hr><h2>選択点の調整</h2>
      <fieldset id="settings" disabled><legend class="sr-only">亀裂設定</legend>
      <label class="control">プリセット<select id="preset"><option value="realistic">Realistic</option><option value="anime">Anime</option>${Object.entries(EFFECT_PRESETS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('')}</select></label>
      ${savedControls('point')}<details id="point-advanced"><summary>高度な設定</summary>
      <p class="hint">切り替えると調整値を初期化します。位置・シードは保持します。</p>
      <label class="control" for="impact-strength">衝撃の強さ<output id="impact-strength-value"></output></label>
      <input id="impact-strength" type="range" min="0" max="100" step="1" value="50">
      <p class="hint">長さ・分岐をまとめて調整。個別に変更した項目を優先します。プリセットの選び直しで個別調整を解除します。中心保護・黒い亀裂の太さは保持します。50%は今回の標準です。右側でさらに強められます。</p>
      ${surfaceSliders.map(s => `<label class="control" for="surface-${s.key}">${s.label}<output id="surface-${s.key}-value"></output></label><input id="surface-${s.key}" type="range" min="0" max="100" step="1">`).join('')}
      <p class="hint">各つまみの中央50%が初期値です。表示は実際の本数・長さ・割合で、不透明度100%や中心密度0の意味は変わりません。黒線幅で経路や欠けの数は変わりません。反射幅は画像全体の「ガラス材質」で調整します。破片内の画像のずれ・回転は「画像全体の映り」で調整できます。</p>
      ${sliders.map(s => `<label class="control" for="${s.key}">${s.label}<output id="${s.key}-value"></output></label>
      <input type="range" id="${s.key}" min="0" max="100" step="0.1">`).join('')}
      <label class="control" for="seed">シード（整数）</label>
      <input id="seed" type="number" step="1" min="-9007199254740991" max="9007199254740991" value="1">
      <button type="button" id="regenerate">再生成</button>
      <button type="button" id="point-reset">選択点の亀裂をデフォルトに戻す</button>
      <p class="hint">再生成でシードを1つ進めます。スライダー操作ではシードを保持します。</p>
      </details></fieldset>
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
  let saved: SavedPreset[] = [];
  try { saved = decodePresets(localStorage.getItem(PRESET_STORAGE_KEY)); } catch { get('#material-save-status').textContent='保存済みプリセットを読み込めません。ブラウザの保存設定をご確認ください。'; }
  let mode: Mode = 'add';
  let request = 0;
  let imageName = 'image';
  let loading = false;
  let exporting = false;
  function syncExportControls(): void {
    get<HTMLButtonElement>('#reset-settings').disabled = !image || loading || exporting;
    get<HTMLButtonElement>('#export-composite').disabled = !image || loading || exporting;
    get<HTMLButtonElement>('#export-cracks').disabled = !image || loading || exporting;
  }
  const actualText=(value:number)=>String(Number(value.toFixed(2)));
  function syncControl(id:string, value:number, calibration:ControlScale, text:string):void {
    const control=get<HTMLInputElement>(`#${id}`);control.value=String(controlPosition(value,calibration));
    control.dataset.effective=String(value);control.setAttribute('aria-valuetext',`${text}（調整位置${Number(control.value)}%）`);
    get<HTMLOutputElement>(`#${id}-value`).value=text;
  }
  let drag: { pointerId: number; start: Point; origin: Point; moved: boolean } | null = null;

  function redraw(): void {
    try {
      const composition=state?.shards.resolve(state.impacts);
      const material=state && state.impacts.length ? state.glass.prepare(state.impacts, composition) : undefined;
      renderPreview(canvas, image, state?.impacts ?? [], state?.selectedId ?? null, composition, material);
      const glassMessage=get('#material-status');
      if(!state?.impacts.length){glassMessage.textContent=image?'衝撃点を追加すると材質効果を確認できます。':'';glassMessage.dataset.status='waiting';}
      else if(!material || !isGlassMaterialActive(material.settings)){glassMessage.textContent='材質効果は無効です。黒い亀裂のみ表示します。';glassMessage.dataset.status='off';}
      else if(!material.geometry.ok){glassMessage.textContent='材質を安全に準備できないため、黒い亀裂の簡易描画で表示・保存します。';glassMessage.dataset.status='fallback';}
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
    for(const group of ['material','shard','point'] as const){
      const select=get<HTMLSelectElement>(`#${group}-saved`), value=select.value;
      select.replaceChildren(new Option('選択してください',''));
      saved.forEach(p=>{if(p.group===group)select.add(new Option(p.name,p.name));});
      select.value=Array.from(select.options).some(o=>o.value===value)?value:'';
    }
    const shard=state?.shards.settings;
    get<HTMLSelectElement>('#shard-preset').value=shard&&Object.keys(APPLICATION_SHARD_DEFAULTS).every(k=>shard[k as keyof typeof shard]===APPLICATION_SHARD_DEFAULTS[k as keyof typeof shard])?'default':shard&&Object.values(shard).every(v=>v===0)?'none':shard&&shard.displacement===30&&shard.rotation===20&&shard.reflection===30&&shard.gap===0?'subtle':'custom';
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
      if(slider.key==='lightDirection'){get<HTMLInputElement>('#material-lightDirection').value=String(value);get<HTMLOutputElement>('#material-lightDirection-value').value=`${value}°`;}
      else syncControl(`material-${slider.key}`,value,MATERIAL_SCALES[slider.key],`${actualText(value)}%`);
    }
    get<HTMLFieldSetElement>('#shard-settings').disabled=!image||!state?.impacts.length;
    for(const slider of shardSliders){
      const value=state?.shards.settings[slider.key]??0;
      syncControl(`shard-${slider.key}`,value,SHARD_SCALES[slider.key],`${actualText(value)}%`);
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
      get<HTMLInputElement>('#impact-strength').value = String(Math.round(displayImpactStrength(active.impactStrength ?? 50)));
      get<HTMLOutputElement>('#impact-strength-value').value = `${Math.round(displayImpactStrength(active.impactStrength ?? 50))}%`;
      for (const slider of surfaceSliders) {
        const value = active.surface?.[slider.key] ?? 0;
        syncControl(`surface-${slider.key}`,value,DARKNESS_SCALE,`${actualText(value)}%`);
      }
      seed.value = String(active.seed);
      seed.setCustomValidity('');
      for (const slider of sliders) {
        const raw=active.params[slider.key];
        const value=slider.key==='complexity'||slider.key==='concentricDensity'?raw*.65:raw;
        syncControl(slider.key,raw,POINT_SCALES[slider.key],`${actualText(value)} ${slider.unit}`);
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
      state = createApplicationEditor({ width: next.naturalWidth, height: next.naturalHeight });
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
      const material=impacts.length?state.glass.prepare(impacts,composition):undefined;
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
  get('#point-reset').addEventListener('click',()=>edit(()=>{if(state?.active)state.resetPoints(state.active.id);}));
  get('#reset-settings').addEventListener('click',()=>edit(()=>{if(state)resetApplicationSettings(state);}));
  get('#delete-impact').addEventListener('click', () => edit(() => {
    state?.remove();
    if (!state?.active) mode = 'add';
  }));
  preset.addEventListener('change', () => edit(() => state?.applyPreset(preset.value as StylePreset | EffectPreset)));
  for (const slider of sliders) {
    const control = get<HTMLInputElement>(`#${slider.key}`);
    control.addEventListener('input', () => {
      const value = control.valueAsNumber;
      queue(slider.key, () => state?.update({ params: { [slider.key]: controlValue(value,POINT_SCALES[slider.key]) } }));
    });
  }
  // Integer counts use real count increments; normalized substeps would otherwise round back forever.
  get<HTMLInputElement>('#radialCount').addEventListener('keydown',event=>{
    const key=event.key;if(!state?.active||!['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','PageUp','PageDown','Home','End'].includes(key))return;
    event.preventDefault();edit(()=>{
      const current=state!.active!.params.radialCount;
      const value=key==='Home'?POINT_SCALES.radialCount.min:key==='End'?POINT_SCALES.radialCount.max:current+(['ArrowLeft','ArrowDown','PageDown'].includes(key)?-1:1)*(key.startsWith('Page')?5:1);
      state!.update({params:{radialCount:Math.max(POINT_SCALES.radialCount.min,Math.min(POINT_SCALES.radialCount.max,value))}});
    });
  });
  for (const slider of surfaceSliders) {
    const control = get<HTMLInputElement>(`#surface-${slider.key}`);
    control.addEventListener('input', () => {
      const value = control.valueAsNumber;
      queue(`surface-${slider.key}`, () => state?.updateSurface({ [slider.key]: controlValue(value,DARKNESS_SCALE) } as Partial<SurfaceSettings>));
    });
  }
  get<HTMLInputElement>('#impact-strength').addEventListener('input', event => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    queue('strength', () => state?.updateStrength(effectiveImpactStrength(value)));
  });
  for(const slider of shardSliders){
    const control=get<HTMLInputElement>(`#shard-${slider.key}`);
    control.addEventListener('input',()=>{const value=control.valueAsNumber;queue(`shard-${slider.key}`,()=>state?.shards.update({[slider.key]:controlValue(value,SHARD_SCALES[slider.key])}));});
  }
  for(const slider of materialSliders){
    const control=get<HTMLInputElement>(`#material-${slider.key}`);
    control.addEventListener('input',()=>{const value=control.valueAsNumber;queue(`material-${slider.key}`,()=>state?.glass.update({[slider.key]:slider.key==='lightDirection'?value:controlValue(value,MATERIAL_SCALES[slider.key])}));});
  }
  for(const group of ['material','shard','point'] as const){
    const message=get(`#${group}-save-status`);
    get(`#${group}-save`).addEventListener('click',()=>edit(()=>{
      if(!state)return;
      const name=get<HTMLInputElement>(`#${group}-name`).value.trim();
      let entry:SavedPreset;
      if(group==='material')entry={group,name,values:{...state.glass.settings}};
      else if(group==='shard')entry={group,name,values:{...state.shards.settings}};
      else {if(!state.active)return;entry={group,name,values:{params:{...state.active.params},darkness:state.active.surface?.darkness??60,style:state.active.preset}};}
      try {const next=savePreset(saved,entry);localStorage.setItem(PRESET_STORAGE_KEY,JSON.stringify(next));saved=next;message.textContent=`「${name}」を保存しました。同じ名前は上書きします。`;}
      catch {message.textContent='保存できません。名前（1〜40文字）、件数（各20件）、ブラウザの保存設定をご確認ください。';}
    }));
    get(`#${group}-saved`).addEventListener('change',()=>edit(()=>{
      const value=get<HTMLSelectElement>(`#${group}-saved`).value;if(value===''||!state)return;
      const entry=saved.find(p=>p.group===group&&p.name===value);if(!entry)return;
      if(entry.group==='material')state.glass.update(entry.values);
      else if(entry.group==='shard')state.shards.update(entry.values);
      else if(state.active){state.applyPreset(entry.values.style);state.update({params:entry.values.params});state.updateSurface({darkness:entry.values.darkness,widthPercent:0,chipDensity:0});}
      get<HTMLInputElement>(`#${group}-name`).value=entry.name;
      message.textContent=`「${entry.name}」を適用しました。`;
    }));
    get(`#${group}-delete`).addEventListener('click',()=>edit(()=>{
      const value=get<HTMLSelectElement>(`#${group}-saved`).value;if(value==='')return;
      try {const next=saved.filter(p=>p.group!==group||p.name!==value);localStorage.setItem(PRESET_STORAGE_KEY,JSON.stringify(next));saved=next;message.textContent='保存済みプリセットを削除しました。';}
      catch {message.textContent='削除できません。ブラウザの保存設定をご確認ください。';}
    }));
  }
  get('#shard-preset').addEventListener('change',()=>edit(()=>{
    const value=get<HTMLSelectElement>('#shard-preset').value;
    state?.shards.update(value==='default'?APPLICATION_SHARD_DEFAULTS:value==='subtle'?{displacement:30,rotation:20,reflection:30,gap:0}:{displacement:0,rotation:0,reflection:0,gap:0});
  }));
  get('#material-enabled').addEventListener('change',()=>edit(()=>state?.glass.update({enabled:get<HTMLInputElement>('#material-enabled').checked})));
  get('#material-preset').addEventListener('change',()=>edit(()=>state?.glass.applyPreset(get<HTMLSelectElement>('#material-preset').value as GlassMaterialPreset)));
  get('#material-reset').addEventListener('click',()=>edit(()=>state?.glass.applyPreset('cinematic')));
  get('#shard-demo').addEventListener('click',()=>edit(()=>state?.shards.update({displacement:60,rotation:45,reflection:50,gap:25})));
  get('#shard-reset').addEventListener('click',()=>edit(()=>state?.shards.update(APPLICATION_SHARD_DEFAULTS)));
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
