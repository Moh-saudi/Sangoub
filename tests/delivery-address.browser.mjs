import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const base='http://127.0.0.1:3130';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','3130','--strictPort'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:353,height:745},serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let osmRequests=0;
 await page.route('**/api/osm/**',async route=>{
  osmRequests++;assert.equal(route.request().headers().authorization,undefined);
  await route.fulfill({contentType:'application/json',body:JSON.stringify({results:[{place_id:'guest-place',lat:'30.025',lon:'31.725',display_name:'شارع النخيل، زهرة العاصمة',address:{road:'شارع النخيل',suburb:'زهرة العاصمة'}}]})});
 });
 await page.route('**/api/app-content**',route=>route.fulfill({contentType:'application/json',body:'{"slides":[],"config":{}}'}));
 await page.goto(base);await page.getByRole('button',{name:'تغيير موقع التوصيل'}).waitFor();
 assert.equal(await page.getByRole('dialog',{name:'عنوان التوصيل'}).count(),0,'No intrusive modal on initial visit');
 await page.getByRole('button',{name:'تغيير موقع التوصيل'}).click();
 const dialog=page.getByRole('dialog',{name:'عنوان التوصيل'});await dialog.waitFor();
 const address=page.getByLabel('الشارع والمنطقة أو أقرب علامة مميزة');
 const confirm=page.getByRole('button',{name:'تأكيد وحفظ عنوان التوصيل'});
 await address.fill('موقع محدد على الخريطة');assert.equal(await confirm.isDisabled(),true);
 await address.fill('شارع النخيل، زهرة العاصمة، زهرة العاصمة');
 await page.getByPlaceholder('رقم المبنى / الدور / رقم الشقة أو المكتب (اختياري)...').fill('مبنى ٥، الدور ٣');
 await confirm.click();await dialog.waitFor({state:'hidden'});
 assert.equal(osmRequests,0,'Typing an address immediately avoids unnecessary lookups');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sangoub_selected_area')));
 assert.equal(saved.name,'شارع النخيل، زهرة العاصمة (مبنى ٥، الدور ٣)');
 assert.equal(saved.latitude,undefined,'Manual entry does not invent map coordinates');
 await page.reload();await page.getByRole('button',{name:'تغيير موقع التوصيل'}).waitFor();
 assert.equal(await dialog.count(),0);
 await page.getByRole('button',{name:'تغيير موقع التوصيل'}).click();await dialog.waitFor();
 assert.equal(await address.inputValue(),saved.name);
 await confirm.click();await dialog.waitFor({state:'hidden'});
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('sangoub_selected_area')))).name,saved.name,'Re-saving does not duplicate building details');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // A fresh guest can resolve the initial point, search, and save without signing in.
 await page.evaluate(()=>{localStorage.removeItem('sangoub_selected_area');});
 await page.reload();await page.getByRole('button',{name:'تغيير موقع التوصيل'}).click();
 await page.waitForFunction(()=>document.querySelector('input[aria-label="الشارع والمنطقة أو أقرب علامة مميزة"]')?.value==='شارع النخيل، زهرة العاصمة');
 await page.getByPlaceholder('ابحث عن اسم الشارع، الحي، أو المدينة...').fill('شارع النخيل');
 await page.getByRole('button',{name:'شارع النخيل، زهرة العاصمة',exact:true}).click();
 await confirm.click();await dialog.waitFor({state:'hidden'});
 const guestPlace=await page.evaluate(()=>JSON.parse(localStorage.getItem('sangoub_selected_area')));
 assert.equal(guestPlace.latitude,30.025);assert.equal(guestPlace.longitude,31.725);
 assert.equal(guestPlace.name,'شارع النخيل، زهرة العاصمة');assert(osmRequests>=2);
 const staged=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sangoub_pending_delivery_address')));
 assert.equal(staged.name,guestPlace.name);assert.equal(staged.latitude,guestPlace.latitude);
 assert.equal(await page.getByText('سجّل الدخول للبحث',{exact:false}).count(),0);
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('Mobile: public guest reverse geocoding and search; no automatic popup; guest address entry, placeholder rejection, persistence, reload, no invented coordinates, no duplicate details and no overflow passed.');
} finally { await browser?.close();server.kill('SIGTERM'); }
