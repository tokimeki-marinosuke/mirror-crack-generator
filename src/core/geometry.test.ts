import { describe, expect, it } from 'vitest';
import { containRect, imageToScreen, screenToImage } from './geometry';

describe('画像と画面の座標変換', () => {
  const image = { width: 4000, height: 2000 };
  const viewport = { left: 120, top: 80, width: 800, height: 600 };
  it('横長画像の上下余白を計算する', () => {
    expect(containRect(image, viewport)).toEqual({ left: 120, top: 180, width: 800, height: 400 });
  });
  it('縦長画像の左右余白を計算する', () => {
    expect(containRect({ width: 100, height: 200 }, viewport))
      .toEqual({ left: 370, top: 80, width: 300, height: 600 });
  });
  it('余白と非有限のクリックを無視する', () => {
    const rect = containRect(image, viewport);
    expect(screenToImage({ x: 500, y: 100 }, image, rect)).toBeNull();
    expect(screenToImage({ x: NaN, y: 200 }, image, rect)).toBeNull();
  });
  it('四隅・中央・小数座標が拡縮と画面移動後も往復する', () => {
    for (const view of [viewport, { left: -45.5, top: 300.2, width: 333, height: 777 }]) {
      const rect = containRect(image, view);
      for (const point of [{ x: 0, y: 0 }, { x: 4000, y: 2000 }, { x: 2000, y: 1000 }, { x: 123.456, y: 789.123 }]) {
        const actual = screenToImage(imageToScreen(point, image, rect), image, rect)!;
        expect(actual.x).toBeCloseTo(point.x, 9);
        expect(actual.y).toBeCloseTo(point.y, 9);
      }
    }
  });
  it('無効なサイズを拒否する', () => {
    expect(() => containRect({ width: 0, height: 1 }, viewport)).toThrow();
    expect(() => screenToImage({ x: 0, y: 0 }, image, { ...viewport, width: Infinity })).toThrow();
  });
});
