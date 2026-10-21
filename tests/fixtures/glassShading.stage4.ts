// Stage 4 (1d2cf33) reference for exact-output regression and developer benchmarks.
import type { Point } from '../../src/core/geometry';
import type { GlassStrip } from '../../src/core/glassGeometry';
import type { GlassLight, GlassMaterialSettings } from '../../src/core/glassMaterial';
export type GlassPanel = { polygon: Point[]; highlight: Point[]; alpha: number; shadow: number; reflection: number; lineWidth: number };
/** Smooth, path-stable modulation; does not consume the crack generator's random stream. */
export function glassProfile(pathId: string, position: number): number {
  let hash = 2166136261;
  for (const c of pathId) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const phase = (hash >>> 0) / 4294967296 * Math.PI * 2;
  return .22 + .78 * Math.pow(.5 + .5 * Math.sin(position * Math.PI * 3 + phase), 2);
}
/** Stylized directional response, deliberately selective rather than physically accurate. */
export function glassResponse(normal: Point, light: GlassLight): number {
  return Math.pow(Math.max(0, normal.x * light.screenDirection.x + normal.y * light.screenDirection.y), 4);
}
/** Bounded ribbon panels using existing rails. Thickness never changes the opening or source data. */
export function shadeGlassStrip(strip: GlassStrip, settings: GlassMaterialSettings, light: GlassLight, scale: number): GlassPanel[] {
  if (!settings.enabled || strip.type !== 'radial' || (settings.thickness === 0 && settings.edgeReflection === 0)) return [];
  const panels: GlassPanel[] = [];
  for (const side of ['left', 'right'] as const) for (let i = 1; i < strip.samples.length; i++) {
    const a = strip.samples[i - 1], b = strip.samples[i];
    const profile = glassProfile(strip.id, (a.position + b.position) / 2);
    const response = (glassResponse(a[side].normal, light) + glassResponse(b[side].normal, light)) / 2;
    const offset = (s: typeof a): Point => {
      const taper = .35 + .65 * Math.sin(Math.PI * s.position);
      const width = settings.thickness / 100 * Math.min(6, Math.max(.5, scale)) * taper * (.45 + .55 * glassProfile(strip.id, s.position));
      return { x: s[side].point.x + s[side].normal.x * width, y: s[side].point.y + s[side].normal.y * width };
    };
    panels.push({ polygon: [{ ...a[side].point }, { ...b[side].point }, offset(b), offset(a)],
      highlight: [offset(a), offset(b)], alpha: settings.thickness / 100 * (.06 + .12 * response) * profile,
      shadow: settings.thickness / 100 * (1 - response) * .18 * profile,
      reflection: settings.edgeReflection / 100 * response * profile * .9,
      lineWidth: Math.min(1.6, Math.max(.35, scale * .22)) * (.6 + .4 * profile) });
  }
  return panels;
}
