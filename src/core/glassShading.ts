import type { Point } from './geometry';
import type { GlassStrip } from './glassGeometry';
import type { GlassLight, GlassMaterialSettings } from './glassMaterial';
export type GlassPanel = { polygon: Point[]; highlight: Point[]; alpha: number; shadow: number; reflection: number; lineWidth: number };
/** Smooth, path-stable modulation; does not consume the crack generator's random stream. */
function pathPhase(pathId: string): number {
  let hash = 2166136261;
  for (const c of pathId) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296 * Math.PI * 2;
}
function profileAt(phase: number, position: number): number {
  return .22 + .78 * Math.pow(.5 + .5 * Math.sin(position * Math.PI * 3 + phase), 2);
}
export function glassProfile(pathId: string, position: number): number { return profileAt(pathPhase(pathId), position); }
/** Stylized directional response, deliberately selective rather than physically accurate. */
export function glassResponse(normal: Point, light: GlassLight): number {
  return Math.pow(Math.max(0, normal.x * light.screenDirection.x + normal.y * light.screenDirection.y), 4);
}
/** Bounded ribbon panels using existing rails. Thickness never changes the opening or source data. */
export function shadeGlassStrip(strip: GlassStrip, settings: GlassMaterialSettings, light: GlassLight, scale: number): GlassPanel[] {
  if (!settings.enabled || strip.type !== 'radial' || (settings.thickness === 0 && settings.edgeReflection === 0)) return [];
  const panels: GlassPanel[] = [], phase = pathPhase(strip.id);
  const baseWidth = settings.thickness / 100 * Math.min(6, Math.max(.5, scale));
  const baseLineWidth = Math.min(1.6, Math.max(.35, scale * .22));
  const profiles = strip.samples.slice(1).map((b, i) => profileAt(phase, (strip.samples[i].position + b.position) / 2));
  for (const side of ['left', 'right'] as const) {
    // Reuse each vertex's lighting/offset for both adjacent panels, without a persistent cache.
    const responses = strip.samples.map(s => glassResponse(s[side].normal, light));
    const offsets = strip.samples.map(s => {
      const taper = .35 + .65 * Math.sin(Math.PI * s.position);
      const width = baseWidth * taper * (.45 + .55 * profileAt(phase, s.position));
      return { x: s[side].point.x + s[side].normal.x * width, y: s[side].point.y + s[side].normal.y * width };
    });
    for (let i = 1; i < strip.samples.length; i++) {
      const a = strip.samples[i - 1], b = strip.samples[i], profile = profiles[i - 1];
      const response = (responses[i - 1] + responses[i]) / 2;
      panels.push({ polygon: [{ ...a[side].point }, { ...b[side].point }, offsets[i], offsets[i - 1]],
        highlight: [offsets[i - 1], offsets[i]], alpha: settings.thickness / 100 * (.06 + .12 * response) * profile,
        shadow: settings.thickness / 100 * (1 - response) * .18 * profile,
        reflection: settings.edgeReflection / 100 * response * profile * .9,
        lineWidth: baseLineWidth * (.6 + .4 * profile) });
    }
  }
  return panels;
}
