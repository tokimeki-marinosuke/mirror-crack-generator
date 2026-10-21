import { EditorState } from '../src/state/editorState';
import { GlassMaterialState } from '../src/state/glassMaterialState';
import { renderGlassScene } from '../src/render/renderGlassScene';
import { renderGlassScene as renderOld } from './fixtures/renderGlassScene.v1';
import { exportPng } from '../src/image/exportPng';
export async function verifyCrispRendering() {
  const passed: string[] = [], check = (value:boolean, text:string) => { if(!value)throw new Error(text); passed.push(text); };
  const makeCanvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  let cases=0;
  for(const sample of ['light','dark','transparent'])for(const count of [1,2])for(const density of [0,100]){
    const image=new Image();image.src=new URL(`../docs/samples/${sample}.png`,import.meta.url).href;await image.decode();
    const size={width:image.naturalWidth,height:image.naturalHeight},editor=new EditorState(size);
    for(let i=0;i<count;i++){editor.add({x:size.width*(i?.8:.35),y:size.height*(i?.8:.4)});editor.update({seed:42,params:{centerDensity:density,lineWidth:6}});editor.updateSurface({widthPercent:100,chipDensity:100});}
    editor.shards.update({displacement:30,rotation:25,reflection:20,gap:10});const composition=editor.shards.resolve(editor.impacts);
    editor.glass.update({thickness:100,edgeReflection:100,reflectionWidth:100,interiorReflection:100,microDetail:100});
    const frame=editor.glass.prepare(editor.impacts,composition),without=editor.impacts.map(i=>({...i,fracture:undefined,surface:{...i.surface!,widthPercent:0,chipDensity:0}}));
    for(const mode of ['composite','cracks'] as const){
      const c=makeCanvas(size.width,size.height),clean=makeCanvas(size.width,size.height);renderGlassScene(c.getContext('2d')!,image,editor.impacts,size,mode,composition,frame);renderGlassScene(clean.getContext('2d')!,image,without,size,mode,composition,frame);
      check(c.toDataURL()===clean.toDataURL(),`${sample}/${count}/${density}/${mode}: legacy surfaces ignored`);
      const bitmap=await createImageBitmap(await exportPng(image,editor.impacts,mode,composition,frame));
      check(bitmap.width===size.width&&bitmap.height===size.height,`${sample}/${count}/${density}/${mode}: source dimensions`);
      const png=makeCanvas(size.width,size.height);png.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();
      check(c.toDataURL()===png.toDataURL(),`${sample}/${count}/${density}/${mode}: real PNG matches shared renderer`);
      if(mode==='cracks'&&count===1&&density===0&&frame.geometry.ok){const core=frame.geometry.geometry.protections[0].protectedCore!,data=c.getContext('2d')!.getImageData(0,0,size.width,size.height).data;let leaks=0;for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++)if(Math.hypot(x+.5-core.origin.x,y+.5-core.origin.y)<core.radius-1&&data[(y*size.width+x)*4+3])leaks++;check(leaks===0,`${sample}: maximum widths respect protected core`);}
      c.width=clean.width=png.width=0;
    }
    editor.glass.reset();const disabled=editor.glass.prepare(editor.impacts,composition);
    for(const failure of [false,true]){
      const frame=failure?{...disabled,geometry:{ok:false as const,reason:'limit-exceeded' as const,message:'test'}}:disabled;
      const c=makeCanvas(size.width,size.height),clean=makeCanvas(size.width,size.height);
      renderGlassScene(c.getContext('2d')!,image,editor.impacts,size,'cracks',composition,frame);renderGlassScene(clean.getContext('2d')!,image,without,size,'cracks',composition,frame);
      check(c.toDataURL()===clean.toDataURL(),`${sample}/${count}/${density}: disabled/fallback cannot restore legacy triangles`);c.width=clean.width=0;
    }
    cases++;
  }
  const image=new Image();image.src=new URL('../docs/samples/light.png',import.meta.url).href;await image.decode();
  const size={width:800,height:500},editor=new EditorState(size);editor.add({x:320,y:225});editor.update({seed:42});
  const legacyDefault=new GlassMaterialState(size);legacyDefault.update({enabled:true,thickness:32,edgeReflection:60,interiorReflection:25,microDetail:15});
  const metric=(legacy:boolean)=>{const c=makeCanvas(800,500);(legacy?renderOld:renderGlassScene)(c.getContext('2d')!,image,editor.impacts,size,'cracks',undefined,legacy?legacyDefault.prepare(editor.impacts):editor.glass.prepare(editor.impacts));const data=c.getContext('2d')!.getImageData(0,0,800,500).data;let dark=0,covered=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>32){covered++;if(data[i]<80&&data[i+1]<80&&data[i+2]<80)dark++;}c.width=0;return{dark,coveredFraction:covered/(800*500)};};
  const presence={oldDefault:metric(true),newCinematic:metric(false)};
  check(presence.newCinematic.dark>presence.oldDefault.dark,'new default has more visible dark core');
  check(presence.newCinematic.coveredFraction<.1,'new default crack coverage remains below ten percent on reference scene');
  editor.glass.update({thickness:0,interiorReflection:0,microDetail:0,edgeReflection:100});
  const whiteCount=(width:number)=>{editor.glass.update({reflectionWidth:width});const c=makeCanvas(800,500);renderGlassScene(c.getContext('2d')!,image,editor.impacts,size,'cracks',undefined,editor.glass.prepare(editor.impacts));const d=c.getContext('2d')!.getImageData(0,0,800,500).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]>180&&d[i+2]>180&&d[i+3]>16)n++;c.width=0;return n;};
  check(whiteCount(0)===0&&whiteCount(100)>0,'reflection width zero suppresses white strokes while black core stays');
  editor.glass.applyPreset('cinematic');
  const old=new GlassMaterialState(size);old.update({enabled:true,thickness:100,edgeReflection:100,interiorReflection:100,microDetail:100});
  const before=old.prepare(editor.impacts),after=editor.glass.prepare(editor.impacts),canvas=makeCanvas(800,500),ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  const measure=(legacy:boolean)=>{const start=performance.now();for(let i=0;i<5;i++){ctx.clearRect(0,0,800,500);(legacy?renderOld:renderGlassScene)(ctx,image,editor.impacts,size,'composite',undefined,legacy?before:after);ctx.getImageData(0,0,1,1);}return performance.now()-start;};
  measure(true);measure(false);const oldTimes:number[]=[],newTimes:number[]=[];
  for(let i=0;i<5;i++){if(i%2){newTimes.push(measure(false));oldTimes.push(measure(true));}else{oldTimes.push(measure(true));newTimes.push(measure(false));}}
  const median=(v:number[])=>[...v].sort((a,b)=>a-b)[2];canvas.width=0;
  return{cases,checks:passed.length,presence,renderBatchMedianMs:{oldMax:median(oldTimes),newCinematic:median(newTimes),frames:5},notes:'Single Chromium run; includes drawing/readback, excludes partition and PNG compression.'};
}
