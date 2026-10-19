import type { Size } from '../core/geometry';
import type { Impact } from '../state/editorState';
import { renderCracks } from './renderCracks';

/** 元画像座標の描画をプレビューとPNG出力で共有する。編集マーカーは含めない。 */
export function renderImpacts(ctx: CanvasRenderingContext2D, impacts: readonly Impact[], size: Size): void {
  for (const impact of impacts) renderCracks(ctx, impact.pattern, size, { ...impact.params, preset: impact.preset });
}
