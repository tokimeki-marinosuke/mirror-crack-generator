import {expect,it} from 'vitest';
import {controlPosition,controlValue,MATERIAL_SCALES,SHARD_SCALES,POINT_SCALES,DARKNESS_SCALE} from './controlScale';
import {createApplicationEditor,APPLICATION_IMPACT_DEFAULTS,APPLICATION_SHARD_DEFAULTS} from './applicationDefaults';
import {EditorState} from './editorState';
const size={width:800,height:500};
it('全ての非ゼロ初期値が中央50で厳密一致し、上側に余地がある',()=>{
 for(const s of [...Object.values(MATERIAL_SCALES),...Object.values(SHARD_SCALES),...Object.values(POINT_SCALES),DARKNESS_SCALE]){
  if(s.baseline===s.min){expect(controlPosition(s.baseline,s)).toBe(0);expect(controlValue(0,s)).toBe(s.baseline);}
  else {expect(controlValue(50,s)).toBe(s.baseline);expect(controlPosition(s.baseline,s)).toBe(50);expect(controlValue(100,s)).toBeGreaterThan(s.baseline);}
 }
});
it('連続する順逆変換で、0の保護と不透明度100の意味を維持する',()=>{
 for(const s of [...Object.values(MATERIAL_SCALES),...Object.values(POINT_SCALES)].filter(s=>!s.integer))for(const p of [0,20,49.9,50,50.1,80,100])expect(controlPosition(controlValue(p,s),s)).toBeCloseTo(p,10);
 expect(controlValue(0,POINT_SCALES.centerDensity)).toBe(0);expect(controlValue(100,POINT_SCALES.opacity)).toBe(100);
 expect(controlValue(50,POINT_SCALES.opacity)).toBe(85);expect(controlValue(50,POINT_SCALES.radialCount)).toBe(29);
 for(const p of [-1,101,NaN,Infinity])expect(()=>controlValue(p,MATERIAL_SCALES.thickness)).toThrow();
});
it('中央への再設定で初期の亀裂形状や材質・映りの実効値は変わらない',()=>{
 const state=createApplicationEditor(size);state.add({x:320,y:225});const before=state.active!.pattern;
 for(const key of Object.keys(POINT_SCALES) as (keyof typeof POINT_SCALES)[])state.update({params:{[key]:controlValue(50,POINT_SCALES[key])}});
 expect(state.active!.pattern).toBe(before);expect(state.active!.params).toEqual(APPLICATION_IMPACT_DEFAULTS);
 state.shards.update(Object.fromEntries(Object.entries(SHARD_SCALES).map(([key,s])=>[key,controlValue(s.baseline?50:0,s)])));
 expect(state.shards.settings).toEqual(APPLICATION_SHARD_DEFAULTS);
});
it('アプリの映りと材質だけ拡張値を許可し、互換APIの上限は維持する',()=>{
 const app=createApplicationEditor(size);app.add({x:320,y:225});const pattern=app.active!.pattern;
 app.shards.update({displacement:200,rotation:200,reflection:200});expect(app.shards.resolve(app.impacts)?.plan).toBeDefined();
 app.glass.update({thickness:130,edgeReflection:136,reflectionWidth:130,interiorReflection:120});expect(app.glass.prepare(app.impacts).geometry.ok).toBe(true);expect(app.active!.pattern).toBe(pattern);
 const legacy=new EditorState(size);expect(()=>legacy.shards.update({displacement:200})).toThrow();expect(()=>legacy.glass.update({thickness:130})).toThrow();
});
