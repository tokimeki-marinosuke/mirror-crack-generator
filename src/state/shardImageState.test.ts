import {expect,it} from 'vitest';
import {EditorState,PRESETS,type Impact} from './editorState';
import {ShardImageState} from './shardImageState';
const size={width:200,height:100};
function impact():Impact{return {id:1,origin:{x:100,y:50},seed:42,preset:'realistic',params:{...PRESETS.realistic},pattern:{origin:{x:100,y:50},seed:42,segments:[{start:{x:100,y:0},end:{x:100,y:100},type:'radial'}]}};}
it('初期値0では抽出せず、全設定0へ戻すと従来表示へ戻る',()=>{
 const state=new ShardImageState(size),i=impact();expect(state.resolve([i])).toBeUndefined();expect(state.extractions).toBe(0);
 state.update({displacement:70});expect(state.resolve([i])!.plan).toBeDefined();
 state.update({displacement:0});expect(state.resolve([i])).toBeUndefined();
});
it('4つのスライダーと線幅・反射・不透明度の通常変更では分割を再利用する',()=>{
 const state=new ShardImageState(size),i=impact();state.update({displacement:70});const first=state.resolve([i])!;
 for(const key of ['displacement','rotation','reflection','gap'] as const){state.update({[key]:50});expect(state.resolve([i])!.extraction).toBe(first.extraction);}
 const styled={...i,params:{...i.params,lineWidth:6,highlight:100,opacity:30}};
 expect(state.resolve([styled])!.extraction).toBe(first.extraction);expect(state.extractions).toBe(1);
 expect(state.resolve([styled])).toBe(state.resolve([styled]));
});
it('形状・衝撃点の追加／削除・表示の有無では再抽出し、各点を名前空間で統合',()=>{
 const state=new ShardImageState(size),i=impact();state.update({rotation:50});state.resolve([i]);
 const second={...i,id:2,pattern:{...i.pattern,segments:[{...i.pattern.segments[0],start:{x:0,y:50},end:{x:200,y:50}}]}};
 const two=state.resolve([i,second])!;expect(two.extraction.ok&&two.extraction.graph.regions.length).toBe(4);
 state.resolve([second]);state.resolve([{...second,params:{...second.params,opacity:0}}]);expect(state.extractions).toBe(4);
});
it('閉領域のない行き止まりは全画面の画像を変形しない',()=>{
 const state=new ShardImageState(size),i=impact();i.pattern.segments[0].end={x:100,y:80};i.pattern.segments[0].start={x:100,y:20};
 state.update({displacement:100,reflection:100,gap:100});expect(state.resolve([i])!.plan).toBeUndefined();
});
it('抽出失敗もキャッシュして元画像へ復帰する情報を返す',()=>{
 const state=new ShardImageState(size,{edges:1});state.update({displacement:50});const i=impact(),first=state.resolve([i])!;
 expect(first.extraction).toMatchObject({ok:false,reason:'limit-exceeded'});expect(first.plan).toBeUndefined();
 state.update({rotation:70});expect(state.resolve([i])!.extraction).toBe(first.extraction);expect(state.extractions).toBe(1);
});
it('弱い中心亀裂を分割に使わず、既存の線分は変更しない',()=>{
 const state=new ShardImageState(size),i=impact();i.pattern.segments[0].strength=.2;const before=structuredClone(i);
 state.update({displacement:50});expect(state.resolve([i])!.plan).toBeUndefined();expect(i).toEqual(before);
});
it('不正な映り設定は状態を変えず拒否し、新しい画像では0に初期化',()=>{
 const editor=new EditorState(size);const settings=editor.shards.settings;
 for(const value of [NaN,Infinity,-1,101])expect(()=>editor.shards.update({reflection:value})).toThrow();
 expect(editor.shards.settings).toBe(settings);editor.shards.update({gap:40});expect(new EditorState(size).shards.settings.gap).toBe(0);
});
it('入力予算超過で部分分割を使わず、正常な形状へ戻せば復帰できる',()=>{
 const state=new ShardImageState(size,{inputSegments:1}),i=impact();
 const two={...i,pattern:{...i.pattern,segments:[...i.pattern.segments,{...i.pattern.segments[0],start:{x:0,y:50},end:{x:200,y:50}}]}};
 state.update({displacement:50});const failed=state.resolve([two])!;expect(failed.extraction).toMatchObject({ok:false,reason:'limit-exceeded'});expect(failed.plan).toBeUndefined();
 expect(state.resolve([i])!.plan).toBeDefined();expect(state.extractions).toBe(2);
});
