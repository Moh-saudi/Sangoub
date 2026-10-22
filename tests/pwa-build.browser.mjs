import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Exercise the production worker, which Vite's development server disables.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3112', '--strictPort'], { stdio: 'ignore' });
let browser;
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
    return { active: registration.active?.state, logos: urls.filter(url => url.includes('Capital_Talabat_App_Icon_7e80c871.png')) };
  });
  assert.equal(result.active, 'activated');
  assert.equal(result.logos.length, 1, 'The logo must have exactly one precache entry');
  assert.match(result.logos[0], /__WB_REVISION__=/, 'Public logo must retain content-based cache invalidation');
  await page.route('**/build-info.json?check=*',route=>route.fulfill({json:{id:'test-next-release'}}));
  await page.goto('http://127.0.0.1:3112/admin');
  await page.getByRole('button',{name:'تحميل النسخة الجديدة',exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log('Production service worker activated; logo cached once with content revision.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
