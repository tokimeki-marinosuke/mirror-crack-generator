// Requires externally available Playwright; see docs/SHARD_MOTION.md.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.MOTION_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/shard-motion.html');await page.waitForFunction(()=>document.querySelector('#summary').dataset.status==='ready');
const data=()=>page.locator('#summary').evaluate(e=>({...e.dataset}));const images=()=>page.evaluate(()=>['baseline','motion'].map(id=>document.getElementById(id).toDataURL()));
let [a,b]=await images();assert.notEqual(a,b);const before=await data();
await page.locator('#zero').click();[a,b]=await images();assert.equal(a,b);assert.equal((await data()).extractions,before.extractions);assert.equal((await data()).fingerprint,before.fingerprint);
const slide=async(id,n)=>{await page.locator('#'+id).fill(String(n));await page.locator('#'+id).dispatchEvent('input');await page.waitForTimeout(80);};
await slide('displacement',100);[a,b]=await images();assert.notEqual(a,b);assert.equal((await data()).fingerprint,before.fingerprint);
await slide('rotation',100);const changed=(await images())[1];await slide('rotation',0);await slide('rotation',100);assert.equal((await images())[1],changed);
await page.locator('#scenario').selectOption('grid');assert.equal((await data()).active,'256');assert.equal((await data()).budget,'33');
for(const id of ['limit','precision']){await page.locator('#scenario').selectOption(id);assert.equal((await data()).status,'failed');[a,b]=await images();assert.equal(a,b);}
await page.locator('#scenario').selectOption('holes');assert.equal((await data()).protected,'1');
await page.screenshot({path:path.resolve('docs/shard-motion-comparison.png'),fullPage:true});
const checks=await page.evaluate(async()=>{
 const {extractShardRegions}=await import('/mirror-crack-generator/src/core/shardRegions.ts');
 const {createShardTransformPlan}=await import('/mirror-crack-generator/src/core/shardTransforms.ts');
 const {renderShardImage}=await import('/mirror-crack-generator/src/render/renderShardImage.ts');
 const size={width:200,height:100};const result=extractShardRegions(size,[{id:'cut',start:{x:100,y:0},end:{x:100,y:100}}]);if(!result.ok)throw Error(result.message);
 const source=document.createElement('canvas');source.width=200;source.height=100;const s=source.getContext('2d');
 s.fillStyle='rgba(100,150,200,.5)';s.fillRect(0,0,200,100);s.fillStyle='rgba(255,0,0,.8)';s.fillRect(120,20,12,60);
 const render=(plan,graph=result.graph)=>{const c=document.createElement('canvas');c.width=200;c.height=100;const ctx=c.getContext('2d');renderShardImage(ctx,source,size,graph,plan);return ctx.getImageData(0,0,200,100).data;};
 const sourceBefore=s.getImageData(0,0,200,100).data.slice();
 const original=render(),zero=render(createShardTransformPlan(result.graph,size,42,{displacement:0,rotation:0}));
 const protectedPlan=createShardTransformPlan(result.graph,size,42,{displacement:100,rotation:100},[{kind:'circle',origin:{x:50,y:50},radius:10}]);
 const moved=render(protectedPlan);let protectedEqual=true,alphaCorrect=true,diff=false;
 for(let y=2;y<98;y++)for(let x=2;x<198;x++){const i=(y*200+x)*4;if(x<98)for(let k=0;k<4;k++)if(original[i+k]!==moved[i+k])protectedEqual=false;if(x>105&&x<115&&y>10&&y<90&&moved[i+3]!==original[i+3])alphaCorrect=false;if(original[i]!==moved[i])diff=true;}
 const ctx=document.createElement('canvas').getContext('2d');ctx.globalAlpha=.3;ctx.translate(4,5);const alpha=ctx.globalAlpha;renderShardImage(ctx,source,size);const stateRestored=ctx.globalAlpha===alpha&&ctx.getTransform().e===4;
 // A protected inner piece must remain intact through holes in the surrounding piece.
 const lines=[{id:'a',start:{x:60,y:20},end:{x:140,y:20}},{id:'b',start:{x:140,y:20},end:{x:140,y:80}},{id:'c',start:{x:140,y:80},end:{x:60,y:80}},{id:'d',start:{x:60,y:80},end:{x:60,y:20}}];
 const hole=extractShardRegions(size,lines);if(!hole.ok)throw Error(hole.message);
 const hp=createShardTransformPlan(hole.graph,size,42,{displacement:100,rotation:100},[{kind:'circle',origin:{x:100,y:50},radius:5}]);
 const hd=render(hp,hole.graph);let holeProtected=true;
 for(let y=22;y<78;y++)for(let x=62;x<138;x++)for(let k=0;k<4;k++){const i=(y*200+x)*4+k;if(hd[i]!==original[i])holeProtected=false;}
 const sourceAfter=s.getImageData(0,0,200,100).data;const sourceUnchanged=sourceBefore.every((v,i)=>v===sourceAfter[i]);
 s.fillStyle='#ff8b20';s.fillRect(0,0,200,100);
 const diagonal=extractShardRegions(size,[{id:'diag',start:{x:0,y:0},end:{x:200,y:100}}]);if(!diagonal.ok)throw Error(diagonal.message);
 const opaque=render(createShardTransformPlan(diagonal.graph,size,42,{displacement:100,rotation:100}),diagonal.graph);
 const noArtificialAlpha=opaque.every((v,i)=>i%4!==3||v===255);
 return {zeroEqual:original.every((v,i)=>v===zero[i]),protectedEqual,alphaCorrect,diff,stateRestored,holeProtected,sourceUnchanged,noArtificialAlpha};
});
for(const [name,passed]of Object.entries(checks))assert.equal(passed,true,name);
assert.deepEqual(errors,[]);console.log('Shard motion: zero pixels, seeded continuity, stable geometry/cache, whole-piece/hole protection, 256 limit, transparent alpha, Canvas state and failure fallback passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
