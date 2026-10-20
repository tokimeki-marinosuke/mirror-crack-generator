import { extractShardRegions, type ShardExtraction, type ShardRegion } from '../src/core/shardRegions';
import { renderCracks } from '../src/render/renderCracks';
import { createShardScenario, INSPECTOR_SIZE as size, overlapsProtectedCore, regionContains, SCENARIOS, type ScenarioId, type ShardScenario } from './shardScenarios';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = get<HTMLCanvasElement>('source'), canvas = get<HTMLCanvasElement>('regions-canvas');
const summary = get('summary'), scenarioControl = get<HTMLSelectElement>('scenario');
for (const [id, label] of Object.entries(SCENARIOS)) scenarioControl.add(new Option(label,id));
const image = new Image(); image.src = new URL('../docs/samples/light.png',import.meta.url).href;
let scene: ShardScenario | undefined, result: ShardExtraction | undefined;
let selected: string | null = null, extractions = 0;
const paths = new Map<string,Path2D>(), protectedIds = new Set<string>();
const color = (id: string) => {
  let h=0; for(const char of id) h=(Math.imul(h,31)+char.charCodeAt(0))>>>0;
  return `hsl(${h%360} 45% ${55+(h>>>8)%20}%)`;
};
function pathFor(region: ShardRegion): Path2D {
  const path=new Path2D();
  for(const ring of [region.outer,...region.holes]) { path.moveTo(ring[0].x,ring[0].y); for(const p of ring.slice(1)) path.lineTo(p.x,p.y); path.closePath(); }
  return path;
}
function details(): void {
  const region=result?.ok ? result.graph.regions.find(r=>r.id===selected) : undefined;
  get('details').textContent=region ? `${region.id}\n面積: ${region.area.toFixed(3)} px² / ${(region.area/(size.width*size.height)*100).toFixed(3)}%\n穴: ${region.holes.length} / 境界辺: ${region.boundaryEdgeIds.length}\n中心保護: ${protectedIds.has(region.id) ? '対象：この破片全体を将来の変形から除外' : '対象外'}\n画像の変形は未実装です。` : '破片をクリックするか、一覧から選択してください。';
  for(const button of get('regions').querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed',String(button.dataset.id===selected));
}
function draw(): void {
  const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,size.width,size.height);
  if (!result?.ok) { ctx.drawImage(source,0,0);details();return; }
  const protection=get<HTMLInputElement>('show-protection').checked;
  for(const region of result.graph.regions) {
    const path=paths.get(region.id)!;
    ctx.fillStyle=color(region.id);ctx.fill(path,'evenodd');
    if(protection && protectedIds.has(region.id)) {
      ctx.save();ctx.clip(path,'evenodd');ctx.drawImage(image,0,0,size.width,size.height);
      ctx.strokeStyle='#157b69';ctx.globalAlpha=0.55;ctx.lineWidth=1;
      ctx.beginPath();for(let x=-size.height;x<size.width;x+=14) { ctx.moveTo(x,0);ctx.lineTo(x+size.height,size.height); }ctx.stroke();ctx.restore();
    }
  }
  const vertices=new Map(result.graph.vertices.map(v=>[v.id,v.point]));
  for(const kind of ['image-boundary','shard-boundary','decoration'] as const) {
    if(kind==='shard-boundary'&&!get<HTMLInputElement>('show-boundaries').checked || kind==='decoration'&&!get<HTMLInputElement>('show-decorations').checked) continue;
    ctx.strokeStyle=kind==='decoration'?'#1858d8':kind==='shard-boundary'?'#8c3900':'#4b5563';ctx.lineWidth=kind==='shard-boundary'?1.8:1.2;
    ctx.setLineDash(kind==='decoration'?[4,3]:[]);ctx.beginPath();
    for(const edge of result.graph.edges.filter(e=>e.kind===kind)) { const a=vertices.get(edge.startVertexId)!,b=vertices.get(edge.endVertexId)!;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y); }ctx.stroke();
  }
  ctx.setLineDash([]);
  if(protection) for(const core of scene?.protectedCores??[]) {
    ctx.strokeStyle='#064e40';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(core.origin.x,core.origin.y,core.radius,0,Math.PI*2);ctx.stroke();
  }
  ctx.setLineDash([]);
  if(selected&&paths.has(selected)) { ctx.strokeStyle='#ffffff';ctx.lineWidth=4;ctx.stroke(paths.get(selected)!); }
  details();
}
function showSource(): void {
  const ctx=source.getContext('2d')!;ctx.clearRect(0,0,size.width,size.height);ctx.drawImage(image,0,0,size.width,size.height);
  if(!scene) return;
  if(scene.patterns.length) for(const pattern of scene.patterns) renderCracks(ctx,pattern,size,{preset:'realistic',lineWidth:1.5,opacity:100,highlight:40});
  else {
    ctx.save();ctx.beginPath();ctx.rect(0,0,size.width,size.height);ctx.clip();ctx.strokeStyle='#17232f';ctx.lineWidth=1.5;ctx.beginPath();
    for(const line of scene.segments) { ctx.moveTo(line.start.x,line.start.y);ctx.lineTo(line.end.x,line.end.y); }ctx.stroke();ctx.restore();
  }
}
function rebuild(): void {
  cancelAnimationFrame(frame);frame=0;
  selected=null;paths.clear();protectedIds.clear();get('regions').replaceChildren();
  const seed=get<HTMLInputElement>('seed').valueAsNumber, density=get<HTMLInputElement>('density').valueAsNumber;
  get<HTMLOutputElement>('density-value').value=`${density}%`;
  const generated=scenarioControl.value==='single'||scenarioControl.value==='multiple';
  get<HTMLOutputElement>('density-value').value=generated?`${density}%`:'固定ケース';
  get<HTMLInputElement>('density').disabled=!generated;get<HTMLInputElement>('seed').disabled=!generated;get<HTMLButtonElement>('regenerate').disabled=!generated;
  const start=performance.now();
  if(!Number.isSafeInteger(seed)) result={ok:false,reason:'invalid-input',message:'シードは安全な整数で指定してください。'};
  else { scene=createShardScenario(scenarioControl.value as ScenarioId,seed,density);result=extractShardRegions(size,scene.segments,scene.limits);extractions++; }
  const elapsed=performance.now()-start;showSource();
  summary.dataset.extractions=String(extractions);
  summary.dataset.regions='0';summary.dataset.protected='0';summary.dataset.boundaries='0';summary.dataset.decorations='0';summary.dataset.holes='0';
  summary.dataset.fingerprint='';
  if(result.ok) {
    const graph=result.graph;
    for(const region of graph.regions) { paths.set(region.id,pathFor(region));if(scene!.protectedCores.some(core=>overlapsProtectedCore(region,core))) protectedIds.add(region.id); }
    const sorted=[...graph.regions].sort((a,b)=>b.area-a.area||a.id.localeCompare(b.id));
    for(const region of sorted.slice(0,500)) {
      const button=document.createElement('button');button.type='button';button.dataset.id=region.id;button.setAttribute('aria-pressed','false');
      button.textContent=`${protectedIds.has(region.id)?'保護対象 · ':''}${region.id} · ${region.area.toFixed(1)} px² · 穴${region.holes.length}`;
      button.addEventListener('click',()=>{selected=region.id;draw();});get('regions').append(button);
    }
    const area=graph.regions.reduce((sum,r)=>sum+r.area,0), holes=graph.regions.reduce((sum,r)=>sum+r.holes.length,0);
    const boundaries=graph.edges.filter(e=>e.kind==='shard-boundary').length, decorations=graph.edges.filter(e=>e.kind==='decoration').length;
    summary.textContent=`${graph.regions.length}領域 / 穴${holes} / 破片境界${boundaries}辺 / 装飾${decorations}辺 / 保護対象${protectedIds.size}領域 / 面積 ${area.toFixed(3)} / ${size.width*size.height} px² / 抽出${elapsed.toFixed(1)}ms${sorted.length>500?' / 一覧は上位500件、Canvasでは全領域を選択可能':''}`;
    Object.assign(summary.dataset,{status:'ready',regions:String(graph.regions.length),protected:String(protectedIds.size),boundaries:String(boundaries),decorations:String(decorations),holes:String(holes),fingerprint:graph.regions.map(r=>r.id).join(',')});
  } else { summary.dataset.status='failed';summary.textContent=`${result.reason}: ${result.message} 元画像＋亀裂の表示へ戻しました。`; }
  draw();
}
canvas.addEventListener('click',event=>{
  if(!result?.ok)return;
  const rect=canvas.getBoundingClientRect(),p={x:(event.clientX-rect.left)*size.width/rect.width,y:(event.clientY-rect.top)*size.height/rect.height};
  selected=result.graph.regions.find(r=>regionContains(r,p))?.id??null;draw();
});
scenarioControl.addEventListener('change',rebuild);get('seed').addEventListener('change',rebuild);
let frame=0;
get('density').addEventListener('input',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;rebuild();});});
get('regenerate').addEventListener('click',()=>{get<HTMLInputElement>('seed').value=String(((get<HTMLInputElement>('seed').valueAsNumber>>>0)+1)>>>0);rebuild();});
for(const id of ['show-boundaries','show-decorations','show-protection']) get(id).addEventListener('change',draw);
try { await image.decode();rebuild(); } catch(error) {summary.dataset.status='failed';summary.textContent=`検証ページを表示できません: ${String(error)}`;}
