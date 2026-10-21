import type { GlassStrip } from './glassGeometry';
import type { GlassLight, GlassMaterialSettings } from './glassMaterial';
import type { Point } from './geometry';
import { glassProfile, glassResponse, type GlassPanel } from './glassShading';
import type { StylePreset } from '../render/crackStyle';
/** 65% is the previous maximum; upper range expands physical extents, not just opacity. */
export const materialGain = (value: number): number => value / 65;
export type CleanCrack = { polygon: Point[]; left: Point[]; right: Point[]; panels: GlassPanel[] };
export function coreWidthProfile(strip: GlassStrip, lineWidth: number, style: StylePreset): (position: number) => number {
  const phase = glassProfile(`${strip.impactId}/${strip.pathId}`, .5) * Math.PI * 2;
  const weight = { radial: 1.45, concentric: .62, branch: .3 }[strip.type] * (style === 'anime' ? 1.12 : 1);
  return t => lineWidth * weight * (.42 + .58 * Math.pow(Math.max(0, 1 - t), .65)) * (.82 + .18 * (.5 + .5 * Math.sin(t * Math.PI * 2 + phase)));
}
/** Fixed centerlines -> bounded dark core + bevel rails. No legacy faces or chip polygons. */
export function buildCleanCrack(strip: GlassStrip, lineWidth: number, style: StylePreset,
  settings: GlassMaterialSettings, light: GlassLight, scale: number): CleanCrack {
  const width = coreWidthProfile(strip, lineWidth, style);
  const left: Point[] = [], right: Point[] = [], panels: GlassPanel[] = [];
  for (const sample of strip.samples) {
    const half = width(sample.position) / 2, n = { x: -sample.tangent.y, y: sample.tangent.x };
    left.push({ x: sample.center.x + n.x * half, y: sample.center.y + n.y * half });
    right.push({ x: sample.center.x - n.x * half, y: sample.center.y - n.y * half });
  }
  if (settings.enabled && strip.type === 'radial' && (settings.thickness > 0 || settings.edgeReflection > 0)) {
    const thickness = materialGain(settings.thickness), reflection = materialGain(settings.edgeReflection);
    const extra = Math.max(0, reflection - 1), typeWeight = strip.type === 'radial' ? 1 : .32;
    const phase = glassProfile(strip.pathId, .37) * Math.PI * 2;
    // Above the baseline, broaden selected bright spans while keeping unlit sides dark.
    const profile = strip.samples.map(s => .22 + .78 * Math.pow(.5 + .5 * Math.sin(s.position * Math.PI * 3 + phase), 2 / (1 + extra)));
    const line = Math.min(1.6, Math.max(.35, scale * .22)) * materialGain(settings.reflectionWidth ?? 65);
    for (const side of ['left', 'right'] as const) {
      const rails = side === 'left' ? left : right;
      const normal = strip.samples.map(s => ({ x: -s.tangent.y * (side === 'left' ? 1 : -1), y: s.tangent.x * (side === 'left' ? 1 : -1) }));
      const rim = rails.map((p,i) => ({x:p.x+normal[i].x*.2*Math.min(1,scale),y:p.y+normal[i].y*.2*Math.min(1,scale)}));
      const response = normal.map(n => Math.pow(glassResponse(n, light), 1 / (1 + extra * .6)));
      const offsets = strip.samples.map((s, i) => {
        const depth = thickness * Math.min(6, Math.max(.5, scale)) * (.35 + .65 * Math.sin(Math.PI * s.position)) * (.45 + .55 * profile[i]);
        return { x: rails[i].x + normal[i].x * depth, y: rails[i].y + normal[i].y * depth };
      });
      for (let i = 1; i < rails.length; i++) {
        const r = (response[i - 1] + response[i]) / 2, p = (profile[i - 1] + profile[i]) / 2;
        panels.push({ polygon: [rails[i - 1], rails[i], offsets[i], offsets[i - 1]],
          // Sharp reflection stays on the dark core boundary, independent of core width and bevel depth.
          highlight: [rim[i - 1], rim[i]], lineWidth: line * (.6 + .4 * p) * Math.sqrt(typeWeight),
          alpha: Math.min(1, thickness) * (.06 + .12 * r) * p * typeWeight,
          shadow: Math.min(1, thickness) * (1 - r) * .18 * p * typeWeight,
          reflection: Math.min(1, reflection) * r * p * .95 * typeWeight });
      }
    }
  }
  return { polygon: [...left, ...right.slice().reverse()], left, right, panels };
}
