import { renderCompositeImage } from '../render/renderShardImage';
import type { ShardComposition } from '../state/shardImageState';
import type { Impact } from '../state/editorState';
import { renderImpacts } from '../render/renderImpacts';
import { validateImageSize } from './limits';

export type ExportMode = 'composite' | 'cracks';

/** 元解像度で新しいCanvasに描画し、ローカルでPNG Blobを返す。 */
export async function exportPng(image: HTMLImageElement, impacts: readonly Impact[], mode: ExportMode, composition?: ShardComposition): Promise<Blob> {
  const size = { width: image.naturalWidth, height: image.naturalHeight };
  validateImageSize(size);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D を確保できません。');
    // 末尾画素を読み戻し、寸法だけ設定できてバッファが確保できない環境も検出する。
    ctx.fillRect(size.width - 1, size.height - 1, 1, 1);
    if (ctx.getImageData(size.width - 1, size.height - 1, 1, 1).data[3] !== 255) {
      throw new Error('Canvasの画像領域を確保できません。');
    }
    ctx.clearRect(0, 0, size.width, size.height);
    if (mode === 'composite') renderCompositeImage(ctx, image, size, composition);
    renderImpacts(ctx, impacts, size);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (!result || result.size === 0 || result.type !== 'image/png') reject(new Error('PNG変換に失敗しました。'));
        else resolve(result);
      }, 'image/png');
    });
    return blob;
  } catch {
    throw new Error('PNGを書き出せませんでした。画像を小さくするか、他のタブを閉じて再度お試しください。');
  } finally {
    canvas.width = 0; canvas.height = 0;
  }
}

export function exportFileName(original: string, mode: ExportMode): string {
  const base = original.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 120) || 'image';
  return `${base}-${mode === 'composite' ? 'composite' : 'cracks'}.png`;
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url; link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // ブラウザがダウンロードを開始する前にObject URLを破棄しない。
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
