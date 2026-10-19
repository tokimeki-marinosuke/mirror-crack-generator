export function validateFile(file: Pick<File, 'type' | 'size'>): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG / JPEG / WebP 画像を選択してください。');
  }
  if (file.size === 0) throw new Error('画像ファイルが空です。');
}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  validateFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    return image;
  } catch {
    throw new Error('画像を読み込めません。破損していない PNG / JPEG / WebP 画像をお試しください。');
  } finally {
    URL.revokeObjectURL(url);
  }
}
