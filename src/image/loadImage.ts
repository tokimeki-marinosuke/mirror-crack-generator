import { MAX_FILE_BYTES, validateImageSize } from './limits';

export function validateFile(file: Pick<File, 'type' | 'size'>): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG / JPEG / WebP 画像を選択してください。');
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('画像ファイルは64MiB以下にしてください。');
  if (file.size === 0) throw new Error('画像ファイルが空です。');
}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  validateFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error('画像を読み込めません。破損していない PNG / JPEG / WebP 画像をお試しください。'); }
    validateImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
