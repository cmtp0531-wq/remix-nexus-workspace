const { chromium } = require('/workspace/work/nexus-workspace/node_modules/playwright');

(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:8899/remix-nexus-workspace/';
  const shot = process.argv[3] || '/workspace/downloads/nexus_local_subpath.png';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  const failed = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`); });
  const resp = await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  console.log('STATUS:', resp && resp.status());
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('BODY:', (await page.innerText('body')).slice(0, 900).replace(/\n+/g, ' | '));
  const assets = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.(js|css)$/.test(r.name)).map(r => `${r.name} ${Math.round(r.transferSize)}b ${Math.round(r.duration)}ms`));
  console.log('ASSETS:', assets.join(' ; '));
  console.log('FAILED:', failed.length ? failed.join('\n') : 'none');
  console.log('CONSOLE:', logs.slice(0, 20).join('\n') || 'none');
  await page.screenshot({ path: shot });
  console.log('SHOT:', shot);
  await browser.close();
})();
