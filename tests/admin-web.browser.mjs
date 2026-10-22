import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
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
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3105','--strictPort'],{cwd:root,env:{...process.env,VITE_USE_FIREBASE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-capital-talabat'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3105',{signal:AbortSignal.timeout(1000)});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:3105/');
 await page.getByRole('navigation',{name:'القائمة الرئيسية'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'تسجيل دخول الإدارة',exact:true}).count(),0);
 assert.equal(await page.getByText('iPhone 16 Pro',{exact:true}).count(),0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public overflow '+width);}
 await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'إغلاق',exact:true}).click();
 await page.getByRole('link',{name:'دخول الإدارة',exact:true}).click();
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
 await page.getByRole('button',{name:'المنتجات والمتاجر',exact:true}).click();await page.getByRole('heading',{name:'منتجاتك ومتاجرك، تحت إدارتك.',exact:true}).waitFor();
 await page.getByRole('button',{name:'المتاجر',exact:true}).click();await page.getByRole('button',{name:'إضافة متجر',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('اسم المتجر',{exact:true}).fill('اختبار بوابة الإدارة');await dialog.getByLabel('عنوان المتجر',{exact:true}).fill('محاكي معزول');await dialog.getByLabel('نوع النشاط',{exact:true}).fill('متجر اختبار');await dialog.getByRole('button',{name:'حفظ',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('heading',{name:'اختبار بوابة الإدارة',exact:true}).waitFor();assert.equal((await services.db.collection('stores').get()).size,1);
 await page.reload();await page.getByRole('heading',{name:'منتجاتك ومتاجرك، تحت إدارتك.',exact:true}).waitFor();
 await page.getByRole('button',{name:'مركز العمليات',exact:false}).click();await page.getByRole('heading',{name:'الحي الحكومي، في شاشة واحدة.',exact:true}).waitFor();
 // Isolated emulator records exercise the real operations table and filters.
 const now=new Date().toISOString();
 for(const [id,status,name,total] of [['CT-TEST-1','received','عميل اختبار التشغيل',120],['CT-TEST-2','delivered','عميل اختبار التسليم',85]])await services.db.doc('orders/'+id).set({orderNumber:id,profileId:accounts.employee.uid,profileName:name,phone:'01012345678',ministry:'جهة اختبار معزولة',floorNumber:'1',roomNumber:'1',items:[],subtotal:total,total,createdAt:now,updatedAt:now,orderStatus:status,...(status==='delivered'?{deliveredAt:now}:{})});
 await page.getByText('#CT-TEST-1',{exact:true}).waitFor();await page.getByText('#CT-TEST-2',{exact:true}).waitFor();
 await page.getByLabel('بحث طلبات العمليات').fill('عميل اختبار التشغيل');assert.equal(await page.getByText('#CT-TEST-2',{exact:true}).count(),0);await page.getByLabel('بحث طلبات العمليات').fill('');
 await page.getByRole('button',{name:/طلبات جديدة/}).click();assert.equal(await page.getByText('#CT-TEST-2',{exact:true}).count(),0);await page.getByRole('button',{name:'مسح الحالة',exact:true}).click();await page.getByText('#CT-TEST-2',{exact:true}).waitFor();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'admin overflow '+width);}
 await page.screenshot({path:join(tmpdir(),'capital-admin-operations.png'),fullPage:true});
 await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();await page.getByRole('button',{name:'الفريق والخصومات',exact:false}).click();await page.getByText('إدارة الفريق والخصومات',{exact:true}).waitFor();
 await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();await page.getByRole('button',{name:'مركز العمليات',exact:false}).click();
 await page.screenshot({path:join(tmpdir(),'capital-admin-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const label of ['الطلبات والتقديمات','شاشة المطبخ','المنتجات والمتاجر','الفريق والخصومات','مركز العمليات']){
   if(width<=800)await page.getByRole('button',{name:'أقسام الإدارة',exact:true}).click();
   await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).getByRole('button',{name:label,exact:true}).click();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>innerWidth||r.left<0||r.right>innerWidth;}).slice(0,18).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,60)}))));await page.screenshot({path:join(tmpdir(),'capital-admin-overflow.png'),fullPage:true});}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label} overflow ${width}`);
  }
 }
 await services.db.doc('admins/'+accounts.admin.uid).delete();await page.getByRole('heading',{name:'الحساب غير مخوّل للإدارة',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'أقسام إدارة التشغيل'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Public homepage and protected admin passed: public navigation, mobile dialog, /admin login, no simulator/role picker, employee/chef/courier denial, real admin admission, store persistence, session reload, live revocation, responsive 390/768/1440. Emulator data only.');
}finally{await browser?.close();vite.kill('SIGTERM');}
