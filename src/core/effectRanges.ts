/** UI range extension. Existing physical settings are retained; 65% reaches the previous maximum. */
export const EXPANDED_LIMITS = Object.freeze({ radialCount: 45, lengthPercent: 300, lineWidth: 9, complexity: 180, concentricDensity: 190, impactStrength: 154 });
function percent(value: number) { if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('強度は0〜100%で指定してください。'); }
export function effectivePercent(value: number): number { percent(value); return value / .65; }
export function displayPercent(value: number): number { return Math.max(0, Math.min(100, value * .65)); }
/** Keep the familiar 50% neutral position, and put the old full macro at 65%. */
export function effectiveImpactStrength(value: number): number {
  percent(value);
  return value <= 50 ? value : value <= 65 ? 50 + (value - 50) * 50 / 15 : 100 + (value - 65) * (100 / .65 - 100) / 35;
}
export function displayImpactStrength(value: number): number {
  return value <= 50 ? value : value <= 100 ? 50 + (value - 50) * 15 / 50 : Math.min(100, 65 + (value - 100) * 35 / (100 / .65 - 100));
}
