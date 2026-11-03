const{chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.EDITOR_URL||'http://127.0.0.1:5173/mirror-crack-generator/');
 assert.equal(await p.locator('#shard-demo').count(),0);assert.equal(await p.getByRole('button',{name:'映りの変化を試す'}).count(),0);await p.keyboard.press('Delete');assert.equal(await p.locator('#undo').isDisabled(),true);
 await p.locator('#image-file').setInputFiles(path.resolve('docs/samples/light.png'));await p.waitForFunction(()=>!document.querySelector('[data-mode=add]').disabled);
 const c=p.locator('canvas'),r=await c.boundingBox(),pixels=()=>c.evaluate(e=>e.toDataURL());
 await c.click({position:{x:r.width*.35,y:r.height*.45}});await c.click({position:{x:r.width*.7,y:r.height*.6}});const original=await pixels();assert.equal(await c.evaluate(e=>document.activeElement===e),true);
 await p.keyboard.press('Delete');assert.equal(await p.locator('#impact-list [data-impact-id]').count(),1);assert.equal(await p.locator('#impact-list').evaluate(e=>e.querySelector('[aria-selected="true"]')?.dataset.impactId??''),'1');await p.locator('#undo').click();assert.equal(await pixels(),original);assert.equal(await p.locator('#impact-list').evaluate(e=>e.querySelector('[aria-selected="true"]')?.dataset.impactId??''),'2');await p.locator('#redo').click();assert.equal(await p.locator('#impact-list [data-impact-id]').count(),1);await p.locator('#undo').click();
 // Typing, native selection and modifier keys must not remove an impact.
 await p.locator('#point-advanced summary').click();
 for(const id of ['point-name','seed','preset','radialCount']){await p.locator('#'+id).focus();await p.keyboard.press('Delete');assert.equal(await p.locator('#impact-list [data-impact-id]').count(),2,id);}
 await c.focus();for(const chord of ['Control+Delete','Meta+Delete','Shift+Delete','Alt+Delete','Backspace']){await p.keyboard.press(chord);assert.equal(await p.locator('#impact-list [data-impact-id]').count(),2,chord);}
 // Holding Delete removes one point, not all of them.
 await p.keyboard.down('Delete');await p.keyboard.down('Delete');await p.keyboard.down('Delete');await p.keyboard.up('Delete');assert.equal(await p.locator('#impact-list [data-impact-id]').count(),1);
 await p.keyboard.press('Delete');assert.equal(await p.locator('#impact-list').evaluate(e=>e.querySelector('[aria-selected="true"]')?.dataset.impactId??''),'');assert.equal(await p.locator('#delete-impact').isDisabled(),true);await p.keyboard.press('Delete');await p.locator('#undo').click();assert.equal(await p.locator('#impact-list').evaluate(e=>e.querySelector('[aria-selected="true"]')?.dataset.impactId??''),'1');await p.locator('#undo').click();assert.equal(await pixels(),original);
 // Existing on-screen deletion still shares the same undoable operation.
 await p.locator('#delete-impact').click();await p.locator('#undo').click();assert.equal(await pixels(),original);assert.deepEqual(errors,[]);
 console.log('Delete key: selected point only, empty state, repeat/modifier/input guards, canvas focus, button parity, exact Undo/Redo restoration and no public demo control passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
