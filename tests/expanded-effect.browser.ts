import { createApplicationEditor, APPLICATION_IMPACT_DEFAULTS, APPLICATION_SHARD_DEFAULTS } from '../src/state/applicationDefaults';
import { EditorState } from '../src/state/editorState';
import { ShardImageState } from '../src/state/shardImageState';
import { exportPng } from '../src/image/exportPng';
export async function verifyExpandedEffects(){
 const image=new Image();image.src=new URL('../docs/samples/light.png',import.meta.url).href;await image.decode();
 const size={width:image.naturalWidth,height:image.naturalHeight},state=new EditorState(size);state.add({x:360,y:220});state.applyPreset('web');state.update({seed:42});
 const old=new ShardImageState(size);old.update({displacement:100,rotation:100,reflection:100,gap:100});
 state.shards.update({displacement:65,rotation:65,reflection:65,gap:65});const baseline=state.shards.resolve(state.impacts)!,reference=old.resolve(state.impacts)!;
 const check=(v:boolean,m:string)=>{if(!v)throw new Error(m);};
 const pixels=async(composition:typeof baseline,mode:'composite'|'cracks')=>{
  const frame=state.glass.prepare(state.impacts,composition),b=await createImageBitmap(await exportPng(image,state.impacts,mode,composition,frame));
  check(b.width===size.width&&b.height===size.height,'source dimensions');const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d')!.drawImage(b,0,0);b.close();const data=c.toDataURL();c.width=0;return data;
 };
 const expected=await pixels(reference,'composite'),actual=await pixels(baseline,'composite');check(expected===actual,'new shard65 PNG must match legacy100 PNG');
 const cracks=await pixels(baseline,'cracks');state.shards.update({displacement:100,rotation:100,reflection:100,gap:100});const strong=state.shards.resolve(state.impacts)!;
 check(strong.extraction===baseline.extraction,'reuse partition');check(await pixels(strong,'composite')!==actual,'100 strengthens composite');check(await pixels(strong,'cracks')===cracks,'image controls leave crack PNG unchanged');
 const centered=createApplicationEditor(size),previous=new EditorState(size,APPLICATION_IMPACT_DEFAULTS);
 centered.add({x:360,y:220});previous.add({x:360,y:220});previous.shards.update(APPLICATION_SHARD_DEFAULTS);
 const appPng=async(editor:EditorState,mode:'composite'|'cracks')=>{const composition=editor.shards.resolve(editor.impacts);const bitmap=await createImageBitmap(await exportPng(image,editor.impacts,mode,composition,editor.glass.prepare(editor.impacts,composition)));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();const data=c.toDataURL();c.width=0;return data;};
 for(const mode of ['composite','cracks'] as const)check(await appPng(centered,mode)===await appPng(previous,mode),'centered baseline must match previous approved defaults: '+mode);
 const defaultImage=await appPng(centered,'composite');centered.shards.update({displacement:200,rotation:200,reflection:200});check(await appPng(centered,'composite')!==defaultImage,'upper half exceeds the previous 100% image effects');
 return 'Centered baseline: both PNGs match approved defaults exactly; new upper range exceeds previous maximum. Legacy calibration, resolution, partition and crack-only compatibility passed.';
}
