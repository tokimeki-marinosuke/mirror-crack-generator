const{chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.EDITOR_URL||'http://127.0.0.1:5173/mirror-crack-generator/');await p.evaluate(()=>localStorage.clear());await p.reload();
 await p.locator('#image-file').setInputFiles(path.resolve('docs/samples/light.png'));await p.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);const c=p.locator('canvas'),r=await c.boundingBox();await c.click({position:{x:r.width*.45,y:r.height*.5}});
 for(const group of ['material','shard','point'])assert.equal(await p.locator('#'+group+'-advanced').evaluate(e=>e.open),false);
 for(const id of ['material-preset','shard-preset','preset'])assert.equal(await p.locator('#'+id).isVisible(),true);
 assert.ok((await p.locator('#export-composite').boundingBox()).y<(await p.locator('[data-mode=add]').boundingBox()).y);
 const coords=await p.locator('.coordinates').textContent();const pixels=()=>c.evaluate(c=>c.toDataURL());const initial=await pixels();
 for(const group of ['material','shard','point']){await p.locator('#'+group+'-name').fill('My '+group);await p.locator('#'+group+'-save').click();assert.match(await p.locator('#'+group+'-save-status').textContent(),/保存しました/);}
 await p.locator('#material-preset').selectOption('real');await p.locator('#shard-preset').selectOption('none');await p.locator('#preset').selectOption('anime');assert.notEqual(await pixels(),initial);
 for(const group of ['material','shard','point'])await p.locator('#'+group+'-saved').selectOption({label:'My '+group});assert.equal(await pixels(),initial);assert.equal(await p.locator('.coordinates').textContent(),coords);
 await p.reload();for(const group of ['material','shard','point'])assert.equal(await p.locator('#'+group+'-saved option').count(),2);
 await p.locator('#image-file').setInputFiles(path.resolve('docs/samples/light.png'));await p.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);await c.click({position:{x:r.width*.45,y:r.height*.5}});
 await p.locator('#point-advanced summary').click();await p.locator('#seed').fill('42');await p.locator('#seed').dispatchEvent('change');await p.locator('#preset').selectOption('anime');await p.locator('#point-saved').selectOption({label:'My point'});assert.equal(await p.locator('#seed').inputValue(),'42');assert.equal(await p.locator('#radialCount').inputValue(),'50');
 await p.locator('#point-name').fill('My point');await p.locator('#point-save').click();assert.equal(await p.locator('#point-saved option').count(),2);await p.locator('#point-saved').selectOption('');await p.locator('#point-saved').selectOption({label:'My point'});await p.locator('#point-delete').click();assert.equal(await p.locator('#point-saved option').count(),1);
 for(const mode of ['composite','cracks']){const waiting=p.waitForEvent('download');await p.locator('#export-'+mode).click();assert.equal(await(await waiting).failure(),null);}
 await p.locator('#point-advanced summary').click();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'docs/preset-library.png',fullPage:true});
 // Storage denial leaves the in-memory library untouched and reports failure.
 await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('denied')};});await p.locator('#material-name').fill('blocked');await p.locator('#material-save').click();assert.match(await p.locator('#material-save-status').textContent(),/保存できません/);assert.equal(await p.locator('#material-saved option').count(),2);
 assert.deepEqual(errors,[]);console.log('Preset library: visible presets, separate closed advanced controls, output order, save/apply/reload/overwrite/delete, exact preview restoration, retained seed/position, both PNGs and storage denial passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
