import type { Size } from '../core/geometry';
import { isGlassMaterialActive } from '../core/glassMaterial';
import type { Impact } from '../state/editorState';
import type { GlassMaterialFrame } from '../state/glassMaterialState';
import type { ShardComposition } from '../state/shardImageState';
import { renderCompositeImage } from './renderShardImage';
import { renderImpacts } from './renderImpacts';

/** 材質描画の独立した入口。第1段階では全設定で旧描画をそのまま使用する。 */
export function renderGlassScene(ctx: CanvasRenderingContext2D, image: CanvasImageSource, impacts: readonly Impact[], size: Size,
  mode: 'composite' | 'cracks', composition?: ShardComposition, material?: GlassMaterialFrame): { effectsApplied: false; requested: boolean } {
  // 無効時の画素、重なり順、アルファを維持。新しい描画パスは第2段階以降に追加。
  if (mode === 'composite') renderCompositeImage(ctx, image, size, composition);
  renderImpacts(ctx, impacts, size);
  return { effectsApplied: false, requested: material ? isGlassMaterialActive(material.settings) : false };
}
