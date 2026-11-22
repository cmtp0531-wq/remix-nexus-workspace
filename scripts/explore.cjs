const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[console.error] ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const inputs = await page.$$eval('input, textarea, [contenteditable="true"]', (els) =>
    els.map((e) => ({ tag: e.tagName, ph: e.getAttribute('placeholder'), type: e.getAttribute('type'), cls: (e.className || '').toString().slice(0, 60) }))
  );
  console.log('INPUTS:', JSON.stringify(inputs, null, 1));

  const buttons = await page.$$eval('button', (els) => els.map((e) => (e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  console.log('BUTTONS:', JSON.stringify(buttons.slice(0, 80), null, 0));
  console.log('ERRORS:', logs.slice(0, 10));
  await browser.close();
})();
