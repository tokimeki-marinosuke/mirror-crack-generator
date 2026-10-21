import type { Size } from '../core/geometry';
import { isGlassMaterialActive } from '../core/glassMaterial';
import type { Impact } from '../state/editorState';
import type { GlassMaterialFrame } from '../state/glassMaterialState';
import type { ShardComposition } from '../state/shardImageState';
import { renderCompositeImage } from './renderShardImage';
import { renderGlassEdges } from './renderGlassEdges';
import { renderCracks } from './renderCracks';
import { renderFractureSurface } from './renderFractureSurface';
import { renderImpacts } from './renderImpacts';

/** 材質描画の独立した入口。無効時・未対応データでは旧描画へ委譲する。 */
export function renderGlassScene(ctx: CanvasRenderingContext2D, image: CanvasImageSource, impacts: readonly Impact[], size: Size,
  mode: 'composite' | 'cracks', composition?: ShardComposition, material?: GlassMaterialFrame): { effectsApplied: boolean; requested: boolean } {
  if (mode === 'composite') renderCompositeImage(ctx, image, size, composition);
  const requested = material ? isGlassMaterialActive(material.settings) : false;
  if (!material || !material.settings.enabled || !material.geometry.ok ||
    (material.settings.thickness === 0 && material.settings.edgeReflection === 0)) {
    renderImpacts(ctx, impacts, size); return { effectsApplied: false, requested };
  }
  let effectsApplied = false;
  const geometry = material.geometry.geometry;
  for (const impact of impacts) {
    if (geometry.unsupportedImpactIds.includes(impact.id) || !geometry.strips.some(s => s.impactId === impact.id && s.type === 'radial') || impact.params.opacity === 0) {
      renderImpacts(ctx, [impact], size); continue;
    }
    // Replace the old uniform highlight only when directional reflection is requested.
    const highlight = material.settings.edgeReflection > 0 ? 0 : impact.params.highlight;
    renderCracks(ctx, impact.pattern, size, { ...impact.params, highlight, preset: impact.preset });
    if (impact.fracture && impact.surface) renderFractureSurface(ctx, impact.pattern, impact.fracture, size,
      { opacity: impact.params.opacity, darkness: impact.surface.darkness, highlight });
    renderGlassEdges(ctx, impact, geometry, material.settings, material.light); effectsApplied = true;
  }
  return { effectsApplied, requested };
}
