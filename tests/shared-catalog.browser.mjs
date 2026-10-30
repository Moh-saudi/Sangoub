import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {chromium} from 'playwright';
const fixture=`
import '/src/index.css';import '/src/bootstrap.scss';
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {RestaurantPortal} from '/src/components/RestaurantPortal.tsx';
import {CatalogManager} from '/src/components/CatalogManager.tsx';
const catalog=[{id:'master-water',name:'مياه كتالوج',description:'عبوة مياه معتمدة',category:'مشروبات',imageUrl:'/__catalog-product-image.svg'},
{id:'master-coffee',name:'قهوة كتالوج',description:'قهوة معتمدة',category:'مشروبات'}];
window.__requests=[];window.__failNext=true;
window.__merchantApi=async(endpoint,input)=>{window.__requests.push(input);if(input.action==='store-customers')return {items:[{id:'customer',name:'عميل متجر الاختبار',orderIds:['order-a']}]};if(input.action==='store-payments')return {items:[{id:'settlement-a',gross:100,commission:10,net:90,reference:'ref-a',orderCount:1}],nextCursor:null};return {items:input.query?catalog.filter(p=>p.name.startsWith(input.query)):(input.cursor?[catalog[1]]:[catalog[0]]),nextCursor:input.query||input.cursor?null:'master-water'};};
const store={id:'store-a',name:'متجر الاختبار',status:'open',commissionRate:10,minOrder:0,deliveryFee:15,category:'supermarket'};
function Fixture(){const [products,setProducts]=useState((new URLSearchParams(location.search).has('admin')||new URLSearchParams(location.search).has('adopt'))?[{...catalog[0],id:'legacy-water',storeId:'store-a',storeName:store.name,price:10,inStock:true,imageType:'water'}]:[]);
window.__offers=products;
window.__adminApi=async(endpoint,input)=>{window.__adminRequest=input;setProducts(prev=>prev.map(p=>p.id===input.id?{...p,catalogProductId:p.id}:p));return {ok:true};};
if(new URLSearchParams(location.search).has('admin'))return <CatalogManager products={products} stores={[store]} orders={[]} mode="products"/>;
return <main dir="rtl"><RestaurantPortal stores={[store]} products={products} orders={[]} connected currentProfile={{id:'merchant',storeId:store.id,role:'restaurant',duty:new URLSearchParams(location.search).has('preparer')?'preparer':'manager',fullName:'تاجر اختبار'}}
onKitchenChange={async()=>{}} onUpdateOrderStatus={()=>{}} onUpdateProductStock={()=>{}} onUpdateProductPrice={async()=>{}} onToggleStoreStatus={()=>{}}
onArchiveProduct={async(id,archived)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,archived,inStock:false}:p))}
onLinkProduct={async(id,price,existingProductId)=>{window.__lastLink={id,price,...(existingProductId?{existingProductId}:{})};if(window.__failNext){window.__failNext=false;throw Error('تعذر حفظ العرض');}
if(existingProductId){setProducts(prev=>prev.map(p=>p.id===existingProductId?{...p,...catalog.find(c=>c.id===id),id:p.id,catalogProductId:id}:p));return;}
setProducts(prev=>prev.some(p=>p.catalogProductId===id)?prev:[...prev,{...catalog.find(p=>p.id===id),id:'offer-'+id,catalogProductId:id,storeId:store.id,storeName:store.name,price,inStock:false,imageType:'water'}]);
}}/><p data-testid="offer-count">{products.length}</p></main>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const server=await createServer({configFile:false,root:process.cwd(),css:{preprocessorOptions:{scss:{quietDeps:true,silenceDeprecations:['import','global-builtin','color-functions']}}},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','leaflet','lucide-react','firebase/app','firebase/auth','firebase/firestore','firebase/storage','@capacitor/core']},plugins:[react(),tailwindcss(),{
 name:'catalog-browser-fixture',enforce:'pre',
 resolveId(id){if(id.includes('lib/operationsApi'))return '/__catalog-operations-api.ts';if(id.includes('lib/adminApi'))return '/__catalog-admin-api.ts';if(id==='/__catalog-fixture.tsx')return id;},
 load(id){if(id==='/__catalog-admin-api.ts')return 'export const adminApi=(endpoint,input)=>window.__adminApi(endpoint,input);';if(id==='/__catalog-operations-api.ts')return 'export const operationsApi=(endpoint,input)=>window.__merchantApi(endpoint,input);';if(id==='/__catalog-fixture.tsx')return fixture;},
 configureServer(instance){instance.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__catalog-test'))return next();res.setHeader('Content-Type','text/html');res.end('<html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/__catalog-fixture.tsx"></script></body></html>');});}
}],server:{host:'127.0.0.1',port:3134,strictPort:true}});
let browser;
try{
 await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__catalog-product-image.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect x="35" y="20" width="50" height="145" rx="14" fill="#47a9c9"/><rect x="43" y="80" width="34" height="45" fill="white"/></svg>'}));
  await page.goto('http://127.0.0.1:3134/__catalog-test');
  await page.getByRole('button',{name:'المنتجات والأسعار',exact:true}).click();
  await page.getByRole('button',{name:'إضافة منتج',exact:true}).click();
  await page.getByRole('dialog',{name:'اختيار من الكتالوج العام'}).waitFor();
  await page.getByRole('button',{name:'مياه كتالوج',exact:false}).click();
  await page.waitForFunction(()=>document.querySelector('.merchant-catalog-photo img')?.naturalWidth>0);
  assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await page.screenshot({path:'/tmp/sangoub-merchant-product-picker-'+width+'.png'});
  const price=page.getByRole('spinbutton',{name:'سعر البيع في متجرك'});await price.fill('12.5');
  await page.getByRole('button',{name:'ربط المنتج بمتجري',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(),/تعذر حفظ العرض/);
  assert.equal(await price.inputValue(),'12.5','Failed save retains the selected product and price');
  await page.getByRole('button',{name:'ربط المنتج بمتجري',exact:true}).click();
  await page.getByText('تمت إضافة المنتج إلى متجرك.',{exact:false}).waitFor();
  assert.equal(await page.getByTestId('offer-count').innerText(),'1');
  assert.equal(await page.getByRole('button',{name:'مياه كتالوج',exact:false}).isDisabled(),true);
  assert.deepEqual(await page.evaluate(()=>window.__lastLink),{id:'master-water',price:12.5});
  await page.getByRole('button',{name:'قهوة كتالوج',exact:false}).waitFor();
  await page.getByRole('textbox',{name:'البحث في الكتالوج العام'}).fill('ق');
  await page.waitForFunction(()=>window.__requests.some(r=>r.query==='ق'));
  await page.getByRole('button',{name:'قهوة كتالوج',exact:false}).waitFor();
  await page.getByRole('textbox',{name:'البحث في الكتالوج العام'}).fill('قهوة');
  assert.equal(await page.getByRole('button',{name:'مياه كتالوج',exact:false}).count(),0);
  await page.waitForFunction(()=>window.__requests.some(r=>r.query==='قهوة'));
  await page.getByRole('button',{name:'قهوة كتالوج',exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.__requests.length),4);
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.getByRole('button',{name:'أرشفة عرض المتجر'}).click();
  await page.getByRole('button',{name:'المؤرشفة',exact:true}).click();
  await page.getByRole('button',{name:'استعادة بحالة غير متاح'}).click();
  await page.getByRole('button',{name:'المنتجات الحالية',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'الصنف غير متوفر حالياً'}).count(),1);
  assert.equal(await page.getByText('الصافي الجاهز للتحويل لحساب التاجر البنكي',{exact:true}).count(),0);
  const nav=page.getByRole('navigation',{name:'أقسام لوحة التحكم'});
  assert.equal(await nav.getByRole('button').count(),9);
  for(const label of ['الرئيسية','الطلبات','المخزون','التقارير','الإعدادات','الدعم والمساعدة']){
   await nav.getByRole('button',{name:label,exact:true}).click();
   assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page');
   assert(page.url().includes('/merchant/'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' must not overflow');
  }
  await nav.getByRole('button',{name:'العملاء',exact:true}).click();await page.getByText('عميل متجر الاختبار',{exact:true}).waitFor();
  await nav.getByRole('button',{name:'المدفوعات',exact:true}).click();await page.getByText('تسوية settlement-a',{exact:true}).waitFor();
  await page.goto('http://127.0.0.1:3134/__catalog-test?adopt=1');
  await page.getByRole('button',{name:'المنتجات والأسعار',exact:true}).click();
  await page.getByRole('button',{name:'إضافة منتج',exact:true}).click();
  await page.getByRole('button',{name:'مياه كتالوج',exact:false}).click();
  await page.getByText('المنتج موجود عندي بالفعل',{exact:true}).click();
  await page.getByRole('combobox',{name:'ربط بسجل قائم في متجري'}).selectOption('legacy-water');
  assert.equal(await price.isDisabled(),true);assert.equal(await price.inputValue(),'10');
  await page.evaluate(()=>{window.__failNext=false;});
  await page.getByRole('button',{name:'ربط المنتج بمتجري',exact:true}).click();
  await page.getByText('تمت إضافة المنتج إلى متجرك.',{exact:false}).waitFor();
  const adopted=await page.evaluate(()=>window.__offers);
  assert.equal(adopted.length,1);assert.equal(adopted[0].id,'legacy-water');assert.equal(adopted[0].price,10);
  assert.equal(adopted[0].catalogProductId,'master-water');
  await page.goto('http://127.0.0.1:3134/__catalog-test?preparer=1');
  await page.getByRole('button',{name:'المنتجات والأسعار',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'إضافة منتج',exact:true}).isDisabled(),true);
  await page.goto('http://127.0.0.1:3134/__catalog-test?admin=1');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'اعتماد بالكتالوج العام',exact:true}).click();
  await page.getByRole('button',{name:'معتمد بالكتالوج العام',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__adminRequest),{action:'catalog-publish',id:'legacy-water'});
  assert.equal(await page.getByRole('button',{name:'معتمد بالكتالوج العام',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'تعديل',exact:true}).click();
  await page.getByRole('spinbutton',{name:'سعر المنتج',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'اسم المنتج',exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Merchant portal and admin publication passed at mobile and desktop widths: real component, paginated definitions, search, retry retains identity/price, and linked products cannot be selected twice. API responses are test fixtures.');
}finally{await browser?.close();await server.close();}
