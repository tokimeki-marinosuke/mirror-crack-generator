// Current selected-impact UI and expanded effect ranges. Requires external Playwright.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EDITOR_URL||'http://127.0.0.1:5173/mirror-crack-generator/');await page.locator('#image-file').setInputFiles(require('node:path').resolve('docs/samples/light.png'));await page.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);
 const canvas=page.locator('canvas'),rect=await canvas.boundingBox();await canvas.click({position:{x:rect.width*.5,y:rect.height*.5}});
 const slide=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('input');await page.waitForFunction(([id,value])=>parseFloat(document.querySelector('#'+id+'-value').textContent)===value,[id,value]);};
 assert.equal(await page.locator('#radialCount').getAttribute('max'),'35');assert.equal(await page.locator('#lengthPercent').getAttribute('max'),'225');assert.equal(await page.locator('#lineWidth').getAttribute('max'),'9');
 for(const id of ['realistic','anime','delicate','web','shattered'])await page.locator('#preset').selectOption(id);
 await slide('centerDensity',0);await slide('lengthPercent',30);await slide('impact-strength',100);assert.equal(await page.locator('#lengthPercent').inputValue(),'30');assert.equal(await page.locator('#centerDensity').inputValue(),'0');
 await slide('complexity',65);await slide('concentricDensity',65);const before=await canvas.evaluate(c=>c.toDataURL());await slide('complexity',100);await slide('concentricDensity',100);assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),before);
 await slide('radialCount',35);await slide('lengthPercent',225);await slide('lineWidth',9);await slide('centerRadius',80);await slide('opacity',100);await slide('surface-darkness',100);
 await canvas.click({position:{x:rect.width*.8,y:rect.height*.65}});assert.equal(await page.locator('#impact-strength').inputValue(),'50');await page.locator('#impact-list').selectOption('1');assert.equal(await page.locator('#impact-strength').inputValue(),'100');assert.equal(await page.locator('#lineWidth').inputValue(),'9');assert.equal(await page.locator('#centerDensity').inputValue(),'0');
 for(const id of ['shard-displacement','shard-rotation','shard-reflection','shard-gap'])await slide(id,65);
 for(const mode of ['composite','cracks']){const promise=page.waitForEvent('download');await page.locator('#export-'+mode).click();assert.equal(await(await promise).failure(),null);}
 await page.screenshot({path:require('node:path').resolve('docs/expanded-effect-controls.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Expanded UI: numeric ranges, all presets, 65/100 strengths, override precedence, protection endpoints, per-impact state, shard controls and both PNGs passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
