import { describe, expect, it } from 'vitest';
import { EditorState, PRESETS } from './editorState';

describe('衝撃点ごとの編集状態', () => {
  const create = () => new EditorState({ width: 800, height: 600 });
  it('複数点を追加・選択し、それぞれの設定とシードを保持する', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    state.update({ seed: 42, params: { complexity: 20, lineWidth: 2 } });
    const saved = state.active;
    const second = state.add({ x: 600, y: 400 });
    state.update({ seed: 123, preset: 'anime' });
    state.select(first.id);
    expect(state.active).toBe(saved);
    expect(state.active?.seed).toBe(42);
    expect(state.active?.params.complexity).toBe(20);
    state.select(second.id);
    expect(state.active?.seed).toBe(123);
    expect(state.active?.preset).toBe('anime');
    expect(state.impacts).toHaveLength(2);
  });
  it('線幅と不透明度の変更は幾何生成とシードに影響しない', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    state.update({ params: { lineWidth: 6, opacity: 0, highlight: 100 } });
    expect(state.active?.pattern).toBe(first.pattern);
    expect(state.active?.seed).toBe(first.seed);
    expect(state.active?.params).toMatchObject({ lineWidth: 6, opacity: 0, highlight: 100 });
  });
  it('幾何設定を変更して戻すと元の形状を再現する', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    state.update({ params: { radialCount: 24 } });
    expect(state.active?.pattern).not.toEqual(first.pattern);
    expect(state.active?.seed).toBe(first.seed);
    state.update({ params: { radialCount: first.params.radialCount } });
    expect(state.active?.pattern).toEqual(first.pattern);
  });
  it('プリセットは調整値のみ初期化し、位置・シード・他点を保持する', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    const second = state.add({ x: 600, y: 400 });
    state.update({ seed: 42, params: { lineWidth: 5, complexity: 99 } });
    state.update({ preset: 'anime' });
    expect(state.active?.params).toEqual(PRESETS.anime);
    expect(state.active?.origin).toEqual(second.origin);
    expect(state.active?.seed).toBe(42);
    expect(state.impacts[0]).toBe(first);
    state.update({ preset: 'realistic' });
    expect(state.active?.params).toEqual(PRESETS.realistic);
  });
  it('再生成は選択点のシードだけを進め、元のシードに戻すと再現する', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    const second = state.add({ x: 600, y: 400 });
    state.regenerate();
    expect(state.active?.seed).toBe(2);
    expect(state.active?.pattern).not.toEqual(second.pattern);
    expect(state.impacts[0]).toBe(first);
    state.update({ seed: second.seed });
    expect(state.active?.pattern).toEqual(second.pattern);
    state.update({ seed: 4294967295 }); state.regenerate();
    expect(state.active?.seed).toBe(0);
  });
  it('移動は選択点だけに反映し、位置を戻せば同一形状になる', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    const second = state.add({ x: 600, y: 400 });
    state.update({ origin: { x: 800, y: 600 } });
    expect(state.active?.origin).toEqual({ x: 800, y: 600 });
    expect(state.active?.seed).toBe(second.seed);
    expect(state.impacts[0]).toBe(first);
    state.update({ origin: second.origin });
    expect(state.active?.pattern).toEqual(second.pattern);
  });
  it('選択点を削除し、残った点へ選択を移す。全削除後に再追加できる', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    const second = state.add({ x: 600, y: 400 });
    state.remove();
    expect(state.active).toBe(first);
    state.remove();
    expect(state.active).toBeUndefined();
    expect(state.selectedId).toBeNull();
    state.remove(); state.regenerate(); state.update({ seed: 2 });
    const next = state.add({ x: 100, y: 100 });
    expect(next.id).toBeGreaterThan(second.id);
  });
  it('不正な編集で現在の状態を壊さない', () => {
    const state = create();
    const first = state.add({ x: 200, y: 200 });
    for (const patch of [{ seed: 1.5 }, { params: { radialCount: 25 } },
      { params: { lineWidth: 0 } }, { params: { opacity: 101 } }, { params: { highlight: 101 } }, { origin: { x: -1, y: 0 } }]) {
      expect(() => state.update(patch)).toThrow();
      expect(state.active).toBe(first);
    }
    state.select(999);
    expect(state.active).toBe(first);
    expect(() => state.add({ x: Infinity, y: 0 })).toThrow();
    expect(state.impacts).toHaveLength(1);
  });
});
