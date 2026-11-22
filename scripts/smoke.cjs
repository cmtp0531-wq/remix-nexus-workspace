const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/workspace/downloads/nexus_preview_smoke.png', fullPage: false });
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('BODY TEXT (first 1200):');
  console.log((await page.innerText('body')).slice(0, 1200));
  console.log('--- console ---');
  console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
