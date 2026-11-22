const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[console.error] ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: '내 드라이브' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/workspace/downloads/tmp_drive.png' });

  await page.getByRole('button', { name: '새 문서 작성' }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/workspace/downloads/tmp_create_modal.png' });
  const inputs = await page.$$eval('input, textarea', (els) =>
    els.map((e) => ({ tag: e.tagName, ph: e.getAttribute('placeholder'), type: e.getAttribute('type'), vis: !!(e.offsetWidth || e.offsetHeight) })).filter((x) => x.vis)
  );
  console.log('MODAL INPUTS:', JSON.stringify(inputs));
  const modals = await page.$$eval('button', (els) => els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  console.log('MODAL BUTTONS:', JSON.stringify(modals.slice(-25)));
  console.log('ERRORS:', logs.slice(0, 10));
  await browser.close();
})();
