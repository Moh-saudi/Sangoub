import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Start local emulators before running this test.');
delete process.env.FIREBASE_CLIENT_EMAIL;delete process.env.FIREBASE_PRIVATE_KEY;
process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';
const {adminServices}=await import('../server/firebaseAdmin.ts');const services=adminServices();
const accounts={};
for(const role of ['admin','employee','restaurant','courier']){
 const user=await services.auth.createUser({email:`${role}@example.com`,emailVerified:true,password:'EmulatorPassword123!'});accounts[role]=user;
 if(role==='admin')await services.db.doc('admins/'+user.uid).set({enabled:true});
 if(role==='restaurant'||role==='courier')await services.db.doc('staff/'+user.uid).set({role,name:role,phone:'01012345678',...(role==='restaurant'?{storeId:'test-store'}:{})});
}
const vite=spawn(process.execPath,['--import','tsx','tests/admin-test-server.mjs'],{cwd:root,env:{...process.env,VITE_USE_FIREBASE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-capital-talabat'},stdio:'ignore'});
let browser;
async function accessible(page, label) {
 const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.fonts.ready);
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 assert.deepEqual(results.violations.map(violation=>({id:violation.id,description:violation.description,nodes:violation.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})),[],label+' accessibility');
}
try{
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3105',{signal:AbortSignal.timeout(1000)});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(() => {
  const watch = new MutationObserver(() => {
   if (document.querySelector('.mascot-support') && !window.__welcomeStart) window.__welcomeStart = performance.now();
   if (document.querySelector('dialog.is-invite[open]') && !window.__welcomeShown) window.__welcomeShown = performance.now();
  });watch.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 });
 await page.goto('http://127.0.0.1:3105/');
 const invitation=page.getByRole('dialog',{name:'فطارك وطلباتك مع سنجوب',exact:true});await invitation.waitFor({timeout:7000});assert.ok(await page.evaluate(()=>window.__welcomeShown-window.__welcomeStart)>=1900,'invitation waits two seconds after the mascot mounts');await invitation.getByRole('button',{name:'اطلب فطارك',exact:true}).waitFor();await invitation.getByRole('button',{name:'اطلب من السوبرماركت',exact:true}).waitFor();
 for(const [width,height] of [[320,568],[367,830],[667,375],[1440,1000]]){await page.setViewportSize({width,height});const box=await invitation.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'welcome invitation fits phone, landscape and desktop');}
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await invitation.locator('.sangoub-invite-character').evaluate(el=>getComputedStyle(el).animationName),'none','welcome mascot respects reduced motion');await accessible(page,'breakfast welcome invitation');await invitation.getByRole('button',{name:'هطلب بعدين',exact:true}).click();await invitation.waitFor({state:'hidden'});await page.reload();await page.waitForTimeout(2200);assert.equal(await invitation.isVisible(),false,'invitation does not repeat on reload in the same session');await page.emulateMedia({reducedMotion:'no-preference'});
 const welcomeContext=await browser.newContext({viewport:{width:367,height:830}});const welcomePage=await welcomeContext.newPage();await welcomePage.goto('http://127.0.0.1:3105/');const welcome=welcomePage.getByRole('dialog',{name:'فطارك وطلباتك مع سنجوب',exact:true});await welcome.waitFor({timeout:7000});await welcome.getByRole('button',{name:'اطلب فطارك',exact:true}).click();await welcomePage.getByRole('dialog',{name:'طلب فطار',exact:true}).waitFor();await welcomePage.getByRole('heading',{name:'تحب تطلب إيه؟',exact:true}).waitFor();assert.equal(await welcomePage.getByRole('dialog',{name:'نساعدك إزاي؟',exact:true}).count(),0,'welcome opens breakfast directly');await welcomeContext.close();
 const groceryWelcomeContext=await browser.newContext({viewport:{width:320,height:568}});const groceryWelcomePage=await groceryWelcomeContext.newPage();await groceryWelcomePage.goto('http://127.0.0.1:3105/');const groceryWelcome=groceryWelcomePage.getByRole('dialog',{name:'فطارك وطلباتك مع سنجوب',exact:true});await groceryWelcome.waitFor({timeout:7000});await groceryWelcome.getByRole('button',{name:'اطلب من السوبرماركت',exact:true}).click();const groceryDirect=groceryWelcomePage.getByRole('dialog',{name:'طلب سوبر ماركت',exact:true});await groceryDirect.waitFor();await groceryDirect.getByRole('button',{name:/^شاي وقهوة/}).click();await groceryDirect.getByRole('textbox',{name:'عدد بن أبو عوف سادة — 125 جم (ثُمن كيلو)',exact:true}).fill('1');await groceryWelcomeContext.close();

 await page.getByRole('navigation',{name:'القائمة الرئيسية'}).waitFor();
 assert.equal((await page.request.get('http://127.0.0.1:3105/admin')).headers()['cross-origin-opener-policy'],'same-origin-allow-popups');
 assert.equal(await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).count(),0);
 assert.equal(await page.getByText('iPhone 16 Pro',{exact:true}).count(),0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public overflow '+width);}
 await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'إغلاق',exact:true}).click();
 // Every hero slide fits small screens; app prompts remain dismissible without a release URL.
 for(const width of [320,360,367,390,430,768,1440]){
  await page.setViewportSize({width,height:844});
  for(let slide=1;slide<=4;slide++){
   await page.getByRole('button',{name:new RegExp('^عرض الميزة '+slide+':')}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public hero overflow '+width+' slide '+slide);
   for(const selector of ['.site-brand','.hero-copy h1','.hero-copy p','.hero-actions'])assert.equal(await page.locator(selector).evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'no clipped content '+selector+' at '+width+' slide '+slide);
  }
  if(width<=430){
   const brand=await page.locator('.site-brand').boundingBox(),app=await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).boundingBox();assert.ok(Math.abs(brand.y-app.y)<12,'mobile brand and app share a row');
   const photo=await page.locator('.showcase-images').boundingBox(),hero=await page.locator('.hero-showcase').boundingBox();assert.ok(hero.height<430,'district carousel remains compact on phones');assert.ok(Math.abs(photo.width-hero.width)<2,'district photograph uses the full card width');const proportions=await page.locator('.showcase-images img').evaluate(img=>({rendered:img.getBoundingClientRect().width/img.getBoundingClientRect().height,intrinsic:Number(img.getAttribute('width'))/Number(img.getAttribute('height'))}));assert.ok(Math.abs(proportions.rendered-proportions.intrinsic)<.01,'mobile photograph preserves the complete panorama without cropping');
   const action=await page.locator('.hero-actions button').boundingBox(),bar=await page.locator('.mobile-order-bar').boundingBox();assert.ok(action.y+action.height<bar.y,'primary action is visible above the fixed bar without scrolling');
   assert.equal(await page.locator('.showcase-controls').evaluate(el=>el.scrollWidth>el.clientWidth),false,'mobile carousel controls fit');
   for(const button of await page.locator('.showcase-arrows button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,'carousel buttons have accessible touch targets');}
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/^عرض الميزة 1:/}).click();await page.waitForFunction(()=>{const img=document.querySelector('.showcase-images img');return img?.complete&&img.naturalWidth>0;});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(tmpdir(),'capital-public-mobile.png'),fullPage:false});
 await page.getByRole('button',{name:/فطار يظبط يومك/}).click();const appPrompt=page.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true});await appPrompt.waitFor();
 await appPrompt.getByText('فطار يظبط يومك',{exact:true}).waitFor();await appPrompt.getByText('رابط التحميل الرسمي سيتاح قريبًا.',{exact:true}).waitFor();
 for(const [width,height] of [[320,568],[390,650],[667,375]]){
  await page.setViewportSize({width,height});const box=await appPrompt.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'app dialog fits small and landscape viewports');
  await appPrompt.getByRole('link',{name:'استفسر عن التطبيق',exact:true}).scrollIntoViewIfNeeded();assert.equal(await appPrompt.getByRole('link',{name:'استفسر عن التطبيق',exact:true}).isVisible(),true);
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await appPrompt.getByRole('link',{name:'افتح التطبيق',exact:true}).count(),0);
 await page.screenshot({path:join(tmpdir(),'capital-public-app-prompt.png'),fullPage:false});await page.keyboard.press('Escape');await appPrompt.waitFor({state:'hidden'});assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.setViewportSize({width:1440,height:1000});
 await accessible(page,'public homepage');
 const support=page.getByRole('button',{name:'افتح قائمة السنجاب',exact:true});assert.equal(await support.getAttribute('aria-haspopup'),'dialog');
 assert.equal(await support.locator('img').getAttribute('src'),'/brand/sangoub-logo-256x256.png');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await support.locator('.mascot-support-portrait').evaluate(el=>getComputedStyle(el).animationName),'none','mascot respects reduced motion');
 for(const width of [320,390,600,768,1440]){
  await page.setViewportSize({width,height:844});const box=await support.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height>=44,'support is a visible touch target');
  if(width<=600){const bar=await page.locator('.mobile-order-bar').boundingBox();assert.ok(box.y+box.height<bar.y,'floating mascot remains visible above the order bar');}
 }
 await page.setViewportSize({width:390,height:844});await accessible(page,'mobile mascot support');
 await support.click();const mascotMenu=page.getByRole('dialog',{name:'نساعدك إزاي؟',exact:true});await mascotMenu.waitFor();assert.equal(await support.getAttribute('aria-expanded'),'true');assert.equal(await mascotMenu.getByRole('link').count(),1);
 for(const [title,word] of [['التواصل مع الدعم','مساعدة']]){const link=mascotMenu.getByRole('link',{name:new RegExp('^'+title)});const target=new URL(await link.getAttribute('href'));assert.equal(target.origin,'https://wa.me');assert.equal(target.pathname,'/201017799580');assert.ok(target.searchParams.get('text').includes(word));assert.equal(await link.getAttribute('target'),'_blank');}
 for(const [width,height] of [[320,568],[367,830],[390,650],[667,375]]){await page.setViewportSize({width,height});const box=await mascotMenu.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'mascot choices fit phone and landscape');}
 await page.setViewportSize({width:390,height:844});await accessible(page,'mascot service chooser');await page.keyboard.press('Tab');assert.equal(await mascotMenu.evaluate(el=>el.contains(document.activeElement)),true,'keyboard focus stays in service chooser');await page.keyboard.press('Escape');await mascotMenu.waitFor({state:'hidden'});assert.equal(await support.getAttribute('aria-expanded'),'false');assert.equal(await support.evaluate(el=>el===document.activeElement),true,'closing restores focus to mascot');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await support.click();await mascotMenu.waitFor();await page.mouse.click(388,2);await mascotMenu.waitFor({state:'hidden'});
 await support.click();await mascotMenu.getByRole('button',{name:/^طلب أوردر فطار/}).click();const breakfast=page.getByRole('dialog',{name:'طلب فطار',exact:true});await breakfast.waitFor();await breakfast.getByRole('button',{name:/^ساندوتشات/}).click();
 await breakfast.getByRole('textbox',{name:'عدد ساندوتش فول',exact:true}).fill('٣');await breakfast.getByRole('textbox',{name:'عدد ساندوتش طعمية',exact:true}).fill('2');await breakfast.getByRole('textbox',{name:'عدد ساندوتش بطاطس',exact:true}).fill('1');await breakfast.getByRole('textbox',{name:'عدد ساندوتش باذنجان',exact:true}).fill('1');
 await breakfast.getByRole('button',{name:'وجبات وكشري',exact:true}).click();await breakfast.getByRole('textbox',{name:'عدد كشري صغير',exact:true}).fill('2');await breakfast.getByRole('button',{name:'ساندوتشات',exact:true}).click();assert.equal(await breakfast.getByRole('textbox',{name:'عدد ساندوتش فول',exact:true}).inputValue(),'3','category changes retain quantities');
 for(const [width,height] of [[320,568],[367,830],[667,375]]){await page.setViewportSize({width,height});const box=await breakfast.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'breakfast form fits phone and landscape');assert.equal(await breakfast.locator('.breakfast-route:not([hidden]) .breakfast-body').evaluate(el=>el.scrollWidth>el.clientWidth),false,'breakfast form has no horizontal overflow');}
 await page.setViewportSize({width:390,height:844});await accessible(page,'breakfast quantities');await breakfast.getByRole('button',{name:'متابعة الطلب',exact:true}).click();await breakfast.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();assert.equal(await breakfast.getByLabel('اسم صاحب طلب الفطار',{exact:true}).evaluate(el=>el.validity.valueMissing),true,'name is required before reviewing');
 await breakfast.getByLabel('اسم صاحب طلب الفطار',{exact:true}).fill('عميل اختبار الفطار');await breakfast.getByLabel('عنوان توصيل الفطار',{exact:true}).fill('وزارة اختبار معزولة');await breakfast.locator('.breakfast-route:not([hidden])').getByLabel(/^الدور ورقم المكتب/).fill('الدور 2 مكتب 12');await breakfast.getByRole('radio',{name:'إنستا باي',exact:true}).check();await accessible(page,'breakfast customer details');await breakfast.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();
 let orderUrl=new URL(await breakfast.getByRole('link',{name:'إرسال الطلب عبر واتساب',exact:true}).getAttribute('href'));let orderText=orderUrl.searchParams.get('text');for(const text of ['ساندوتش فول × 3','ساندوتش طعمية × 2','ساندوتش بطاطس × 1','ساندوتش باذنجان × 1','كشري صغير × 2','إجمالي الكمية: 9','الاسم: عميل اختبار الفطار','إنستا باي'])assert.ok(orderText.includes(text),text);assert.equal(orderUrl.pathname,'/201017799580');
 await accessible(page,'breakfast review');await breakfast.getByRole('button',{name:'رجوع',exact:true}).click();await breakfast.getByRole('radio',{name:'كاش عند الاستلام',exact:true}).check();await breakfast.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();orderUrl=new URL(await breakfast.getByRole('link',{name:'إرسال الطلب عبر واتساب',exact:true}).getAttribute('href'));assert.ok(orderUrl.searchParams.get('text').includes('كاش عند الاستلام'));
 await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/plain',body:'WhatsApp navigation intercepted in local browser test.'}));const [draft]=await Promise.all([context.waitForEvent('page'),breakfast.getByRole('link',{name:'إرسال الطلب عبر واتساب',exact:true}).click()]);await draft.waitForURL('https://wa.me/**');assert.ok(new URL(draft.url()).searchParams.get('text').includes('كشري صغير × 2'));await draft.close();await breakfast.waitFor({state:'hidden'});await context.unroute('https://wa.me/**');
 await support.click();await mascotMenu.getByRole('button',{name:/^طلب أوردر سوبر ماركت/}).click();
 const grocery=page.getByRole('dialog',{name:'طلب سوبر ماركت',exact:true});await grocery.waitFor();
 await grocery.getByRole('button',{name:/^احتياجات المكتب/}).click();await grocery.getByRole('textbox',{name:'عدد مناديل سحب — علبة',exact:true}).fill('٢');
 for(const [section,item,count] of [['شاي وقهوة','بن أبو عوف سادة — 125 جم (ثُمن كيلو)','1'],['بسكويت وسناكس','بسكويت أوريو — باكو','3'],['مياه ومشروبات باردة','مياه معدنية — زجاجة 600 مل','6']]){await grocery.getByRole('button',{name:section,exact:true}).click();await grocery.getByRole('textbox',{name:'عدد '+item,exact:true}).fill(count);}
 for(const [width,height] of [[320,568],[367,830],[667,375]]){await page.setViewportSize({width,height});assert.equal(await grocery.locator('.breakfast-route:not([hidden]) .breakfast-body').evaluate(el=>el.scrollWidth>el.clientWidth),false,'supermarket sections fit small screens');const box=await grocery.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);}
 await page.setViewportSize({width:390,height:844});await accessible(page,'supermarket quantities');await grocery.getByRole('button',{name:'متابعة الطلب',exact:true}).click();
 await grocery.getByLabel('اسم صاحب طلب السوبرماركت',{exact:true}).fill('عميل اختبار السوبرماركت');await grocery.getByLabel('عنوان توصيل السوبرماركت',{exact:true}).fill('وزارة اختبار معزولة');await grocery.getByRole('radio',{name:'كاش عند الاستلام',exact:true}).check();await grocery.getByRole('textbox',{name:/^ملاحظات/}).fill('أي بديل بعد التأكيد');await grocery.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();
 const groceryUrl=new URL(await grocery.getByRole('link',{name:'إرسال الطلب عبر واتساب',exact:true}).getAttribute('href'));assert.equal(groceryUrl.origin,'https://wa.me');assert.equal(groceryUrl.pathname,'/201017799580');
 for(const text of ['طلب سوبر ماركت','مناديل سحب — علبة × 2','بن أبو عوف سادة — 125 جم (ثُمن كيلو) × 1','بسكويت أوريو — باكو × 3','مياه معدنية — زجاجة 600 مل × 6','إجمالي الكمية: 12','أي بديل بعد التأكيد','كاش عند الاستلام'])assert.ok(groceryUrl.searchParams.get('text').includes(text),text);
 assert.ok(!groceryUrl.searchParams.get('text').includes('ساندوتش فول'));await accessible(page,'supermarket review');await page.screenshot({path:join(tmpdir(),'capital-supermarket-review.png')});await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).locator('.mobile-app-icon').waitFor();
 await page.getByLabel('قائمة الموقع',{exact:true}).click();await page.getByRole('navigation',{name:'القائمة الرئيسية'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.site-mobile-menu').getAttribute('open'),null,'mobile menu closes with Escape');
 assert.equal(await page.locator('.public-how>div').evaluate(el=>el.scrollWidth>el.clientWidth),false,'all ordering steps fit without sideways scrolling');
 assert.ok((await page.locator('.food-grid').boundingBox()).height<200,'discovery categories fit in one compact row');
 assert.ok((await page.locator('.service-strip').boundingBox()).height<60,'service information uses one compact strip');
 const stepBoxes=await page.locator('.public-how article').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));assert.ok(Math.max(...stepBoxes.map(b=>b.y))-Math.min(...stepBoxes.map(b=>b.y))<2,'all three steps share one row');
 const slideImages=new Set();for(let i=1;i<=4;i++){await page.getByRole('button',{name:new RegExp('^عرض الميزة '+i+':')}).click();slideImages.add(await page.locator('.showcase-images img').getAttribute('src'));}assert.equal(slideImages.size,4,'hero uses four different photographs');for(const src of slideImages)assert.match(src,/^\/images\/government-district-(gardens|ministries|skyline|night)\.jpg$/,'hero uses the updated Government District assets');
 for(const name of ['فيسبوك','إنستغرام','تيك توك'])await page.getByRole('img',{name,exact:true}).waitFor();await page.getByText('© 2026 Mesk – Vlab. All rights reserved.',{exact:true}).waitFor();
 await page.getByRole('button',{name:/^عرض الميزة 1:/}).click();await page.getByRole('button',{name:'الصورة التالية',exact:true}).click();assert.equal(await page.locator('.hero-showcase').getAttribute('data-theme'),'morning');await page.getByRole('button',{name:'الصورة السابقة',exact:true}).click();assert.equal(await page.locator('.hero-showcase').getAttribute('data-theme'),'delivery');
 const swipeTarget=page.locator('.showcase-images');await swipeTarget.dispatchEvent('pointerdown',{clientX:50,clientY:200,pointerId:1});await swipeTarget.dispatchEvent('pointerup',{clientX:130,clientY:203,pointerId:1});assert.equal(await page.locator('.hero-showcase').getAttribute('data-theme'),'morning','horizontal swipe changes slides');
 await swipeTarget.dispatchEvent('pointerdown',{clientX:100,clientY:200,pointerId:1});await swipeTarget.dispatchEvent('pointerup',{clientX:102,clientY:280,pointerId:1});assert.equal(await page.locator('.hero-showcase').getAttribute('data-theme'),'morning','vertical scrolling does not change slides');
 await page.getByLabel('قائمة الموقع',{exact:true}).click();await page.getByRole('navigation',{name:'القائمة الرئيسية'}).getByRole('link',{name:'الوظائف',exact:true}).click();await page.getByRole('heading',{name:'مكانك مع فريقنا.',exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/careers');assert.equal(await page.getByRole('link',{name:'استفسر عن فرص العمل',exact:true}).count(),3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'careers mobile overflow');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:join(tmpdir(),'capital-careers-mobile.png'),fullPage:true});await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('link',{name:'العودة للرئيسية',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('link',{name:'دخول الإدارة',exact:true}).click();await page.waitForURL('**/admin');
 assert.equal(new URL(page.url()).pathname,'/admin');
 assert.equal(await page.evaluate(async()=> (await import('/src/lib/firebase.ts')).firebaseConfig.projectId),'demo-capital-talabat');await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).waitFor();
 assert.equal(await page.getByText('تصفح كزائر',{exact:true}).count(),0);assert.equal(await page.getByText('iPhone 16 Pro',{exact:true}).count(),0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'login overflow '+width);}
 await page.screenshot({path:join(tmpdir(),'capital-admin-login.png'),fullPage:true});
 async function login(role){await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(`${role}@example.com`);await page.getByLabel('كلمة المرور',{exact:true}).fill('EmulatorPassword123!');await page.getByRole('button',{name:'دخول لوحة الإدارة',exact:true}).click();}
 for(const role of ['employee','restaurant','courier']){
  await login(role);await page.getByRole('heading',{name:'الحساب غير مخوّل للإدارة',exact:true}).waitFor();assert.equal(await page.getByLabel('معرف حسابك',{exact:true}).inputValue(),accounts[role].uid);
  assert.equal(await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).count(),0);
  assert.equal((await services.db.doc('users/'+accounts[role].uid).get()).exists,false);
  await page.getByRole('button',{name:'تسجيل الخروج',exact:true}).click();await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).waitFor();
 }
 await login('admin');await page.getByRole('heading',{name:'الحي الحكومي، في شاشة واحدة.',exact:true}).waitFor();
 assert.equal((await services.db.doc('users/'+accounts.admin.uid).get()).exists,true);
 // A normal browser counts once, including reloads and local cache resets.
 const countContext=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
 await countContext.addInitScript(()=>sessionStorage.setItem('capital-sangoub-breakfast-invitation-v1','1'));
 const countPage=await countContext.newPage();const counted=countPage.waitForResponse(response=>response.url().endsWith('/api/visitors')&&response.request().method()==='POST');await countPage.goto('http://127.0.0.1:3105/');assert.equal((await counted).status(),200);
 assert.equal((await services.db.doc('siteMetrics/summary').get()).data().visitors,1);
 await countPage.evaluate(()=>localStorage.removeItem('capital-site-visitor-day-v2'));const recounted=countPage.waitForResponse(response=>response.url().endsWith('/api/visitors')&&response.request().method()==='POST');await countPage.reload();assert.equal((await recounted).status(),200);assert.equal((await services.db.doc('siteMetrics/summary').get()).data().visitors,1);await countPage.getByRole('button',{name:'افتح قائمة السنجاب',exact:true}).click();await countPage.getByRole('button',{name:/^طلب أوردر سوبر ماركت/}).click();
 const tracked=countPage.getByRole('dialog',{name:'طلب سوبر ماركت',exact:true});await tracked.getByRole('button',{name:/^احتياجات المكتب/}).click();await tracked.getByRole('textbox',{name:'عدد مناديل سحب — علبة',exact:true}).fill('1');await tracked.getByRole('button',{name:'متابعة الطلب',exact:true}).click();await tracked.getByLabel('اسم صاحب طلب السوبرماركت',{exact:true}).fill('تفاصيل لا تدخل الإحصائيات');await tracked.getByLabel('عنوان توصيل السوبرماركت',{exact:true}).fill('عنوان خاص للاختبار');await tracked.getByRole('radio',{name:'كاش عند الاستلام',exact:true}).check();await tracked.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();
 await countContext.route('https://wa.me/**',route=>route.fulfill({contentType:'text/plain',body:'Intercepted'}));
 const eventResponse=countPage.waitForResponse(response=>response.url().endsWith('/api/visitors')&&response.request().postDataJSON()?.event==='whatsapp_supermarket');const popup=countContext.waitForEvent('page');await tracked.getByRole('link',{name:'إرسال الطلب عبر واتساب',exact:true}).click();const eventResult=await eventResponse;assert.equal(eventResult.status(),200);assert.deepEqual(Object.keys(eventResult.request().postDataJSON()).sort(),['event','source','visitorId']);await(await popup).close();
 const countedDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());let metrics;for(let attempt=0;attempt<30;attempt++){metrics=(await services.db.doc('siteMetricDays/'+countedDay).get()).data();if(['mascot_open','supermarket','review_supermarket','whatsapp_supermarket'].every(event=>metrics.events?.[event]===1))break;await new Promise(resolve=>setTimeout(resolve,100));}for(const event of ['mascot_open','supermarket','review_supermarket','whatsapp_supermarket'])assert.equal(metrics.events[event],1,event);assert.equal(metrics.sources.direct,1);
 await countContext.close();
 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'عدد الزوار',exact:true}).click();await page.getByRole('heading',{name:'عدد زوار الموقع',exact:true}).waitFor();await page.getByText('إجمالي الزوار',{exact:false}).waitFor();
 assert.deepEqual(await page.locator('.management-summary strong').allTextContents(),['١','١']);await page.getByRole('button',{name:'تحديث العدد',exact:true}).click();await page.getByRole('button',{name:'تحديث العدد',exact:true}).waitFor();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'visitor statistics fit '+width);}
 await accessible(page,'visitor statistics');await page.screenshot({path:join(tmpdir(),'capital-admin-visitors.png'),fullPage:true});

 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'المتاجر',exact:true}).click();await page.getByRole('heading',{name:'المتاجر',exact:true}).waitFor();
 await page.getByRole('button',{name:'إضافة متجر',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('اسم المتجر',{exact:true}).fill('اختبار بوابة الإدارة');await dialog.getByLabel('عنوان المتجر',{exact:true}).fill('محاكي معزول');await dialog.getByLabel('نوع النشاط',{exact:true}).fill('متجر اختبار');await dialog.getByRole('button',{name:'حفظ',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('row').filter({hasText:'اختبار بوابة الإدارة'}).waitFor();assert.equal((await services.db.collection('stores').get()).size,1);
 await page.reload();await page.getByRole('heading',{name:'المتاجر',exact:true}).waitFor();
 await page.getByRole('button',{name:'مركز العمليات',exact:false}).click();await page.getByRole('heading',{name:'الحي الحكومي، في شاشة واحدة.',exact:true}).waitFor();
 // Real server-backed account creation, role updates, disable and audited export.
 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'المستخدمون',exact:true}).click();
 await page.getByRole('button',{name:'إضافة مستخدم',exact:true}).click();const userDialog=page.getByRole('dialog');
 await userDialog.getByLabel('اسم المستخدم',{exact:true}).fill('حساب إدارة ويب تجريبي');await userDialog.getByLabel('بريد المستخدم',{exact:true}).fill('web-managed@example.com');await userDialog.getByLabel('سبب تعديل المستخدم',{exact:true}).fill('اختبار إنشاء المستخدم عبر الواجهة');await userDialog.getByRole('button',{name:'تأكيد العملية',exact:true}).click();await userDialog.waitFor({state:'hidden'});
 let managed=page.getByRole('row').filter({hasText:'web-managed@example.com'});await managed.waitFor();await managed.getByRole('button',{name:'الصلاحيات',exact:true}).click();await userDialog.getByLabel('دور المستخدم',{exact:true}).selectOption('courier');await userDialog.getByLabel('سبب تعديل المستخدم',{exact:true}).fill('اختبار تغيير صلاحية المستخدم');await userDialog.getByRole('button',{name:'تأكيد العملية',exact:true}).click();await userDialog.waitFor({state:'hidden'});await managed.getByText('مندوب توصيل',{exact:true}).waitFor();
 await managed.locator('select').selectOption('disable');await userDialog.getByLabel('سبب تعديل المستخدم',{exact:true}).fill('اختبار تعطيل المستخدم من الواجهة');await userDialog.getByRole('button',{name:'تأكيد العملية',exact:true}).click();await userDialog.waitFor({state:'hidden'});await managed.getByText('معطل',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'سجل التدقيق',exact:true}).click();await page.getByText('user.create',{exact:true}).waitFor();await page.getByText('user.disable',{exact:true}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'تصدير كل النتائج',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/sangoub-audit/);
 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'مركز العمليات',exact:true}).click();await page.getByRole('heading',{name:'الحي الحكومي، في شاشة واحدة.',exact:true}).waitFor();
 // Isolated emulator records exercise the real operations table and filters.
 const now=new Date().toISOString();
 for(const [id,status,name,total] of [['CT-TEST-1','received','عميل اختبار التشغيل',120],['CT-TEST-2','delivered','عميل اختبار التسليم',85]])await services.db.doc('orders/'+id).set({orderNumber:id,profileId:accounts.employee.uid,profileName:name,phone:'01012345678',ministry:'جهة اختبار معزولة',floorNumber:'1',roomNumber:'1',items:[],subtotal:total,total,createdAt:now,updatedAt:now,orderStatus:status,...(status==='delivered'?{deliveredAt:now}:{})});
 await page.getByText('#CT-TEST-1',{exact:true}).waitFor();await page.getByText('#CT-TEST-2',{exact:true}).waitFor();
 await page.getByLabel('بحث طلبات العمليات').fill('عميل اختبار التشغيل');assert.equal(await page.getByText('#CT-TEST-2',{exact:true}).count(),0);await page.getByLabel('بحث طلبات العمليات').fill('');
 await page.getByRole('button',{name:/طلبات جديدة/}).click();assert.equal(await page.getByText('#CT-TEST-2',{exact:true}).count(),0);await page.getByRole('button',{name:'مسح الحالة',exact:true}).click();await page.getByText('#CT-TEST-2',{exact:true}).waitFor();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'admin overflow '+width);}
 await page.evaluate(()=>window.scrollTo(0,0));await accessible(page,'operations dashboard');
 await page.screenshot({path:join(tmpdir(),'capital-admin-operations.png'),fullPage:true});
 await page.getByRole('button',{name:'طي القائمة الجانبية',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.admin-sidebar').getBoundingClientRect().width<100);await page.reload();await page.getByRole('button',{name:'توسيع القائمة الجانبية',exact:true}).waitFor();
 await page.keyboard.press('Control+k');assert.equal(await page.getByLabel('بحث سريع في الإدارة').evaluate(el=>el===document.activeElement),true);await page.getByLabel('بحث سريع في الإدارة').fill('CT-TEST-1');await page.locator('#admin-search-results').getByRole('button').first().click();
 await page.getByRole('button',{name:'تفاصيل الطلب CT-TEST-1',exact:true}).click();const orderDrawer=page.getByRole('dialog',{name:'تفاصيل وإدارة الطلب',exact:true});await orderDrawer.waitFor();await orderDrawer.getByRole('button',{name:'بدء التحضير بالمطعم',exact:true}).waitFor();assert.equal(Math.round((await orderDrawer.boundingBox()).x),0);await page.screenshot({path:join(tmpdir(),'capital-compact-order-drawer.png'),fullPage:true});await page.keyboard.press('Escape');await orderDrawer.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'توسيع القائمة الجانبية',exact:true}).click();await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'مركز العمليات',exact:true}).click();

 await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();
 const sidebarDialog=page.getByRole('dialog',{name:'قائمة الإدارة',exact:true});await sidebarDialog.waitFor();
 assert.equal(await page.locator('#admin-content').evaluate(element=>element.inert),true);
 const menuFocus=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));
 assert.equal(menuFocus,'إغلاق القائمة');
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('#admin-navigation'))),true);
 await page.keyboard.press('Escape');await sidebarDialog.waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).evaluate(element=>element===document.activeElement),true);
 await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();await page.getByRole('button',{name:'أكواد الخصم',exact:true}).click();await page.getByRole('heading',{name:'أكواد الخصم',exact:true}).first().waitFor();
 await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();await page.getByRole('button',{name:'مركز العمليات',exact:false}).click();
 await page.screenshot({path:join(tmpdir(),'capital-admin-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const label of ['الطلبات','متابعة التحضير','واجهة التطبيق والحملات','المتاجر','المنتجات','عروض المنتجات','أكواد الخصم','المستخدمون','طلبات الشراكة','طلبات التوظيف','سجل التدقيق','مركز العمليات']){
   if(width<=800)await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();
   await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:label,exact:true}).click();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>innerWidth||r.left<0||r.right>innerWidth;}).slice(0,18).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,60)}))));await page.screenshot({path:join(tmpdir(),'capital-admin-overflow.png'),fullPage:true});}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label} overflow ${width}`);
  }
 }
 // Catalog navigation, pagination, availability and image selection use isolated emulator records.
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:'المنتجات',exact:true}).click();
 const catalogStore=(await services.db.collection('stores').get()).docs[0].id;
 const batch=services.db.batch();
 for(let i=1;i<=27;i++){const id='catalog-layout-'+i;batch.set(services.db.doc('products/'+id),{id,name:'صنف اختبار '+String(i).padStart(2,'0'),description:'بيانات معزولة لاختبار العرض والتصفية',storeId:catalogStore,storeName:'اختبار بوابة الإدارة',category:'وجبات خفيفة',price:45+i,inStock:true,archived:false,imageUrl:''});}
 await batch.commit();
 await page.getByRole('table',{name:'قائمة المنتجات وأسعارها وتوافرها'}).waitFor();
 await page.getByRole('navigation',{name:'صفحات الكتالوج'}).waitFor();
 assert.equal(await page.getByRole('table').locator('tbody tr').count(),25);
 await page.getByRole('button',{name:'التالي',exact:true}).click();assert.equal(await page.getByRole('table').locator('tbody tr').count(),2);
 await page.getByLabel('بحث الكتالوج',{exact:true}).fill('صنف اختبار 01');await page.getByRole('row').filter({hasText:'صنف اختبار 01'}).waitFor();
 assert.equal(await page.getByRole('table').locator('tbody tr').count(),1);
 await page.getByRole('row').filter({hasText:'صنف اختبار 01'}).getByRole('button',{name:'إيقاف مؤقت',exact:true}).click();
 await page.getByRole('row').filter({hasText:'صنف اختبار 01'}).getByText('غير متاح',{exact:true}).waitFor();
 assert.equal((await services.db.doc('products/catalog-layout-1').get()).data().inStock,false);
 await page.getByRole('button',{name:'عرض كبطاقات',exact:true}).click();assert.equal(await page.getByRole('table').count(),0);
 await page.getByRole('button',{name:'عرض كجدول',exact:true}).click();await page.getByRole('button',{name:'مسح التصفية',exact:true}).click();
 await page.screenshot({path:join(tmpdir(),'capital-catalog-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'إضافة منتج',exact:true}).click();const productEditor=page.getByRole('dialog',{name:'إضافة منتج',exact:true});
 await productEditor.getByLabel('رفع صورة المنتج',{exact:true}).setInputFiles({name:'preview.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfFcAAAAASUVORK5CYII=','base64')});
 await productEditor.getByAltText('معاينة رفع صورة المنتج',{exact:true}).waitFor();await productEditor.getByRole('button',{name:'إزالة الصورة المختارة',exact:true}).click();assert.equal(await productEditor.getByLabel('رفع صورة المنتج',{exact:true}).evaluate(input=>input.files.length),0);
 await productEditor.locator('input[name=badge]').scrollIntoViewIfNeeded();assert.equal(await productEditor.getByRole('button',{name:'حفظ',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
 await page.screenshot({path:join(tmpdir(),'capital-catalog-editor.png'),fullPage:true});await page.keyboard.press('Escape');
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'catalog table overflow '+width);}
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:join(tmpdir(),'capital-catalog-mobile.png'),fullPage:true});
 // A signed-out visitor sees only real public catalog records and can continue via the app prompt.
 await services.db.doc('stores/'+catalogStore).update({status:'open'});
 for(let i=0;i<5;i++)await services.db.doc('stores/carousel-'+i).set({id:'carousel-'+i,name:'متجر اختبار الشريط '+i,status:'open',type:'اختبار معزول'});
 const visitorContext=await browser.newContext({viewport:{width:820,height:844}});const visitor=await visitorContext.newPage();await visitor.goto('http://127.0.0.1:3105/');const visitorInvitation=visitor.getByRole('dialog',{name:'فطارك وطلباتك مع سنجوب',exact:true});await visitorInvitation.waitFor({timeout:7000});await visitorInvitation.getByRole('button',{name:'هطلب بعدين',exact:true}).click();
 await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).waitFor();await visitor.getByRole('button',{name:'إيقاف حركة المتاجر',exact:true}).click();assert.equal(await visitor.getByRole('button',{name:'تشغيل حركة المتاجر',exact:true}).getAttribute('aria-pressed'),'false');await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)>20);await visitor.getByRole('button',{name:'المتاجر السابقة',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)<3);

 await visitor.setViewportSize({width:390,height:844});assert.equal(await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).isVisible(),true,'mobile stores have carousel controls');assert.equal(await visitor.locator('.public-store-list').evaluate(el=>el.scrollWidth>el.clientWidth),true,'mobile stores form one swipeable row');await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)>20);await visitor.getByRole('button',{name:'المتاجر السابقة',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)<3);
 await visitor.getByRole('button',{name:'المنتجات التالية',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-product-grid').scrollLeft)>20);await visitor.getByRole('button',{name:'المنتجات السابقة',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-product-grid').scrollLeft)<3);
 await visitor.getByRole('button',{name:/اختبار بوابة الإدارة.*مفتوح الآن/}).click();const visitorPrompt=visitor.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true});await visitorPrompt.getByText('اختبار بوابة الإدارة',{exact:true}).waitFor();await visitorPrompt.getByRole('button',{name:'أكمل تصفح الموقع',exact:true}).click();
 await visitor.getByRole('button',{name:/صنف اختبار 02/}).click();await visitorPrompt.getByText('صنف اختبار 02',{exact:true}).waitFor();await visitorPrompt.getByRole('button',{name:'إغلاق',exact:true}).click();
 assert.equal(await visitor.getByRole('button',{name:/صنف اختبار 01/}).count(),0,'unavailable products do not appear in the public catalog');assert.equal(await visitor.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'real public catalog mobile overflow');await visitor.screenshot({path:join(tmpdir(),'capital-public-catalog.png'),fullPage:true});const catalogSnapshot=await services.db.collection('products').get();const oneItem=services.db.batch();for(const doc of catalogSnapshot.docs)oneItem.update(doc.ref,{inStock:doc.id==='catalog-layout-2'});await oneItem.commit();
 await visitor.waitForFunction(()=>document.querySelector('.public-product-grid.is-single'));const single=await visitor.locator('.public-product-card').boundingBox(),singleGrid=await visitor.locator('.public-product-grid').boundingBox();assert.equal(await visitor.locator('.public-product-card').count(),1);assert.ok(Math.abs(single.width-singleGrid.width)<1,'a lone product fills the row');assert.ok(single.height<180,'a lone product uses a compact horizontal card');
 const restoreStock=services.db.batch();for(const doc of catalogSnapshot.docs)restoreStock.update(doc.ref,{inStock:doc.data().inStock});await restoreStock.commit();
 await services.db.doc('stores/'+catalogStore).update({status:'closed'});await visitor.getByRole('button',{name:/صنف اختبار 02/}).waitFor({state:'hidden'});await visitor.close();
 // Create an offer on an existing product, then observe real-time public eligibility.
 await page.setViewportSize({width:1440,height:1000});
 const navigation=page.getByRole('navigation',{name:'أقسام إدارة التشغيل'});
 await navigation.getByRole('button',{name:'عروض المنتجات',exact:true}).click();
 await page.getByRole('button',{name:'إضافة عرض على منتج',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'اختيار منتج للعرض',exact:true});
 await picker.getByLabel('المنتج',{exact:true}).selectOption('catalog-layout-2');
 await picker.getByRole('button',{name:'تحديد سعر العرض',exact:true}).click();
 const offerEditor=page.getByRole('dialog',{name:'تعديل عرض المنتج',exact:true});
 await offerEditor.getByLabel('سعر المنتج',{exact:true}).fill('30');
 await offerEditor.getByLabel('السعر قبل الخصم',{exact:true}).fill('60');
 await offerEditor.getByRole('button',{name:'حفظ',exact:true}).click();
 await offerEditor.waitFor({state:'hidden'});
 await page.getByRole('row').filter({hasText:'صنف اختبار 02'}).waitFor();
 await accessible(page,'offer management');
 assert.equal((await services.db.collection('products').get()).size,27,'offer updates the existing product instead of duplicating it');
 await services.db.doc('stores/'+catalogStore).update({status:'open'});
 const offersContext=await browser.newContext({viewport:{width:1440,height:1000}});const offersVisitor=await offersContext.newPage();
 await offersVisitor.goto('http://127.0.0.1:3105/offers');
 await offersVisitor.getByRole('heading',{name:'صنف اختبار 02',exact:true}).waitFor();
 await offersVisitor.getByText('خصم 50٪',{exact:true}).waitFor();
 assert.equal(await offersVisitor.locator('.offer-card').count(),1);
 for(const width of [320,390,768,1440]){await offersVisitor.setViewportSize({width,height:1000});assert.equal(await offersVisitor.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'offers overflow '+width);}
 await offersVisitor.getByLabel('البحث في العروض',{exact:true}).fill('غير موجود');
 await offersVisitor.getByRole('heading',{name:'لا توجد عروض مطابقة',exact:true}).waitFor();
 await offersVisitor.getByRole('button',{name:'عرض كل العروض',exact:true}).click();
 await offersVisitor.getByRole('button',{name:/صنف اختبار 02/}).click();
 await offersVisitor.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true}).getByText('صنف اختبار 02',{exact:true}).waitFor();
 await offersVisitor.keyboard.press('Escape');
 await accessible(offersVisitor,'public offers');await offersVisitor.evaluate(()=>window.scrollTo(0,0));
 await offersVisitor.screenshot({path:join(tmpdir(),'capital-offers-desktop.png'),fullPage:true});
 await services.db.doc('products/catalog-layout-2').update({inStock:false});
 await offersVisitor.getByRole('heading',{name:'العروض الحلوة جاية قريب',exact:true}).waitFor();
 await services.db.doc('products/catalog-layout-2').update({inStock:true});
 await offersVisitor.getByRole('heading',{name:'صنف اختبار 02',exact:true}).waitFor();
 await services.db.doc('stores/'+catalogStore).update({status:'closed'});
 await offersVisitor.getByRole('heading',{name:'العروض الحلوة جاية قريب',exact:true}).waitFor();
 await services.db.doc('stores/'+catalogStore).update({status:'open'});
 await offersVisitor.getByRole('heading',{name:'صنف اختبار 02',exact:true}).waitFor();
 await services.db.doc('products/catalog-layout-2').update({originalPrice:30});
 await offersVisitor.getByRole('heading',{name:'العروض الحلوة جاية قريب',exact:true}).waitFor();
 await offersVisitor.close();
 // Imported offers have no store until an administrator explicitly assigns one.
 await services.db.doc('products/imported-offer').set({id:'imported-offer',name:'عرض مستورد دون متجر',description:'اختبار إتاحة العرض بعد تحديد المتجر',storeId:'',storeName:'كتالوج مستورد',category:'وجبات خفيفة',price:25,originalPrice:50,inStock:false,archived:false});
 await navigation.getByRole('button',{name:'عروض المنتجات',exact:true}).click();
 const imported=page.getByRole('row').filter({hasText:'عرض مستورد دون متجر'});await imported.waitFor();
 await imported.getByRole('button',{name:'إتاحة للطلب',exact:true}).click();
 const assignment=page.getByRole('dialog',{name:'تعديل عرض المنتج',exact:true});await assignment.waitFor();
 assert.equal(await assignment.getByLabel('متجر العرض',{exact:true}).inputValue(),'');
 assert.equal(await assignment.getByRole('checkbox',{name:'متاح للطلب',exact:true}).isChecked(),true);
 assert.equal((await services.db.doc('products/imported-offer').get()).data().inStock,false,'opening the editor does not change availability');
 await assignment.getByLabel('متجر العرض',{exact:true}).selectOption(catalogStore);
 await assignment.getByRole('button',{name:'حفظ',exact:true}).click();await assignment.waitFor({state:'hidden'});
 await imported.getByRole('button',{name:'إيقاف مؤقت',exact:true}).waitFor();
 const assigned=(await services.db.doc('products/imported-offer').get()).data();
 assert.equal(assigned.storeId,catalogStore);assert.equal(assigned.inStock,true);assert.equal(assigned.price,25);assert.equal(assigned.originalPrice,50);
 const assignmentVisitor=await (await browser.newContext()).newPage();
 await assignmentVisitor.goto('http://127.0.0.1:3105/offers');await assignmentVisitor.getByRole('heading',{name:'عرض مستورد دون متجر',exact:true}).waitFor();await assignmentVisitor.close();
 // Coupons have a dedicated editor and audited persistence.
 await navigation.getByRole('button',{name:'أكواد الخصم',exact:true}).click();
 await page.getByRole('button',{name:'إضافة كود خصم',exact:true}).click();
 const couponDialog=page.getByRole('dialog',{name:'إضافة كود خصم',exact:true});
 await accessible(page,'coupon editor');
 await couponDialog.getByLabel('كود الخصم',{exact:true}).fill('WEB10');
 await couponDialog.getByLabel('وصف الخصم',{exact:true}).fill('خصم اختبار الويب');
 await couponDialog.getByLabel('قيمة الخصم',{exact:true}).fill('10');
 await couponDialog.getByRole('button',{name:'حفظ كود الخصم',exact:true}).click();
 await couponDialog.waitFor({state:'hidden'});await page.getByRole('row').filter({hasText:'WEB10'}).waitFor();
 assert.equal((await services.db.doc('coupons/WEB10').get()).data().value,10);
 await navigation.getByRole('button',{name:'المنتجات',exact:true}).click();await page.getByRole('heading',{name:'المنتجات',exact:true}).waitFor();
 await page.goBack();await page.getByRole('heading',{name:'أكواد الخصم',exact:true}).first().waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(tmpdir(),'capital-admin-navigation.png'),fullPage:true});
 // Customer-home ordering and campaigns are managed on the web, with a safe rollout gate.
 await navigation.getByRole('button',{name:'واجهة التطبيق والحملات',exact:true}).click();
 await page.getByRole('heading',{name:'ترتيب الصفحة الرئيسية',exact:true}).waitFor();
 const storesSection=page.locator('.content-section-row').filter({hasText:'المتاجر'});
 await storesSection.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'حفظ إعدادات الصفحة',exact:true}).click();
 await page.getByText('تم حفظ ترتيب الصفحة وإعدادات السلايدر.',{exact:true}).waitFor();
 const home=await(await page.request.get('http://127.0.0.1:3105/api/app-content')).json();assert.equal(home.config.sections.find(section=>section.type==='stores').enabled,false);
 await page.getByRole('button',{name:'إضافة حملة',exact:true}).click();const campaignEditor=page.getByRole('dialog',{name:'محرر الحملة',exact:true});
 await campaignEditor.getByLabel('عنوان الحملة',{exact:true}).fill('حملة ويب اختبار');await campaignEditor.getByLabel('رابط صورة الحملة',{exact:true}).fill('https://example.com/campaign.png');
 await campaignEditor.getByLabel('نوع الهدف',{exact:true}).selectOption('offers');await campaignEditor.getByRole('button',{name:'حفظ الحملة',exact:true}).click();await campaignEditor.waitFor({state:'hidden'});
 await page.getByRole('row').filter({hasText:'حملة ويب اختبار'}).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:'تفعيل تذاكر المتاجر وتأكيد استلام كل نقطة',exact:true}).isDisabled(),true);
 await accessible(page,'customer-home settings');
 // Team accounts receive a private password-setup link and an explicit store assignment.
 await navigation.getByRole('button',{name:'المستخدمون',exact:true}).click();await page.getByRole('button',{name:'إضافة مستخدم',exact:true}).click();
 const teamEditor=page.getByRole('dialog');await teamEditor.getByLabel('دور المستخدم',{exact:true}).selectOption('restaurant');
 await teamEditor.getByLabel('متجر الحساب',{exact:true}).selectOption(catalogStore);await teamEditor.getByLabel('مهمة فريق المتجر',{exact:true}).selectOption('preparer');
 await teamEditor.getByLabel('اسم المستخدم',{exact:true}).fill('تحضير متجر اختبار');await teamEditor.getByLabel('بريد المستخدم',{exact:true}).fill('team-ui@example.com');await teamEditor.getByLabel('سبب تعديل المستخدم',{exact:true}).fill('إنشاء حساب مسؤول التحضير');
 await teamEditor.getByRole('button',{name:'تأكيد العملية',exact:true}).click();await teamEditor.getByLabel('رابط الاستعادة',{exact:true}).waitFor();assert.ok((await teamEditor.getByLabel('رابط الاستعادة',{exact:true}).inputValue()).length>0);
 await teamEditor.getByRole('button',{name:'إغلاق إدارة المستخدم',exact:true}).click();await teamEditor.waitFor({state:'hidden'});
 const teamUser=await services.auth.getUserByEmail('team-ui@example.com');assert.equal((await services.db.doc('staff/'+teamUser.uid).get()).data().storeId,catalogStore);
 // Existing bookmarked destinations still resolve without duplicate pages.
 for(const [hash,heading] of [['catalog','المنتجات'],['management','الطلبات'],['settings','إدارة المستخدمين']]){
  await page.goto('http://127.0.0.1:3105/admin#'+hash);await page.getByRole('heading',{name:heading,exact:true}).waitFor();
 }
 await page.goto('http://127.0.0.1:3105/kitchen#offers');await page.getByRole('heading',{name:'عروض المنتجات',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'عروض المنتجات',exact:true}).waitFor();
 await services.db.doc('admins/'+accounts.admin.uid).delete();await page.getByRole('heading',{name:'الحساب غير مخوّل للإدارة',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Public homepage and protected admin passed: public navigation, mobile dialog, /admin login, no simulator/role picker, employee/chef/courier denial, real admin admission, store persistence, session reload, live revocation, server-backed user creation/role/disable, audited export and twelve responsive sections at 390/768/1440. Emulator data only.');
}finally{await browser?.close();vite.kill('SIGTERM');}
