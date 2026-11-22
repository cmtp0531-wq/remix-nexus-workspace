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
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '새 문서 작성' }).first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('예: 프로젝트 기획서').fill('테스트 기획서');
  await page.getByRole('button', { name: 'Docs', exact: true }).first().click();
  await page.getByRole('button', { name: '생성 후 편집 시작' }).first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '/workspace/downloads/tmp_doc_editor.png' });

  const inputs = await page.$$eval('input, textarea, [contenteditable="true"]', (els) =>
    els.map((e) => ({ tag: e.tagName, ph: e.getAttribute('placeholder'), val: (e.value || '').slice(0, 20), cls: (e.className || '').toString().slice(0, 80), vis: !!(e.offsetWidth || e.offsetHeight) })).filter((x) => x.vis)
  );
  console.log('EDITOR INPUTS:', JSON.stringify(inputs, null, 1));
  const btns = await page.$$eval('button', (els) => els.map((e) => (e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  console.log('EDITOR BUTTONS:', JSON.stringify(btns))
  const store = await page.evaluate(() => Object.keys(localStorage));
  console.log('LS KEYS:', store);
  console.log('DOCS:', await page.evaluate(() => localStorage.getItem('gchat_real_drive_docs_v6')));
  console.log('ERRORS:', logs.slice(0, 10));
  await browser.close();
})();
