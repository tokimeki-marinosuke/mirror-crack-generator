import { expect, it } from 'vitest';
import { EditorHistory } from './editorHistory';
import { createApplicationEditor, resetApplicationSettings } from './applicationDefaults';
const size={width:800,height:500};
function setup(limit=50){
 const state=createApplicationEditor(size),history=new EditorHistory(limit);
 const edit=(action:()=>void,group?:string)=>{const before=state.snapshot();action();history.record(before,state.snapshot(),group);};
 const undo=()=>{const snapshot=history.undo();if(snapshot)state.restore(snapshot);};
 const redo=()=>{const snapshot=history.redo();if(snapshot)state.restore(snapshot);};
 return{state,history,edit,undo,redo};
}
it('追加・移動・削除を往復し、座標・選択・ID採番と亀裂を再現する',()=>{
 const {state,history,edit,undo,redo}=setup();expect(history.canUndo).toBe(false);expect(history.undo()).toBeUndefined();
 edit(()=>state.add({x:250,y:200}));edit(()=>state.add({x:550,y:300}));
 const original=structuredClone(state.impacts);edit(()=>state.update({origin:{x:500,y:350}}));const moved=structuredClone(state.impacts);
 edit(()=>state.remove());expect(state.selectedId).toBe(1);undo();expect(state.impacts).toEqual(moved);expect(state.selectedId).toBe(2);
 undo();expect(state.impacts).toEqual(original);redo();expect(state.impacts).toEqual(moved);
 undo();undo();expect(state.impacts).toHaveLength(1);expect(state.selectedId).toBe(1);undo();expect(state.impacts).toEqual([]);expect(state.selectedId).toBeNull();
 redo();redo();expect(state.impacts).toEqual(original);expect(state.add({x:700,y:450}).id).toBe(3);
});
it('プリセット・マクロ上書き・シード・材質・映り・全体リセットを正確に往復する',()=>{
 const {state,edit,undo,redo}=setup();state.add({x:350,y:250});
 edit(()=>{state.applyPreset('shattered');state.updateStrength(90);state.update({params:{lineWidth:4},seed:42});state.glass.applyPreset('real');state.shards.update({gap:40});});
 const snapshot=state.snapshot(),pattern=structuredClone(state.active!.pattern);
 edit(()=>state.glass.update({thickness:120,lightDirection:90}));const custom=state.snapshot();undo();expect(state.glass.preset).toBe('real');redo();expect(state.snapshot()).toEqual(custom);
 undo();edit(()=>resetApplicationSettings(state));undo();expect(state.snapshot()).toEqual(snapshot);expect(state.active!.pattern).toEqual(pattern);redo();expect(state.active!.seed).toBe(1);expect(state.glass.preset).toBe('cinematic');
});
it('同じ操作中の連続変更だけまとめ、別操作との境界・往復・分岐を維持する',()=>{
 const {state,history,edit,undo,redo}=setup();state.add({x:350,y:250});
 edit(()=>state.update({params:{lineWidth:2}}),'width');edit(()=>state.update({params:{lineWidth:3}}),'width');edit(()=>state.update({params:{lineWidth:4}}),'width');
 undo();expect(state.active!.params.lineWidth).toBe(1);expect(history.canUndo).toBe(false);redo();expect(state.active!.params.lineWidth).toBe(4);
 history.endGroup();edit(()=>state.update({params:{lineWidth:5}}),'width');undo();expect(state.active!.params.lineWidth).toBe(4);
 edit(()=>state.update({seed:99}));expect(history.canRedo).toBe(false);expect(history.redo()).toBeUndefined();
});
it('移動キャンセルで履歴を残さず、その次の操作が直前の履歴に混ざらない',()=>{
 const {state,history,edit,undo}=setup();state.add({x:350,y:250});edit(()=>state.update({seed:2}));
 edit(()=>state.update({origin:{x:500,y:250}}),'drag');edit(()=>state.update({origin:{x:350,y:250}}),'drag');
 edit(()=>state.update({origin:{x:600,y:250}}),'drag');undo();expect(state.active!.origin.x).toBe(350);expect(state.active!.seed).toBe(2);undo();expect(state.active!.seed).toBe(1);expect(history.canUndo).toBe(false);
});
it('選択・無変更は履歴を増やさず、Redoも消さない',()=>{
 const {state,history,edit,undo}=setup();state.add({x:200,y:150});state.add({x:600,y:350});
 edit(()=>state.select(1));expect(history.canUndo).toBe(false);edit(()=>state.regenerate());undo();expect(history.canRedo).toBe(true);edit(()=>state.select(2));expect(history.canRedo).toBe(true);
});
it('上限で古い履歴を破棄し、設定スナップショットに生成幾何を保持しない',()=>{
 const {state,history,edit,undo}=setup(2);state.add({x:350,y:250});
 for(let seed=2;seed<=4;seed++)edit(()=>state.update({seed}));undo();undo();expect(state.active!.seed).toBe(2);expect(history.canUndo).toBe(false);
 const snapshot=state.snapshot();expect(snapshot.impacts[0]).not.toHaveProperty('pattern');expect(snapshot.impacts[0]).not.toHaveProperty('fracture');snapshot.impacts[0].params.lineWidth=9;expect(state.active!.params.lineWidth).toBe(1);
 expect(()=>new EditorHistory(0)).toThrow();
});

it('キャンセルしたドラッグの前にあったやり直しを保持する',()=>{
 const {state,history,edit,undo,redo}=setup();state.add({x:350,y:250});edit(()=>state.update({seed:2}));undo();
 edit(()=>state.update({origin:{x:500,y:250}}),'drag');edit(()=>state.update({origin:{x:350,y:250}}),'drag');
 expect(history.canRedo).toBe(true);expect(history.canUndo).toBe(false);redo();expect(state.active!.seed).toBe(2);
});

it('履歴上限に達した後のドラッグキャンセルでも古い操作を失わない',()=>{
 const {state,history,edit,undo}=setup(1);state.add({x:350,y:250});edit(()=>state.update({seed:2}));
 edit(()=>state.update({origin:{x:500,y:250}}),'drag');edit(()=>state.update({origin:{x:350,y:250}}),'drag');undo();expect(state.active!.seed).toBe(1);expect(history.canUndo).toBe(false);
});
