// Requires an externally available Playwright installation; see docs/SHARD_INSPECTOR.md.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SHARDS_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/shards.html');
 const status=()=>page.locator('#summary').getAttribute('data-status');
 const data=()=>page.locator('#summary').evaluate(e=>({...e.dataset}));
 await page.waitForFunction(()=>document.querySelector('#summary').dataset.status==='ready');
 assert.ok(Number((await data()).protected)>0);
 const sourcePixels=()=>page.locator('#source').evaluate(c=>c.toDataURL());
 const regionPixels=()=>page.locator('#regions-canvas').evaluate(c=>c.toDataURL());
 let current=await data();const original=await regionPixels();
 for(const id of ['show-boundaries','show-decorations','show-protection']){
  await page.locator('#'+id).uncheck();assert.notEqual(await regionPixels(),original);
  assert.equal((await data()).extractions,current.extractions);assert.equal((await data()).fingerprint,current.fingerprint);
  await page.locator('#'+id).check();assert.equal(await regionPixels(),original);
 }
 await page.locator('#scenario').selectOption('multiple');assert.equal(await status(),'ready');assert.ok(Number((await data()).protected)>0);
 await page.locator('#density').fill('100');await page.locator('#density').dispatchEvent('input');await page.waitForFunction(()=>document.querySelector('#density-value').value==='100%');assert.equal((await data()).protected,'0');
 await page.locator('#scenario').selectOption('holes');assert.equal(await status(),'ready');assert.equal((await data()).regions,'3');assert.equal((await data()).holes,'2');assert.equal((await data()).protected,'1');assert.equal((await data()).decorations,'2');
 current=await data();
 const canvas=page.locator('#regions-canvas'),rect=await canvas.boundingBox();
 await canvas.click({position:{x:rect.width*.5,y:rect.height*.5}});assert.match(await page.locator('#details').textContent(),/穴: 0/);assert.match(await page.locator('#details').textContent(),/この破片全体/);assert.equal((await data()).extractions,current.extractions);
 await page.locator('#regions button').first().click();assert.match(await page.locator('#details').textContent(),/穴: 1/);assert.match(await page.locator('#details').textContent(),/対象外/);
 await page.screenshot({path:path.resolve('docs/shard-inspector-holes.png'),fullPage:true});
 await page.locator('#scenario').selectOption('junctions');assert.equal(await status(),'ready');assert.ok(Number((await data()).decorations)>0);
 await page.locator('#scenario').selectOption('grid');assert.equal((await data()).regions,'289');assert.equal(await page.locator('#regions button').count(),289);
 for(const scenario of ['limit','precision']){
  await page.locator('#scenario').selectOption(scenario);assert.equal(await status(),'failed');assert.equal((await data()).regions,'0');assert.equal(await page.locator('#regions button').count(),0);assert.equal(await regionPixels(),await sourcePixels());
 }
 await page.screenshot({path:path.resolve('docs/shard-inspector-fallback.png'),fullPage:true});
 await page.locator('#scenario').selectOption('single');await page.locator('#density').fill('0');await page.locator('#density').dispatchEvent('input');await page.waitForFunction(()=>document.querySelector('#density-value').value==='0%');assert.equal(await status(),'ready');
 current=await data();await page.locator('#regenerate').click();assert.notEqual((await data()).fingerprint,current.fingerprint);
 await page.locator('#seed').fill('42');await page.locator('#seed').dispatchEvent('change');
 await page.screenshot({path:path.resolve('docs/shard-inspector-generated.png'),fullPage:true});
 await page.setViewportSize({width:600,height:900});assert.ok(await canvas.isVisible());await canvas.click({position:{x:150,y:120}});assert.match(await page.locator('#details').textContent(),/shard:/);
 assert.deepEqual(errors,[]);console.log('Shard inspector: 7 scenarios, holes, selection, protection, 289 regions, cached overlays, failure pixel fallback/recovery, seed and narrow viewport passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
