import { expect, it } from 'vitest';
import { decodePresets, savePreset, validPreset, type SavedPreset } from './customPresets';
import { createApplicationEditor } from './applicationDefaults';
const state=createApplicationEditor({width:800,height:500});state.add({x:400,y:250});
const entries:SavedPreset[]=[{group:'material',name:'材質',values:{...state.glass.settings}},{group:'shard',name:'映り',values:{...state.shards.settings}},{group:'point',name:'亀裂',values:{params:{...state.active!.params},style:'realistic',darkness:60}}];
it('3種類を保存・復元し、幾何・画像・座標・シードを保存しない',()=>{
 expect(entries.every(validPreset)).toBe(true);expect(decodePresets(JSON.stringify(entries))).toEqual(entries);expect(decodePresets(null)).toEqual([]);
 expect(JSON.stringify(entries)).not.toMatch(/origin|segments|seed/);
});
it('同名は同じグループだけ上書きし、元データと参照を共有しない',()=>{
 const next=savePreset(entries,{...entries[0],name:'映り'});expect(next).toHaveLength(4);expect(savePreset(next,{...entries[0],name:'映り'})).toHaveLength(4);
 const saved=savePreset([],entries[0]);expect(saved[0]).not.toBe(entries[0]);expect(entries).toHaveLength(3);
});
it('不正値・不正JSON・件数上限を拒否する',()=>{
 for(const raw of ['{','{}','[null]',JSON.stringify([{...entries[0],name:''}]),' '.repeat(100001)])expect(()=>decodePresets(raw)).toThrow();
 expect(validPreset({group:'point',name:'bad',values:{...entries[2].values,params:{...state.active!.params,radialCount:4.5}}})).toBe(false);
 expect(validPreset({group:'shard',name:'bad',values:{displacement:Infinity,rotation:0,reflection:0,gap:0}})).toBe(false);
 const full=Array.from({length:20},(_,i)=>({...entries[0],name:String(i)}));expect(()=>savePreset(full,{...entries[0],name:'21'})).toThrow();expect(savePreset(full,{...entries[0],name:'0'})).toHaveLength(20);
});
