import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3114';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3114', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { const response = await fetch(base); if (response.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const persistentFailure of [false, true]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    let requests = 0, navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await page.route('**/assets/AdminApp-*.css', async route => {
      requests++;
      if (requests === 1 || persistentFailure) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Asset from previous release not found' });
      return route.continue();
    });
    await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' }).catch(error => { if (!error.message.includes('interrupted')) throw error; });
    if (persistentFailure) {
      await page.getByRole('alert').filter({ hasText: 'تعذر تحميل ملفات الصفحة' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'تحديث الصفحة', exact: true }).isVisible(), true);
    } else {
      await page.getByRole('heading', { name: 'تسجيل دخول الإدارة', exact: true }).waitFor();
      assert.equal(await page.locator('.admin-signin-main').evaluate(element => getComputedStyle(element).display), 'grid');
    }
    assert.equal(requests, 2, 'The failed stylesheet is fetched again on one automatic reload');
    assert.equal(navigations, 2, 'No automatic reload loop');
    await context.close();
  }
  console.log('Missing CSS with text/plain recovers once; persistent failure offers an accessible manual retry without looping.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
