import { expect, it } from 'vitest';
import { buildCleanCrack, coreWidthProfile, materialGain } from './cleanCracks';
import { EditorState } from '../state/editorState';
import { GlassMaterialState } from '../state/glassMaterialState';
import { createGlassLight, GLASS_MATERIAL_PRESETS, isGlassMaterialActive, resolveGlassMaterial } from './glassMaterial';
const size = { width: 800, height: 500 };
function fixture() {
  const editor = new EditorState(size); editor.add({ x: 300, y: 200 }); editor.update({ seed: 42 });
  const frame = editor.glass.prepare(editor.impacts); if (!frame.geometry.ok) throw new Error(frame.geometry.message);
  return { editor, frame, strip: frame.geometry.geometry.strips.find(s => s.type === 'radial' && s.region === 'outer')! };
}
it('旧幅100・欠け100でも通常用輪郭は中心線のままでキャッシュを変更しない', () => {
  const { editor, frame } = fixture(), pattern = editor.active!.pattern;
  editor.updateSurface({ widthPercent: 100, chipDensity: 100 });
  expect(editor.active!.fracture!.faces.some(f => f.kind === 'chip')).toBe(true);
  const after = editor.glass.prepare(editor.impacts);
  expect(after.appearance).toBe('clean'); expect(after.geometry).toBe(frame.geometry); expect(after.details).toBe(frame.details); expect(editor.active!.pattern).toBe(pattern);
  if (after.geometry.ok) expect(after.geometry.geometry.strips.every(s => s.samples.every(p => p.left.point.x === p.center.x && p.right.point.y === p.center.y))).toBe(true);
});
it('幅・反射幅・材質で経路、分岐、破片分割、欠け候補を再生成しない', () => {
  const { editor } = fixture(); editor.shards.update({ displacement: 30 });
  const composition = editor.shards.resolve(editor.impacts), first = editor.glass.prepare(editor.impacts, composition), pattern = editor.active!.pattern;
  editor.update({ params: { lineWidth: 6 } }); editor.glass.update({ reflectionWidth: 100, thickness: 100, microDetail: 100 });
  const next = editor.glass.prepare(editor.impacts, editor.shards.resolve(editor.impacts));
  expect(next.geometry).toBe(first.geometry); expect(next.details).toBe(first.details); expect(next.interior).toBe(first.interior); expect(editor.active!.pattern).toBe(pattern); expect(editor.shards.extractions).toBe(1);
});
it('主要線・接続線・分岐の幅に差があり、経路に沿う幅が連続する', () => {
  const { strip } = fixture();
  const profiles = (['radial','concentric','branch'] as const).map(type => coreWidthProfile({ ...strip, type }, 6, 'realistic'));
  for (let i = 1; i <= 100; i++) { const t = i / 100; expect(profiles[0](t)).toBeGreaterThan(profiles[1](t)); expect(profiles[1](t)).toBeGreaterThan(profiles[2](t)); expect(Math.abs(profiles[0](t) - profiles[0](t - .00001))).toBeLessThan(.02); }
});
it('黒線幅は反射の位置だけを追従させ、反射線幅と候補数を変えない', () => {
  const { strip, frame } = fixture();
  const a = buildCleanCrack(strip, 1, 'realistic', frame.settings, frame.light, 3.125), b = buildCleanCrack(strip, 6, 'realistic', frame.settings, frame.light, 3.125);
  expect(a.panels.map(p => p.lineWidth)).toEqual(b.panels.map(p => p.lineWidth)); expect(a.panels).toHaveLength(b.panels.length);
  expect(Math.hypot(b.panels[0].highlight[0].x-b.left[0].x,b.panels[0].highlight[0].y-b.left[0].y)).toBeCloseTo(.2); expect(a.left[0]).not.toEqual(b.left[0]);
  for (const [i,p] of b.left.entries()) expect(Math.hypot(p.x-strip.samples[i].center.x,p.y-strip.samples[i].center.y)).toBeLessThan(4.9);
});
it('反射幅は黒線と断面の位置を変えず、反射の太さだけを変更する', () => {
  const { strip, frame } = fixture();
  const a = buildCleanCrack(strip, 2, 'realistic', { ...frame.settings, reflectionWidth: 30 }, frame.light, 3.125), b = buildCleanCrack(strip, 2, 'realistic', { ...frame.settings, reflectionWidth: 100 }, frame.light, 3.125);
  expect(a.polygon).toEqual(b.polygon); expect(a.panels.map(p => p.highlight)).toEqual(b.panels.map(p => p.highlight)); expect(b.panels[0].lineWidth).toBeGreaterThan(a.panels[0].lineWidth);
});
it('65%を従来最大相当の基準にし、100%では濃度だけでなく断面と反射区間を広げる', () => {
  expect(materialGain(65)).toBe(1); expect(materialGain(100)).toBeGreaterThan(1);
  const { strip, frame } = fixture(), at = (value:number) => buildCleanCrack(strip,1,'realistic',{...frame.settings,thickness:value,edgeReflection:value},frame.light,3.125);
  const a=at(65),b=at(100); expect(a.polygon).toEqual(b.polygon); expect(a.panels.map(p=>p.alpha)).not.toEqual(b.panels.map(p=>p.alpha));
  expect(a.panels.map(p=>p.polygon)).not.toEqual(b.panels.map(p=>p.polygon)); expect(a.panels.map(p=>p.reflection)).not.toEqual(b.panels.map(p=>p.reflection));
});
it('最大設定でも有限で、分岐に大きい断面を作らず、入力を変更しない', () => {
  const { strip, frame } = fixture(), before = structuredClone(strip);
  const output=buildCleanCrack(strip,6,'anime',{...frame.settings,thickness:100,edgeReflection:100,reflectionWidth:100},createGlassLight(180),50);
  expect(output.polygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  expect(output.panels.every(p=>p.alpha>=0&&p.alpha<=1&&p.reflection>=0&&p.reflection<=1&&p.lineWidth<=2.5&&p.polygon.length===4)).toBe(true);
  expect(buildCleanCrack({...strip,type:'branch'},6,'anime',frame.settings,frame.light,5).panels).toEqual([]); expect(strip).toEqual(before);
});
it('材質無効でも黒線が残り、旧輪郭APIも明示的に利用できる', () => {
  const { strip, frame, editor } = fixture();
  const zero=resolveGlassMaterial({enabled:false});const output=buildCleanCrack(strip,1,'realistic',zero,frame.light,3);
  expect(output.polygon.length).toBeGreaterThan(0);expect(output.panels).toEqual([]);
  const legacy=new GlassMaterialState(size);expect(legacy.prepare(editor.impacts).appearance).toBe('legacy');
});
it('反射幅だけでは材質を有効化せず、不正な幅を拒否する', () => {
  expect(isGlassMaterialActive(resolveGlassMaterial({enabled:true,reflectionWidth:100}))).toBe(false);
  for(const value of [NaN,Infinity,-1,101])expect(()=>resolveGlassMaterial({reflectionWidth:value})).toThrow();
});
it('シネマティックは主要な材質を旧最大付近にし、微細欠けは控えめにする', () => {
  const s=GLASS_MATERIAL_PRESETS.cinematic.settings;expect(s.thickness).toBeGreaterThanOrEqual(60);expect(s.edgeReflection).toBeGreaterThanOrEqual(65);expect(s.interiorReflection).toBeGreaterThanOrEqual(60);expect(s.microDetail).toBeLessThan(30);
});
