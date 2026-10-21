// Requires externally available Playwright; see docs/GLASS_MATERIAL_FOUNDATION.md.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GLASS_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/glass-material.html');
 const wait=async()=>{await page.waitForFunction(()=>['passed','failed'].includes(document.querySelector('#summary').dataset.status),{},{timeout:60000});assert.equal(await page.locator('#summary').getAttribute('data-status'),'passed',await page.locator('#summary').textContent());};await wait();
 const data=()=>page.locator('#summary').evaluate(e=>({...e.dataset}));const pixels=()=>page.evaluate(()=>['baseline','material'].map(id=>document.getElementById(id).toDataURL()));
 const original=await data();assert.ok(Number(original.strips)>0);assert.ok(Number(original.shards)>0);
 await page.locator('#enabled').check();await wait();
 const set=async(id,value)=>{await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('input');await wait();};
 await set('light','90');assert.equal((await data()).differences,'0');
 await set('thickness','100');assert.ok(Number((await data()).differences)>0);assert.equal((await data()).builds,original.builds);
 await set('reflection','70');const lit=await pixels();await set('light','270');assert.notEqual((await pixels())[1],lit[1]);assert.equal((await data()).builds,original.builds);
 await set('interior','60');await set('detail','60');assert.equal((await data()).builds,original.builds);assert.ok(Number((await data()).interiors)>0);assert.ok(Number((await data()).details)>0);
 await page.screenshot({path:path.resolve('docs/glass-material-stage3.png'),fullPage:true});
 await page.locator('#enabled').uncheck();await wait();
 let cases=0;
 for(const sample of (process.env.GLASS_QUICK ? [] : ['light','dark','transparent']))for(const count of ['1','2'])for(const density of ['0','100'])for(const width of ['0','60']){
  for(const [id,value]of [['sample',sample],['count',count],['density',density],['width',width]]){await page.locator('#'+id).selectOption(value);await wait();}
  const d=await data();assert.equal(d.differences,'0');assert.equal(d.pngsEqual,'true');
  await page.locator('#enabled').check();await wait();assert.ok(Number((await data()).differences)>0);
  if(density==='0') assert.equal(await page.evaluate(()=>{const a=document.getElementById('baseline'),b=document.getElementById('material'),x=a.width*.4,y=a.height*.45;const da=a.getContext('2d').getImageData(0,0,a.width,a.height).data,db=b.getContext('2d').getImageData(0,0,b.width,b.height).data;let n=0;for(let yy=0;yy<a.height;yy++)for(let xx=0;xx<a.width;xx++)if(Math.hypot(xx-x,yy-y)<5){const i=(yy*a.width+xx)*4;for(let k=0;k<4;k++)if(da[i+k]!==db[i+k])n++;}return n;}),0);
  await page.locator('#enabled').uncheck();await wait();cases++;
 }
 await page.locator('#motion').uncheck();await wait();
 await page.locator('#seed').fill('123');await page.locator('#seed').dispatchEvent('change');await wait();
 const invariants=await page.evaluate(async()=>{
  const {EditorState}=await import('/mirror-crack-generator/src/state/editorState.ts');
  const {GlassMaterialState}=await import('/mirror-crack-generator/src/state/glassMaterialState.ts');
  const {renderGlassScene}=await import('/mirror-crack-generator/src/render/renderGlassScene.ts');
  const size={width:320,height:240},state=new EditorState(size);state.add({x:160,y:120});state.update({seed:42,params:{centerDensity:0,centerRadius:40}});
  const material=new GlassMaterialState(size);material.update({enabled:true,thickness:100,edgeReflection:100});
  const frame=material.prepare(state.impacts),image=document.createElement('canvas');image.width=320;image.height=240;
  const draw=(f)=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.globalAlpha=.73;ctx.lineWidth=7;const status=renderGlassScene(ctx,image,state.impacts,size,'cracks',undefined,f);return {c,status,restored:ctx.globalAlpha===.73&&ctx.lineWidth===7};};
  const active=draw(frame),again=draw(frame),off=draw(undefined);
  const pixels=active.c.getContext('2d').getImageData(0,0,320,240).data;
  const radius=frame.geometry.geometry.protections[0].protectedCore.radius;let protectedPixels=0;
  for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(Math.hypot(x+.5-160,y+.5-120)<radius-1&&pixels[(y*320+x)*4+3])protectedPixels++;
  const disabled=draw({...frame,settings:{...frame.settings,enabled:false}});
  const zero=draw({...frame,settings:{...frame.settings,thickness:0,edgeReflection:0}});
  const unavailableInterior=draw({...frame,settings:{...frame.settings,thickness:0,edgeReflection:0,interiorReflection:50,microDetail:0}});
  const failed=draw({...frame,geometry:{ok:false,reason:'limit-exceeded',message:'test'}});
  return {protectedPixels,restored:active.restored,repeat:active.c.toDataURL()===again.c.toDataURL(),fallback:[disabled,zero,unavailableInterior,failed].every(v=>v.c.toDataURL()===off.c.toDataURL()&&!v.status.effectsApplied),active:active.status.effectsApplied};
 });
 assert.deepEqual(invariants,{protectedPixels:0,restored:true,repeat:true,fallback:true,active:true});
 const textureChecks=await page.evaluate(async()=>{const {verifyGlassTexture}=await import('/mirror-crack-generator/tests/glass-texture.browser.ts');return verifyGlassTexture();});console.log(`Native glass texture: ${textureChecks.length} checks passed.`);
 assert.deepEqual(errors,[]);console.log(`Glass material stage 3: ${cases} image/count/protection/width cases + motion off/seed, direct RGBA and both PNG comparisons passed; light/thickness reuse geometry; directional effects, disabled legacy equivalence and protected center passed.`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
