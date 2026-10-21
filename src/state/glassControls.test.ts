import { expect, it } from 'vitest';
import { EditorState } from './editorState';
import { GLASS_MATERIAL_PRESETS, isGlassMaterialActive } from '../core/glassMaterial';
const size = { width: 400, height: 300 };
it('新画像はシネマティック、画像変形は全0、亀裂形状は従来設定', () => {
  const state = new EditorState(size);
  expect(state.glass.preset).toBe('cinematic'); expect(state.glass.settings).toEqual(GLASS_MATERIAL_PRESETS.cinematic.settings);
  expect(state.shards.settings).toEqual({ displacement: 0, rotation: 0, reflection: 0, gap: 0 });
  expect(state.add({ x: 180, y: 130 }).preset).toBe('realistic');
});
it('全材質プリセットと個別操作は中心線・破断面・分割を変更しない', () => {
  const state = new EditorState(size); state.add({ x: 180, y: 130 });
  const before = state.impacts, composition = state.shards.resolve(state.impacts, true)!;
  const first = state.glass.prepare(state.impacts, composition);
  for (const id of ['real', 'dramatic', 'cinematic'] as const) {
    state.glass.applyPreset(id); const next = state.glass.prepare(state.impacts, composition);
    expect(next.geometry).toBe(first.geometry); expect(next.details).toBe(first.details); expect(next.interior).toBe(first.interior);
    expect(state.glass.preset).toBe(id); expect(state.impacts).toBe(before);
  }
  state.glass.update({ thickness: 83 }); expect(state.glass.preset).toBeUndefined(); expect(state.glass.settings.thickness).toBe(83);
  expect(state.glass.prepare(state.impacts, composition).geometry).toBe(first.geometry);
});
it('旧プリセットと衝撃マクロは材質を変更せず、点選択でも画像全体の値を保持', () => {
  const state = new EditorState(size); state.add({ x: 100, y: 100 }); state.add({ x: 290, y: 210 });
  state.glass.applyPreset('dramatic'); const material = state.glass.settings;
  state.select(1); state.applyPreset('anime'); state.updateStrength(90); state.select(2); state.applyPreset('web');
  expect(state.glass.settings).toBe(material); expect(state.glass.preset).toBe('dramatic');
});
it('リセット・無効化で黒線のみの表示に戻り、再有効化は保存された値を使う', () => {
  const state = new EditorState(size); state.glass.applyPreset('real');
  state.glass.update({ enabled: false }); expect(isGlassMaterialActive(state.glass.settings)).toBe(false); expect(state.glass.settings.thickness).toBe(28);
  state.glass.update({ enabled: true }); expect(isGlassMaterialActive(state.glass.settings)).toBe(true);
  state.glass.reset(); expect(isGlassMaterialActive(state.glass.settings)).toBe(false);
  for (const key of ['thickness','edgeReflection','interiorReflection','microDetail'] as const) expect(state.glass.settings[key]).toBe(0);
});
it('不正なプリセットは状態を変更しない', () => {
  const state = new EditorState(size), before = state.glass.settings;
  // Runtime callers can supply untrusted strings despite static types.
  expect(() => state.glass.applyPreset('constructor' as 'real')).toThrow(); expect(state.glass.settings).toBe(before);
});
