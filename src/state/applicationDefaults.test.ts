import { expect, it } from 'vitest';
import { createApplicationEditor, APPLICATION_IMPACT_DEFAULTS, APPLICATION_SHARD_DEFAULTS } from './applicationDefaults';
import { displayPercent } from '../core/effectRanges';
import { EditorState, PRESETS } from './editorState';
import { GLASS_MATERIAL_PRESETS } from '../core/glassMaterial';
const size={width:800,height:500};
it('添付画像の材質・映り・点の全設定を表示スケールまで再現する',()=>{
 const state=createApplicationEditor(size),point=state.add({x:320,y:225});
 expect(state.glass.preset).toBe('cinematic');expect(state.glass.settings).toEqual(GLASS_MATERIAL_PRESETS.cinematic.settings);expect(state.glass.settings).toMatchObject({enabled:true,thickness:65,lightDirection:225,reflectionWidth:65,edgeReflection:68,interiorReflection:60,microDetail:22});
 expect(state.shards.settings).toEqual({displacement:100,rotation:100,reflection:100,gap:0});
 expect(point.preset).toBe('realistic');expect(point.params).toMatchObject({radialCount:29,lengthPercent:192,centerRadius:7,centerDensity:4,lineWidth:1,opacity:85});
 expect(displayPercent(point.params.complexity)).toBeCloseTo(74);expect(displayPercent(point.params.concentricDensity)).toBeCloseTo(97);
 expect(point.surface?.darkness).toBe(60);expect(point.seed).toBe(1);
});
it('追加点と新画像にも適用し、先の点の編集を引き継がない',()=>{
 const state=createApplicationEditor(size);state.add({x:200,y:150});state.update({seed:42,params:{radialCount:4}});const saved=state.active;
 const next=state.add({x:600,y:400});expect(next.params).toEqual(APPLICATION_IMPACT_DEFAULTS);expect(next.seed).toBe(1);expect(state.impacts[0]).toBe(saved);
 state.shards.update({rotation:0});expect(createApplicationEditor(size).shards.settings).toEqual(APPLICATION_SHARD_DEFAULTS);
});
it('Realisticの選び直し・標準マクロ50で初期形状を維持し、上側にも調整余地を残す',()=>{
 const state=createApplicationEditor(size);const first=state.add({x:320,y:225});
 state.updateStrength(50);expect(state.active!.pattern).toBe(first.pattern);expect(state.active!.params).toEqual(APPLICATION_IMPACT_DEFAULTS);
 state.updateStrength(100);expect(state.active!.params.lengthPercent).toBeGreaterThan(APPLICATION_IMPACT_DEFAULTS.lengthPercent);expect(state.active!.params.complexity).toBeGreaterThan(APPLICATION_IMPACT_DEFAULTS.complexity);
 state.applyPreset('realistic');expect(state.active!.params).toEqual(APPLICATION_IMPACT_DEFAULTS);expect(state.active!.pattern).toEqual(first.pattern);
});
it('Animeと割れ方プリセットは従来の設定・形状を維持する',()=>{
 const app=createApplicationEditor(size),legacy=new EditorState(size);app.add({x:320,y:225});legacy.add({x:320,y:225});
 for(const id of ['anime','delicate','web','shattered'] as const){app.applyPreset(id);legacy.applyPreset(id);expect(app.active!.params).toEqual(legacy.active!.params);expect(app.active!.pattern).toEqual(legacy.active!.pattern);}
});
it('映りを0へ戻す操作と低レベルAPIの初期値は維持する',()=>{
 const app=createApplicationEditor(size);app.shards.update({displacement:0,rotation:0,reflection:0,gap:0});expect(app.shards.resolve([])).toBeUndefined();
 const legacy=new EditorState(size);expect(legacy.add({x:320,y:225}).params).toEqual(PRESETS.realistic);expect(legacy.shards.settings).toEqual({displacement:0,rotation:0,reflection:0,gap:0});
});
