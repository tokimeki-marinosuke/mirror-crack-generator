import { expect, it } from 'vitest';
import { validateImageSize, MAX_IMAGE_PIXELS } from './limits';
import { validateFile } from './loadImage';
import { exportFileName } from './exportPng';

it.each([{ width: 4096, height: 4096 }, { width: 8192, height: 1 }, { width: 1, height: 8192 }])('上限以内を受け付ける: %o', size => {
  expect(() => validateImageSize(size)).not.toThrow();
});
it.each([{ width: 8193, height: 1 }, { width: 5000, height: 5000 }, { width: 0, height: 1 },
  { width: 1.5, height: 1 }, { width: Infinity, height: 1 }, { width: NaN, height: 1 }])('無効寸法を拒否: %o', size => {
  expect(() => validateImageSize(size)).toThrow();
});
it('総画素数境界の直後を拒否', () => {
  expect(MAX_IMAGE_PIXELS).toBe(4096 * 4096);
  expect(() => validateImageSize({ width: 4096, height: 4097 })).toThrow('大きすぎ');
});
it('ファイルサイズは64MiB以下', () => {
  expect(() => validateFile({ type: 'image/png', size: 64 * 1024 * 1024 })).not.toThrow();
  expect(() => validateFile({ type: 'image/png', size: 64 * 1024 * 1024 + 1 })).toThrow('64MiB');
});
it('出力名にモードを含め、元拡張子とパス文字を除く', () => {
  expect(exportFileName('sample.photo.webp', 'composite')).toBe('sample.photo-composite.png');
  expect(exportFileName('日本語.png', 'cracks')).toBe('日本語-cracks.png');
  expect(exportFileName('bad/name.png', 'cracks')).toBe('bad_name-cracks.png');
  expect(exportFileName('', 'composite')).toBe('image-composite.png');
});
