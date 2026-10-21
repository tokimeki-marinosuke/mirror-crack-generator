// Requires externally available Playwright; see docs/GLASS_MATERIAL_FOUNDATION.md.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GLASS_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/glass-material.html');
 const wait=async()=>{await page.waitForFunction(()=>['passed','failed'].includes(document.querySelector('#summary').dataset.status),{},{timeout:60000});assert.equal(await page.locator('#summary').getAttribute('data-status'),'passed',await page.locator('#summary').textContent());};await wait();
 const data=()=>page.locator('#summary').evaluate(e=>({...e.dataset}));const pixels=()=>page.evaluate(()=>['baseline','material'].map(id=>document.getElementById(id).toDataURL()));
 const original=await data();assert.ok(Number(original.strips)>0);assert.ok(Number(original.shards)>0);
 await page.locator('#enabled').check();await wait();
 for(const [id,value]of [['light','90'],['thickness','100']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('input');await wait();const d=await data();assert.equal(d.builds,original.builds);const [a,b]=await pixels();assert.equal(a,b);}
 assert.equal((await data()).requested,'true');
 await page.screenshot({path:path.resolve('docs/glass-material-foundation.png'),fullPage:true});
 let cases=0;
 for(const sample of ['light','dark','transparent'])for(const count of ['1','2'])for(const density of ['0','100'])for(const width of ['0','60']){
  for(const [id,value]of [['sample',sample],['count',count],['density',density],['width',width]]){await page.locator('#'+id).selectOption(value);await wait();}
  const d=await data();assert.equal(d.differences,'0');assert.equal(d.pngsEqual,'true');cases++;
 }
 await page.locator('#motion').uncheck();await wait();
 await page.locator('#seed').fill('123');await page.locator('#seed').dispatchEvent('change');await wait();
 assert.deepEqual(errors,[]);console.log(`Glass foundation: ${cases} image/count/protection/width cases + motion off/seed, direct RGBA and both PNG comparisons passed; light/thickness reuse geometry; no visual effects applied.`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
