const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1700,height:1250},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.CRISP_URL||'http://127.0.0.1:5173/mirror-crack-generator/tests/crisp-mirror.html');await p.waitForFunction(()=>document.querySelector('#summary').dataset.status==='passed');
 const data=()=>p.evaluate(()=>Object.fromEntries(['old-default','old-max','new-default','new-max'].map(id=>[id,document.getElementById(id).toDataURL()])));
 const initial=await data();assert.notEqual(initial['old-default'],initial['new-default']);assert.notEqual(initial['old-max'],initial['new-max']);
 await p.screenshot({path:'docs/crisp-mirror-comparison.png',fullPage:true});
 const result=await p.evaluate(async()=>{const {verifyCrispRendering}=await import('/mirror-crack-generator/tests/crisp-rendering.browser.ts');return await verifyCrispRendering();});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));await fs.writeFile('docs/crisp-mirror-results.json',JSON.stringify(result,null,2)+'\n');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
