import { expect, it } from 'vitest';
import { validateFile } from './loadImage';

it.each(['image/png', 'image/jpeg', 'image/webp'])('%s を受け付ける', type => {
  expect(() => validateFile({ type, size: 10 })).not.toThrow();
});
it.each(['image/svg+xml', 'image/gif', 'text/plain', ''])('%s を拒否する', type => {
  expect(() => validateFile({ type, size: 10 })).toThrow('PNG / JPEG / WebP');
});
it('空の画像を拒否する', () => {
  expect(() => validateFile({ type: 'image/png', size: 0 })).toThrow('空');
});
