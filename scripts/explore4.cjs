const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '설정 (Gemini 키 · Google 연동 · 데이터)' }).first().click();
  await page.waitForTimeout(800);
  const html = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div'));
    const modal = all.find((d) => d.className && String(d.className).includes('max-w-lg'));
    if (!modal) return 'NOT FOUND';
    const box = modal.getBoundingClientRect();
    const children = Array.from(modal.children).map((c) => {
      const r = c.getBoundingClientRect();
      return { cls: String(c.className).slice(0, 60), h: Math.round(r.height), w: Math.round(r.width) };
    });
    return JSON.stringify({ box: { w: Math.round(box.width), h: Math.round(box.height) }, children, html: (modal.children[2] ? modal.children[2].innerHTML.slice(0, 800) : 'no child3'), text: (modal.children[2] ? modal.children[2].innerText.slice(0, 300) : '') }, null, 1);
  });
  console.log(html);
  await browser.close();
})();
