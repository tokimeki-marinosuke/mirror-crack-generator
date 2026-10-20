// Run with an externally available Playwright installation; see docs/FRACTURE_CONTROLS.md.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.EDITOR_URL || 'http://127.0.0.1:5173/mirror-crack-generator/');
await page.locator('#image-file').setInputFiles(require('node:path').resolve('docs/samples/light.png'));
await page.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);
const canvas=page.locator('canvas');const rect=await canvas.boundingBox();await canvas.click({position:{x:rect.width*.5,y:rect.height*.5}});
await page.locator('#preset').selectOption('shattered');
assert.equal(await page.locator('#surface-widthPercent').inputValue(),'65');
const shot=()=>canvas.evaluate(c=>c.toDataURL());const wide=await shot();
const slide=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('input');await page.waitForTimeout(60)};
await slide('surface-widthPercent',0);assert.notEqual(await shot(),wide);
await slide('surface-widthPercent',65);assert.equal(await shot(),wide);
await slide('centerDensity',0);await slide('lengthPercent',30);await slide('impact-strength',100);
assert.equal(await page.locator('#lengthPercent').inputValue(),'30');assert.equal(await page.locator('#centerDensity').inputValue(),'0');assert.equal(await page.locator('#surface-widthPercent').inputValue(),'65');
await canvas.click({position:{x:rect.width*.8,y:rect.height*.65}});assert.equal(await page.locator('#impact-strength').inputValue(),'50');
await page.locator('#impact-list').selectOption('1');assert.equal(await page.locator('#impact-strength').inputValue(),'100');assert.equal(await page.locator('#lengthPercent').inputValue(),'30');
await page.evaluate(()=>{
 const slider=document.querySelector('#surface-chipDensity');slider.value='9';slider.dispatchEvent(new Event('input',{bubbles:true}));
 const list=document.querySelector('#impact-list');list.value='2';list.dispatchEvent(new Event('change',{bubbles:true}));
});
assert.equal(await page.locator('#surface-chipDensity').inputValue(),'0');
await page.locator('#impact-list').selectOption('1');assert.equal(await page.locator('#surface-chipDensity').inputValue(),'9');
await page.locator('#preset').selectOption('delicate');assert.equal(await page.locator('#centerDensity').inputValue(),'0');
await page.locator('#preset').selectOption('web');assert.equal(await page.locator('#concentricDensity').inputValue(),'85');
await page.locator('#preset').selectOption('shattered');
await page.screenshot({path:require('node:path').resolve('docs/fracture-stage4-ui.png'),fullPage:true});
for(const mode of ['composite','cracks']){const result=page.waitForEvent('download');await page.locator('#export-'+mode).click();const download=await result;assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/\.png$/);}
await page.locator('#preset').selectOption('realistic');assert.equal(await page.locator('#surface-widthPercent').inputValue(),'0');
assert.deepEqual(errors,[]);console.log('Stage 4 UI: 5 presets, surface visibility, independent widths, override precedence, center protection settings, per-impact state, both PNG downloads passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
