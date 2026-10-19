import type { Size } from '../core/geometry';

export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_IMAGE_PIXELS = 16_777_216;
export const MAX_FILE_BYTES = 64 * 1024 * 1024;

/** 一枚のRGBA Canvasで最大64MiB。ブラウザ固有の限界は別途実行時に処理する。 */
export function validateImageSize(size: Size): void {
  if (!Number.isSafeInteger(size.width) || !Number.isSafeInteger(size.height) || size.width <= 0 || size.height <= 0) {
    throw new Error('画像の寸法を取得できません。別の画像を選択してください。');
  }
  if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION || size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new Error('画像が大きすぎます。一辺8,192px以内、総画素数16,777,216以下に縮小してください。');
  }
}
