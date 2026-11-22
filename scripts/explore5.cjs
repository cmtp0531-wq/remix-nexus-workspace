const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const p = document.querySelector('p');
    const cs = p ? getComputedStyle(p) : null;
    const body = getComputedStyle(document.body);
    const fonts = {
      bodyFont: body.fontFamily,
      letterSpacing: body.letterSpacing,
      wordSpacing: body.wordSpacing,
      textAlign: body.textAlign,
      wordBreak: body.wordBreak,
    };
    const pInfo = cs ? { font: cs.fontFamily, ls: cs.letterSpacing, ws: cs.wordSpacing, ta: cs.textAlign, text: (p.textContent || '').slice(0, 40) } : null;
    // 사용 가능한 폰트 체크
    const loaded = Array.from(document.fonts).map((f) => `${f.family}:${f.status}`);
    return { fonts, pInfo, loaded };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
