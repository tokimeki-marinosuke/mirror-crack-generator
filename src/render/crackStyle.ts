import type { CrackSegment } from '../core/generateCracks';
import type { Point, Size } from '../core/geometry';

export type StylePreset = 'realistic' | 'anime';
export type CrackStyle = { preset: StylePreset; lineWidth: number; opacity: number; highlight: number };

/** 乱数を消費せず、元画像座標から安定した太さを求める。 */
export function segmentWidth(segment: CrackSegment, origin: Point, size: Size, style: CrackStyle): number {
  const middle = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
  const distance = Math.hypot(middle.x - origin.x, middle.y - origin.y) / Math.min(size.width, size.height);
  const taper = Math.max(0.25, 1 - distance * 0.65);
  const weight = style.preset === 'anime'
    ? { radial: 1, concentric: 0.5, branch: 0.38 }[segment.type]
    : { radial: 0.6, concentric: 0.35, branch: 0.22 }[segment.type];
  // Anime は強い遠近の線幅変化、Realistic は細く控えめな変化。
  return style.lineWidth * weight * (style.preset === 'anime' ? taper : 0.65 + 0.35 * taper);
}
