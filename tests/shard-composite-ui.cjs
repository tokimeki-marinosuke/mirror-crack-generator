const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EDITOR_URL||'http://127.0.0.1:5173/mirror-crack-generator/');
 await page.locator('#image-file').setInputFiles(path.resolve('docs/samples/light.png'));await page.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);
 const canvas=page.locator('canvas'),rect=await canvas.boundingBox();await canvas.click({position:{x:rect.width*.5,y:rect.height*.5}});await page.locator('#preset').selectOption('web');
 await page.locator('#shard-reset').click();
 const screenshot=()=>canvas.evaluate(c=>c.toDataURL());const basePreview=await screenshot();
 const save=async(mode)=>{const promise=page.waitForEvent('download');await page.locator('#export-'+mode).click();const d=await promise;assert.equal(await d.failure(),null);const file=await fs.readFile(await d.path());return page.evaluate(async(url)=>{const b=await createImageBitmap(await(await fetch(url)).blob());const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);b.close();const data=ctx.getImageData(0,0,c.width,c.height).data;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');return {width:c.width,height:c.height,hash};},'data:image/png;base64,'+file.toString('base64'));};
 const composite=await save('composite'),cracks=await save('cracks');
 for(const key of ['displacement','rotation','reflection','gap']){
  await page.locator('#shard-'+key).fill('100');await page.locator('#shard-'+key).dispatchEvent('input');await page.waitForTimeout(100);
  assert.equal(await page.locator('#shard-status').getAttribute('data-status'),'active');assert.notEqual(await screenshot(),basePreview,key);
  await page.locator('#shard-reset').click();assert.equal(await screenshot(),basePreview,'reset '+key);
 }
 await page.locator('#shard-demo').click();assert.notEqual(await screenshot(),basePreview);
 const changed=await save('composite');assert.equal(changed.width,800);assert.equal(changed.height,500);assert.notEqual(changed.hash,composite.hash);
 assert.deepEqual(await save('cracks'),cracks);
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(50);
 await page.screenshot({path:path.resolve('docs/shard-composite-ui.png'),fullPage:true});
 await page.locator('#shard-reset').click();assert.equal(await screenshot(),basePreview);assert.deepEqual(await save('composite'),composite);
 await page.locator('#shard-demo').click();await canvas.click({position:{x:rect.width*.75,y:rect.height*.7}});await page.locator('#impact-list').selectOption('1');assert.equal(await page.locator('#shard-reflection').getAttribute('data-effective'),'50');
 await page.locator('#preset').selectOption('delicate');assert.equal(await page.locator('#shard-reflection').getAttribute('data-effective'),'50');assert.match(await page.locator('#shard-status').textContent(),/保護/);
 // Pending slider input must be flushed before PNG creation, without waiting for RAF.
 const prior=await save('composite');const pending=page.waitForEvent('download');await page.evaluate(()=>{const s=document.querySelector('#shard-reflection');s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#export-composite').click();});const download=await pending;assert.equal(await download.failure(),null);assert.equal(await page.locator('#shard-reflection-value').textContent(),'200%');assert.ok(prior.hash);
 await page.locator('#image-file').setInputFiles(path.resolve('docs/samples/dark.png'));await page.waitForFunction(()=>document.querySelector('.metadata').textContent.includes('dark.png'));assert.equal(await page.locator('#shard-reflection').inputValue(),'50');assert.equal(await page.locator('#shard-demo').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('Shard composite UI: four controls, zero reset, both PNGs, global settings, protection, pending export and new-image reset passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
