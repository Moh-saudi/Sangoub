import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import { chromium } from 'playwright';

// Exercise the production worker, which Vite's development server disables.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3112', '--strictPort'], { stdio: 'ignore' });
let browser;
const htmlPath=new URL('../dist/index.html',import.meta.url);
const originalHtml=await readFile(htmlPath,'utf8');
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch('http://127.0.0.1:3112'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const errors = [];
  context.on('serviceworker', worker => worker.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3112/');
  const invitation=page.getByRole('dialog',{name:'فطارك وطلباتك مع سنجوب',exact:true});await invitation.waitFor({timeout:7000});await invitation.getByRole('button',{name:'هطلب بعدين',exact:true}).click();await invitation.waitFor({state:'hidden'});
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker activation timed out')), 20000)),
    ]);
    if(registration.active?.state !== 'activated') await new Promise((resolve,reject)=>{
      const worker=registration.active;const timeout=setTimeout(()=>reject(new Error('Activation did not finish')),10000);
      const changed=()=>{if(worker?.state==='activated'){clearTimeout(timeout);worker.removeEventListener('statechange',changed);resolve();}};
      worker?.addEventListener('statechange',changed);changed();
    });
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.filter(key => key.includes('precache')).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
    return { active: registration.active?.state, logos: urls.filter(url => url.includes('/brand/sangoub-logo-512x512.png')) };
  });
  assert.equal(result.active, 'activated');
  assert.equal(result.logos.length, 1, 'The logo must have exactly one precache entry');
  assert.match(result.logos[0], /__WB_REVISION__=/, 'Public logo must retain content-based cache invalidation');
  await page.reload();
  // A controlled navigation must fetch current HTML, including after a prior visit.
  await writeFile(htmlPath,originalHtml.replace('</head>','<meta name="capital-navigation-probe" content="fresh-network-html"></head>'));
  await page.reload();assert.equal(await page.locator('meta[name="capital-navigation-probe"]').getAttribute('content'),'fresh-network-html');
  await context.setOffline(true);await page.reload();assert.equal(await page.locator('meta[name="capital-navigation-probe"]').getAttribute('content'),'fresh-network-html','offline uses the last successful navigation');
  await context.setOffline(false);await writeFile(htmlPath,originalHtml);await page.reload();
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.locator('.site-header').waitFor();
    const brand=await page.locator('.site-brand').boundingBox(),app=await page.getByRole('button',{name:'تطبيق الموبايل',exact:true}).boundingBox();assert.ok(Math.abs(brand.y-app.y)<12,'production mobile header uses a single row');
    const mascot=await page.locator('.hero-photograph').boundingBox(),copy=await page.locator('.hero-copy').boundingBox(),hero=await page.locator('.hero-showcase').boundingBox();assert.ok(hero.height<430,'production carousel is compact on mobile');assert.ok(Math.abs(mascot.width-hero.width)<2,'hero photograph fills its card');assert.match(await page.locator('.showcase-images img').getAttribute('src'),/^\/images\/government-district-(gardens|ministries|skyline|night)\.jpg$/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'production mobile overflow '+width);
  }
  const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel=manifest]').href).then(response=>response.json()));
  assert.equal(manifest.name,'سنجوب');assert.equal(manifest.short_name,'سنجوب');assert.match(await page.title(),/سنجوب/);assert.ok((await page.locator('.site-brand').innerText()).includes('Sangoub'));assert.ok(!/طلبات العاصمة|Capital Talabat/.test(await page.locator('body').innerText()));
  assert.deepEqual(manifest.icons.map(icon=>[icon.src,icon.sizes]),[['/brand/sangoub-logo-256x256.png','256x256'],['/brand/sangoub-logo-512x512.png','512x512']]);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>{const img=document.querySelector('.mascot-support-portrait img');return img?.complete&&img.naturalWidth===256;});await context.setOffline(false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.querySelector('.public-how').scrollIntoView());
  await page.waitForFunction(()=>document.getAnimations().some(animation=>{const target=animation.effect?.target;return target instanceof Element&&target.closest('.public-how')&&animation.playState==='running';}));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.getAnimations().filter(animation=>animation.effect?.target?.closest?.('.capital-site')).every(animation=>animation.playState!=='running'));
  await page.getByRole('button',{name:/فطار يظبط يومك/}).click();
  await page.getByRole('dialog',{name:'نكمل على التطبيق؟',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').evaluate(element=>getComputedStyle(element).animationName),'none','reduced motion disables modal animations');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.route('**/build-info.json?check=*',route=>route.fulfill({json:{id:'test-next-release'}}));
  await page.reload();await page.getByText('حدّث الصفحة لعرض أحدث تصميم للموقع.',{exact:true}).waitFor();
  await page.goto('http://127.0.0.1:3112/admin');
  await page.getByRole('button',{name:'تحميل النسخة الجديدة',exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log('Production service worker activated; logo cached once with content revision.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await writeFile(htmlPath,originalHtml);
}
