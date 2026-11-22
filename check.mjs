import { chromium } from 'playwright';

const target = process.argv[2] || 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
await page.goto(target, { waitUntil: 'load', timeout: 40000 });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  root: (document.getElementById('root')?.innerHTML || '').length,
  text: (document.body.innerText || '').slice(0, 400),
}));
console.log('ROOT LEN:', info.root);
console.log('TEXT:', info.text.replace(/\n/g, ' | '));
console.log('--- logs ---');
console.log(logs.join('\n'));
await page.screenshot({ path: '/workspace/browser/local_check.png' });
await browser.close();
