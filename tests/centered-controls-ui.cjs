const{chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs/promises');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.EDITOR_URL||'http://127.0.0.1:5173/mirror-crack-generator/');await p.locator('#image-file').setInputFiles(path.resolve('docs/samples/light.png'));await p.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);const c=p.locator('canvas'),r=await c.boundingBox();await c.click({position:{x:r.width*.45,y:r.height*.45}});
 const pixels=()=>c.evaluate(c=>c.toDataURL()),initial=await pixels();
 const set=async(id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('input');await p.evaluate(()=>new Promise(requestAnimationFrame));await p.evaluate(()=>new Promise(requestAnimationFrame));};
 const actual=id=>p.locator('#'+id).getAttribute('data-effective');
 for(const [id,base]of [['material-thickness',65],['material-edgeReflection',68],['material-reflectionWidth',65],['material-interiorReflection',60],['material-microDetail',22],['shard-displacement',100],['shard-rotation',100],['shard-reflection',100],['radialCount',29],['lengthPercent',192],['complexity',74/.65],['concentricDensity',97/.65],['centerRadius',7],['centerDensity',4],['lineWidth',1],['opacity',85],['surface-darkness',60]]){
  assert.equal(await p.locator('#'+id).inputValue(),'50',id);assert.ok(Math.abs(Number(await actual(id))-base)<1e-8,id);
 }
 assert.equal(await p.locator('#shard-gap').inputValue(),'0');assert.equal(await p.locator('#material-lightDirection').inputValue(),'225');
 await p.screenshot({path:path.resolve('docs/centered-controls.png'),fullPage:true});
 await p.locator('#radialCount').focus();await p.keyboard.press('ArrowRight');assert.equal(await actual('radialCount'),'30');await p.keyboard.press('ArrowLeft');assert.equal(await actual('radialCount'),'29');assert.equal(await pixels(),initial);
 for(const id of ['material-thickness','material-reflectionWidth','material-edgeReflection','material-interiorReflection','material-microDetail','shard-displacement','shard-rotation','shard-reflection','lineWidth']){
  const before=Number(await actual(id));await set(id,100);assert.ok(Number(await actual(id))>before,id);assert.notEqual(await pixels(),initial,id);await set(id,50);assert.equal(await pixels(),initial,'exact reset '+id);
 }
 for(const id of ['real','dramatic','cinematic'])await p.locator('#material-preset').selectOption(id);assert.equal(await pixels(),initial);
 await p.locator('#material-enabled').uncheck();const disabled=await pixels();assert.notEqual(disabled,initial);await p.locator('#material-enabled').check();assert.equal(await pixels(),initial);
 for(const key of ['complexity','concentricDensity','radialCount','lengthPercent']){const before=Number(await actual(key));await set(key,100);assert.ok(Number(await actual(key))>before);await set(key,50);assert.equal(await pixels(),initial);}
 await set('centerDensity',0);assert.equal(await actual('centerDensity'),'0');await set('centerDensity',50);await set('opacity',100);assert.equal(await actual('opacity'),'100');await set('opacity',50);assert.equal(await pixels(),initial);
 for(const mode of ['composite','cracks']){const wait=p.waitForEvent('download');await p.locator('#export-'+mode).click();const d=await wait;assert.equal(await d.failure(),null);assert.ok((await fs.readFile(await d.path())).length>0);}
 // Pending input is committed before saving, even before its scheduled animation frame.
 const waiting=p.waitForEvent('download');await p.evaluate(()=>{const s=document.getElementById('material-edgeReflection');s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('export-composite').click();});assert.equal(await(await waiting).failure(),null);assert.equal(await actual('material-edgeReflection'),'136');
 await c.click({position:{x:r.width*.75,y:r.height*.7}});assert.equal(await p.locator('#radialCount').inputValue(),'50');assert.equal(await actual('material-edgeReflection'),'136');
 assert.deepEqual(errors,[]);console.log('Centered controls: exact initial values, stronger upper range, pixel-exact resets, presets, protection/alpha endpoints, both PNGs, pending input and shared material passed.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
