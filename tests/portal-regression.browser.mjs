import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const base='http://127.0.0.1:3116';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','3116','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/app-content**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({slides:[],config:{},stores:[],products:[]})}));
 const paths=['/','/stores','/stores/regression-store','/cart','/checkout','/checkout/success','/my-orders','/admin','/kitchen','/merchant','/merchant/login','/courier'];
 for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
  await page.setViewportSize(viewport);
  for(const path of paths){
   await page.goto(base+path);await page.locator('#root > *').first().waitFor();
   if(path==='/courier'){
    await page.getByRole('heading',{name:'دخول مندوب سنجوب',exact:true}).waitFor();
    const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json()));
    assert.equal(manifest.start_url,'/courier');assert.equal(manifest.id,'/courier');
    assert.equal(await page.getByLabel('البريد الإلكتروني',{exact:true}).count(),1);
   }
   if(path==='/admin'||path==='/kitchen')await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).waitFor();
   if(path==='/merchant')await page.locator('#merchant-email').waitFor();
   await page.evaluate(()=>document.fonts.ready);
   if(['/','/admin','/merchant','/courier'].includes(path))await page.screenshot({path:`/tmp/sangoub-${path==='/'?'home':path.slice(1)}-${viewport.width}.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} overflows at ${viewport.width}`);
   assert.equal(await page.getByText('SERVER_MODULE_LOAD_FAILED',{exact:false}).count(),0);
  }
 }
 const defaultManifest=await (await fetch(base+'/manifest.webmanifest')).json();
 assert.equal(defaultManifest.start_url,'/','Customer installation retains its own start URL');
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('12 routes at mobile and laptop widths passed; admin/merchant/courier sign-in, scoped courier manifest and unchanged customer manifest passed. Authenticated workflows require emulator tests.');
}finally{await browser?.close();server.kill('SIGTERM')}
