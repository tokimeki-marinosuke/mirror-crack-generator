import {extractShardRegions,type ShardExtraction} from '../src/core/shardRegions';
import {createShardTransformPlan} from '../src/core/shardTransforms';
import {renderShardImage} from '../src/render/renderShardImage';
import {renderCracks} from '../src/render/renderCracks';
import {createShardScenario,INSPECTOR_SIZE as size,SCENARIOS,type ScenarioId,type ShardScenario} from './shardScenarios';
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const image=new Image();image.src=new URL('../docs/samples/light.png',import.meta.url).href;
const summary=get('summary');let scene:ShardScenario,result:ShardExtraction,extractions=0;
for(const [id,label]of Object.entries(SCENARIOS))get<HTMLSelectElement>('scenario').add(new Option(label,id));
function cracks(ctx:CanvasRenderingContext2D):void {
 if(!scene)return;
 if(scene.patterns.length)for(const p of scene.patterns)renderCracks(ctx,p,size,{preset:'realistic',lineWidth:1.5,opacity:100,highlight:40});
 else{ctx.save();ctx.strokeStyle='#17232f';ctx.lineWidth=1.5;ctx.beginPath();for(const s of scene.segments){ctx.moveTo(s.start.x,s.start.y);ctx.lineTo(s.end.x,s.end.y);}ctx.stroke();ctx.restore();}
}
function draw():void {
 const displacement=get<HTMLInputElement>('displacement').valueAsNumber,rotation=get<HTMLInputElement>('rotation').valueAsNumber;
 get<HTMLOutputElement>('displacement-value').value=`${displacement}%`;get<HTMLOutputElement>('rotation-value').value=`${rotation}%`;
 const plan=result.ok?createShardTransformPlan(result.graph,size,get<HTMLInputElement>('seed').valueAsNumber,{displacement,rotation},scene.protectedCores):undefined;
 for(const id of ['baseline','motion']){const ctx=get<HTMLCanvasElement>(id).getContext('2d')!;ctx.clearRect(0,0,size.width,size.height);renderShardImage(ctx,image,size,id==='motion'&&result.ok?result.graph:undefined,id==='motion'?plan:undefined);cracks(ctx);}
 const protectedCount=plan?.motions.filter(m=>m.reason==='protected').length??0,budget=plan?.motions.filter(m=>m.reason==='budget').length??0;
 Object.assign(summary.dataset,{status:result.ok?'ready':'failed',extractions:String(extractions),fingerprint:result.ok?result.graph.regions.map(r=>r.id).join(','):'',protected:String(protectedCount),budget:String(budget),active:String(plan?.motions.filter(m=>m.reason==='active').length??0)});
 summary.textContent=result.ok?`${result.graph.regions.length}領域 / 変形対象${summary.dataset.active} / 保護${protectedCount} / 小片据え置き${budget} / 抽出${extractions}回`:`${result.reason}: ${result.message} 元画像＋亀裂へ戻しました。`;
}
function rebuild():void {
 const id=get<HTMLSelectElement>('scenario').value as ScenarioId,seed=get<HTMLInputElement>('seed').valueAsNumber,density=get<HTMLInputElement>('density').valueAsNumber;
 get<HTMLOutputElement>('density-value').value=id==='single'||id==='multiple'?`${density}%`:'固定ケース';
 get<HTMLInputElement>('density').disabled=id!=='single'&&id!=='multiple';
 if(!Number.isSafeInteger(seed))result={ok:false,reason:'invalid-input',message:'シードは安全な整数にしてください。'};
 else{scene=createShardScenario(id,seed,density);result=extractShardRegions(size,scene.segments,scene.limits);extractions++;}draw();
}
let frame=0;
for(const id of ['displacement','rotation'])get(id).addEventListener('input',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});
for(const id of ['scenario','seed','density'])get(id).addEventListener('change',()=>{cancelAnimationFrame(frame);rebuild();});
get('zero').addEventListener('click',()=>{cancelAnimationFrame(frame);get<HTMLInputElement>('displacement').value='0';get<HTMLInputElement>('rotation').value='0';draw();});
try{await image.decode();rebuild();}catch(error){summary.dataset.status='failed';summary.textContent=String(error);}
