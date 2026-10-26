import { expect, it } from 'vitest';
import { APPLICATION_IMPACT_DEFAULTS, APPLICATION_SHARD_DEFAULTS, createApplicationEditor, resetApplicationSettings } from './applicationDefaults';
import { GLASS_MATERIAL_PRESETS } from '../core/glassMaterial';
const size={width:800,height:500};
it('全点・材質・映りを復帰し、画像寸法・ID・座標・選択を保持する',()=>{
 const state=createApplicationEditor(size);state.add({x:300,y:200});const second=state.add({x:600,y:400});
 state.select(1);state.update({origin:{x:350,y:240}});state.select(second.id);
 const initial=structuredClone(state.impacts);
 state.select(1);state.applyPreset('shattered');state.update({seed:42,params:{centerDensity:100,lineWidth:8}});state.updateStrength(100);
 state.select(second.id);state.applyPreset('anime');state.update({seed:123,params:{opacity:0}});state.updateSurface({darkness:0,widthPercent:100,chipDensity:100});
 state.glass.update({enabled:false,lightDirection:90,thickness:100});state.shards.update({displacement:0,rotation:0,reflection:0,gap:100});
 resetApplicationSettings(state);
 expect(state.size).toEqual(size);expect(state.selectedId).toBe(second.id);expect(state.shards.settings).toEqual(APPLICATION_SHARD_DEFAULTS);expect(state.glass.preset).toBe('cinematic');expect(state.glass.settings).toEqual(GLASS_MATERIAL_PRESETS.cinematic.settings);
 state.impacts.forEach((point,i)=>{expect(point.id).toBe(initial[i].id);expect(point.origin).toEqual(initial[i].origin);expect(point.seed).toBe(1);expect(point.preset).toBe('realistic');expect(point.effectPreset).toBeUndefined();expect(point.params).toEqual(APPLICATION_IMPACT_DEFAULTS);expect(point.surface).toEqual(initial[i].surface);expect(point.pattern).toEqual(initial[i].pattern);expect(point.overrides).toEqual({});expect(point.surfaceOverrides).toEqual({});});
});
it('削除済み点を復活させず、次のIDを再利用しない',()=>{
 const state=createApplicationEditor(size);state.add({x:200,y:150});state.add({x:600,y:400});state.select(1);state.remove();
 resetApplicationSettings(state);expect(state.impacts.map(i=>i.id)).toEqual([2]);expect(state.selectedId).toBe(2);expect(state.add({x:400,y:250}).id).toBe(3);
});
it('点がなくても復帰でき、繰り返して同じ描画データを再現する',()=>{
 const state=createApplicationEditor(size);state.glass.update({enabled:false});state.shards.update({gap:100});resetApplicationSettings(state);expect(state.impacts).toHaveLength(0);expect(state.selectedId).toBeNull();expect(state.glass.settings.enabled).toBe(true);expect(state.shards.settings).toEqual(APPLICATION_SHARD_DEFAULTS);
 state.add({x:320,y:225});resetApplicationSettings(state);const first=structuredClone(state.impacts);resetApplicationSettings(state);expect(state.impacts).toEqual(first);
});
it('手動上書きを解除し、リセット後の標準マクロで初期値を維持する',()=>{
 const state=createApplicationEditor(size);state.add({x:320,y:225});state.update({params:{lengthPercent:30,complexity:0}});resetApplicationSettings(state);const initial=state.active!.pattern;
 state.updateStrength(50);expect(state.active!.params).toEqual(APPLICATION_IMPACT_DEFAULTS);expect(state.active!.pattern).toBe(initial);
});
it('選択点だけをデフォルトに戻し、他の点と画像全体の設定を保持する',()=>{
 const state=createApplicationEditor(size);state.add({x:200,y:150});state.applyPreset('shattered');state.add({x:600,y:400});state.update({seed:42,params:{lineWidth:8,centerDensity:100}});
 const other=state.impacts[0];state.glass.applyPreset('real');state.shards.update({gap:25});const glass=state.glass.settings,shards=state.shards.settings;
 state.resetPoints(state.selectedId!);
 expect(state.impacts[0]).toBe(other);expect(state.selectedId).toBe(2);expect(state.active!.origin).toEqual({x:600,y:400});expect(state.active!.seed).toBe(1);expect(state.active!.params).toEqual(APPLICATION_IMPACT_DEFAULTS);expect(state.active!.overrides).toEqual({});expect(state.glass.settings).toBe(glass);expect(state.shards.settings).toBe(shards);
});
