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
 await page.goto('http://127.0.0.1:3105/');
 await page.getByRole('navigation',{name:'القائمة الرئيسية'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).count(),0);
 assert.equal(await page.getByText('iPhone 16 Pro',{exact:true}).count(),0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public overflow '+width);}
 await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'إغلاق',exact:true}).click();
 // Every hero slide fits small screens; app prompts remain dismissible without a release URL.
 for(const width of [320,360,390,430,768,1440]){
  await page.setViewportSize({width,height:844});
  for(let slide=1;slide<=4;slide++){
   await page.getByRole('button',{name:new RegExp('^عرض الميزة '+slide+':')}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public hero overflow '+width+' slide '+slide);
  }
  if(width<=430){const brand=await page.locator('.site-brand').boundingBox(),app=await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).boundingBox();assert.ok(Math.abs(brand.y-app.y)<12,'mobile brand and app share a row');const photo=await page.locator('.showcase-images').boundingBox();assert.ok(photo.y<180&&photo.height>350,'district photograph fills the mobile hero');}
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/^عرض الميزة 1:/}).click();await page.waitForFunction(()=>{const slide=document.querySelector('.showcase-image.is-active'),img=slide?.querySelector('img');return slide&&Number(getComputedStyle(slide).opacity)>.99&&img?.complete&&img.naturalWidth>0;});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(tmpdir(),'capital-public-mobile.png'),fullPage:false});
 await page.getByRole('button',{name:/فطار يظبط يومك/}).click();const appPrompt=page.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true});await appPrompt.waitFor();
 await appPrompt.getByText('فطار يظبط يومك',{exact:true}).waitFor();await appPrompt.getByText('رابط التحميل الرسمي سيتاح قريبًا.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await appPrompt.getByRole('link',{name:'افتح التطبيق',exact:true}).count(),0);
 await page.screenshot({path:join(tmpdir(),'capital-public-app-prompt.png'),fullPage:false});await page.keyboard.press('Escape');await appPrompt.waitFor({state:'hidden'});assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.setViewportSize({width:1440,height:1000});
 await accessible(page,'public homepage');
 const support=page.getByRole('link',{name:'تواصل مع الدعم عبر واتساب',exact:true});assert.equal(await support.getAttribute('href'),'https://wa.me/201017799580');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).getByAltText('Google Play',{exact:true}).waitFor();
 assert.equal(await page.locator('.public-how>div').evaluate(el=>el.scrollWidth>el.clientWidth),true,'ordering steps swipe horizontally on mobile');
 await page.getByRole('navigation',{name:'القائمة الرئيسية'}).getByRole('link',{name:'الوظائف',exact:true}).click();await page.getByRole('heading',{name:'مكانك مع فريقنا.',exact:true}).waitFor();
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
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'تصدير كل النتائج',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/capital-talabat-audit/);
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
  for(const label of ['الطلبات','شاشة المطبخ','المتاجر','المنتجات','عروض المنتجات','أكواد الخصم','المستخدمون','طلبات الشراكة','طلبات التوظيف','سجل التدقيق','مركز العمليات']){
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
 const visitorContext=await browser.newContext({viewport:{width:390,height:844}});const visitor=await visitorContext.newPage();await visitor.goto('http://127.0.0.1:3105/');
 await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).waitFor();await visitor.getByRole('button',{name:'إيقاف حركة المتاجر',exact:true}).click();assert.equal(await visitor.getByRole('button',{name:'تشغيل حركة المتاجر',exact:true}).getAttribute('aria-pressed'),'false');await visitor.getByRole('button',{name:'المتاجر التالية',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)>20);await visitor.getByRole('button',{name:'المتاجر السابقة',exact:true}).click();await visitor.waitForFunction(()=>Math.abs(document.querySelector('.public-store-list').scrollLeft)<3);

 await visitor.getByRole('button',{name:/اختبار بوابة الإدارة.*مفتوح الآن/}).click();const visitorPrompt=visitor.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true});await visitorPrompt.getByText('اختبار بوابة الإدارة',{exact:true}).waitFor();await visitorPrompt.getByRole('button',{name:'أكمل تصفح الموقع',exact:true}).click();
 await visitor.getByRole('button',{name:/صنف اختبار 02/}).click();await visitorPrompt.getByText('صنف اختبار 02',{exact:true}).waitFor();await visitorPrompt.getByRole('button',{name:'إغلاق',exact:true}).click();
 assert.equal(await visitor.getByRole('button',{name:/صنف اختبار 01/}).count(),0,'unavailable products do not appear in the public catalog');assert.equal(await visitor.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'real public catalog mobile overflow');await visitor.screenshot({path:join(tmpdir(),'capital-public-catalog.png'),fullPage:true});await services.db.doc('stores/'+catalogStore).update({status:'closed'});await visitor.getByRole('button',{name:/صنف اختبار 02/}).waitFor({state:'hidden'});await visitor.close();
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
 // Existing bookmarked destinations still resolve without duplicate pages.
 for(const [hash,heading] of [['catalog','المنتجات'],['management','الطلبات'],['settings','إدارة المستخدمين']]){
  await page.goto('http://127.0.0.1:3105/admin#'+hash);await page.getByRole('heading',{name:heading,exact:true}).waitFor();
 }
 await page.goto('http://127.0.0.1:3105/kitchen#offers');await page.getByRole('heading',{name:'عروض المنتجات',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'عروض المنتجات',exact:true}).waitFor();
 await services.db.doc('admins/'+accounts.admin.uid).delete();await page.getByRole('heading',{name:'الحساب غير مخوّل للإدارة',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Public homepage and protected admin passed: public navigation, mobile dialog, /admin login, no simulator/role picker, employee/chef/courier denial, real admin admission, store persistence, session reload, live revocation, server-backed user creation/role/disable, audited export and eleven responsive sections at 390/768/1440. Emulator data only.');
}finally{await browser?.close();vite.kill('SIGTERM');}
