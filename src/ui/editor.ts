import { containRect, screenToImage, type Point } from '../core/geometry';
import { loadImage } from '../image/loadImage';
import { renderPreview } from '../render/preview';

export function mountEditor(root: HTMLElement): void {
  root.innerHTML = `
    <header><p class="eyebrow">IMAGE WORKSPACE · PHASE 1</p><h1>Mirror Crack Generator</h1>
    <p>画像を読み込み、衝撃点を指定してください。</p></header>
    <main><section class="panel"><h2>画像</h2>
      <label class="upload">画像を選択<input type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="hint">PNG / JPEG / WebP<br>プレビューへのドロップにも対応</p>
      <p class="metadata">画像未選択</p><hr><h2>衝撃点</h2>
      <p class="coordinates" aria-live="polite">未指定</p>
      <p class="hint">画像上をクリックして指定。<br>再クリックで位置を変更します。</p>
      <p class="hint">画像はブラウザ内で処理され、サーバーへ送信されません。</p>
    </section><section class="workspace" aria-label="画像ドロップ領域">
      <div class="stage"><canvas aria-label="画像プレビュー。クリックで衝撃点を指定"></canvas>
      <p class="placeholder">ここに画像をドロップ<br><span>または「画像を選択」から開く</span></p></div>
      <p class="status" role="status">画像を読み込むとプレビューが表示されます。</p>
    </section></main>`;
  const canvas = root.querySelector('canvas')!;
  const input = root.querySelector('input')!;
  const stage = root.querySelector<HTMLDivElement>('.stage')!;
  const placeholder = root.querySelector<HTMLElement>('.placeholder')!;
  const metadata = root.querySelector<HTMLElement>('.metadata')!;
  const coordinates = root.querySelector<HTMLElement>('.coordinates')!;
  const status = root.querySelector<HTMLElement>('.status')!;
  let image: HTMLImageElement | null = null;
  let impact: Point | null = null;
  let request = 0;
  function redraw(): void {
    try { renderPreview(canvas, image, impact); }
    catch { status.textContent = 'プレビューを描画できません。小さい画像または別のブラウザをお試しください。'; }
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
      image = next; impact = null;
      metadata.textContent = `${file.name} · ${next.naturalWidth} × ${next.naturalHeight} px`;
      coordinates.textContent = '未指定';
      placeholder.hidden = true;
      status.textContent = '画像上をクリックして衝撃点を指定してください。';
      redraw();
    } catch (error) {
      if (current === request) status.textContent = error instanceof Error ? error.message : '画像を読み込めません。';
    }
  }
  input.addEventListener('change', () => { void open(input.files); input.value = ''; });
  // ブラウザによるファイルの直接表示を防止する。
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  stage.addEventListener('dragover', event => { event.preventDefault(); stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
  stage.addEventListener('drop', event => {
    event.preventDefault(); stage.classList.remove('dragging'); void open(event.dataTransfer?.files ?? null);
  });
  canvas.addEventListener('click', event => {
    if (!image) return;
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    const rect = containRect(size, canvas.getBoundingClientRect());
    const point = screenToImage({ x: event.clientX, y: event.clientY }, size, rect);
    if (!point) return;
    impact = point;
    coordinates.textContent = `X: ${point.x.toFixed(2)} / Y: ${point.y.toFixed(2)} px`;
    status.textContent = '衝撃点を指定しました（元画像座標）。';
    redraw();
  });
  new ResizeObserver(redraw).observe(stage);
  window.addEventListener('resize', redraw);
}
