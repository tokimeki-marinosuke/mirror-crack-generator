const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GLASS_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/glass-material.html');
 await page.waitForFunction(()=>document.querySelector('#summary').dataset.status==='passed');
 const result=await page.evaluate(async()=>{const {verifyGlassQuality}=await import('/mirror-crack-generator/tests/glass-quality.browser.ts');return await verifyGlassQuality();});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
 await fs.writeFile('docs/glass-quality-results.json',JSON.stringify({browser:await browser.version(),...result},null,2)+'\n');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
