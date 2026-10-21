import { EditorState } from '../src/state/editorState';
import { GLASS_MATERIAL_PRESETS } from '../src/core/glassMaterial';
import { shadeGlassStrip } from '../src/core/glassShading';
import { shadeGlassStrip as oldShade } from './fixtures/glassShading.stage4';
import { renderGlassEdges } from '../src/render/renderGlassEdges';
import { renderGlassEdges as oldRender } from './fixtures/renderGlassEdges.stage4';
import { exportPng } from '../src/image/exportPng';
export async function verifyGlassQuality() {
  let exactCases = 0;
  const check = (value: boolean, message: string) => { if (!value) throw new Error(message); };
  const makeCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  for (const density of [0, 100]) for (const preset of Object.keys(GLASS_MATERIAL_PRESETS) as (keyof typeof GLASS_MATERIAL_PRESETS)[]) {
    const size = { width: 800, height: 500 }, state = new EditorState(size);
    for (const origin of [{ x: 100, y: 80 }, { x: 780, y: 480 }]) { state.add(origin); state.update({ seed: 42, params: { centerDensity: density } }); state.updateSurface({ widthPercent: 60 }); }
    state.glass.applyPreset(preset); const frame = state.glass.prepare(state.impacts);
    check(frame.geometry.ok, 'reference geometry preparation'); if (!frame.geometry.ok) continue;
    const before = makeCanvas(800, 500), after = makeCanvas(800, 500);
    try {
      for (const impact of state.impacts) {
        oldRender(before.getContext('2d')!, impact, frame.geometry.geometry, frame.settings, frame.light, frame.details);
        renderGlassEdges(after.getContext('2d')!, impact, frame.geometry.geometry, frame.settings, frame.light, frame.details);
      }
      const a = before.getContext('2d')!.getImageData(0, 0, 800, 500).data, b = after.getContext('2d')!.getImageData(0, 0, 800, 500).data;
      check(a.every((v, i) => v === b[i]), `stage4 exact RGBA: ${density}/${preset}`); exactCases++;
    } finally { before.width = after.width = 0; }
  }
  const benchmarkState = new EditorState({ width: 1600, height: 1000 }); benchmarkState.add({ x: 700, y: 400 }); benchmarkState.update({ seed: 42 });
  const frame = benchmarkState.glass.prepare(benchmarkState.impacts);
  check(frame.geometry.ok, 'benchmark geometry'); if (!frame.geometry.ok) throw new Error('benchmark geometry');
  const radial = frame.geometry.geometry.strips.filter(s => s.type === 'radial');
  const measure = (shade: typeof shadeGlassStrip) => {
    const start = performance.now(); let panels = 0;
    for (let repeat = 0; repeat < 30; repeat++) for (const strip of radial) panels += shade(strip, frame.settings, frame.light, 6.25).length;
    return { milliseconds: performance.now() - start, panels };
  };
  measure(oldShade); measure(shadeGlassStrip);
  const oldTimes: number[] = [], newTimes: number[] = [];
  for (let i = 0; i < 7; i++) {
    const pair = i % 2 ? [measure(shadeGlassStrip), measure(oldShade)] : [measure(oldShade), measure(shadeGlassStrip)];
    check(pair[0].panels === pair[1].panels, 'same benchmark work');
    oldTimes.push(pair[i % 2 ? 1 : 0].milliseconds); newTimes.push(pair[i % 2 ? 0 : 1].milliseconds);
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const stress: { width: number; height: number; preparationMs: number; compositeMs: number; cracksMs: number; fallback: boolean }[] = [];
  for (const size of [{ width: 2048, height: 1536 }, { width: 8192, height: 2 }, { width: 2, height: 8192 }, { width: 4096, height: 4096 }]) {
    const image = new Image(); image.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="#8fabc5"/></svg>`); await image.decode();
    const state = new EditorState(size); state.add({ x: 0, y: 0 }); state.update({ seed: 42, params: { centerDensity: 0, radialCount: 24, complexity: 100 } });
    state.glass.applyPreset('dramatic');
    const start = performance.now(), frame = state.glass.prepare(state.impacts), preparationMs = performance.now() - start;
    const times: number[] = [];
    for (const mode of ['composite', 'cracks'] as const) {
      const start = performance.now(), blob = await exportPng(image, state.impacts, mode, undefined, frame);
      const bitmap = await createImageBitmap(blob); check(bitmap.width === size.width && bitmap.height === size.height, `resolution ${size.width}x${size.height} ${mode}`); bitmap.close(); times.push(performance.now() - start);
    }
    stress.push({ ...size, preparationMs, compositeMs: times[0], cracksMs: times[1], fallback: !frame.geometry.ok });
    image.src = '';
  }
  return { exactRgbaCases: exactCases, shadingMedianMs: { stage4: median(oldTimes), optimized: median(newTimes), rounds: 7, repetitions: 30, radialStrips: radial.length }, stress };
}
