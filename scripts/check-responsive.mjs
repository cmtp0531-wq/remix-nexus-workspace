import { chromium } from 'playwright';
import fs from 'fs';

const target = process.argv[2] || 'http://127.0.0.1:4173/';
const outDir = '/workspace/downloads/nexus-motion-fix';
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  [320, 700],
  [390, 844],
  [600, 600],
  [768, 1024],
  [844, 390],
  [900, 480],
  [1024, 768],
  [1180, 820],
  [1440, 900],
];

const browser = await chromium.launch();

for (const [width, height] of sizes) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900 });
  const page = await context.newPage();
  await page.goto(target, { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const info = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      const overflowRight = r.right - vw;
      const overflowLeft = -r.left;
      const overflowBottom = r.bottom - vh;
      if (overflowRight > 2 || overflowLeft > 2 || overflowBottom > 2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 90),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
          right: Math.round(overflowRight),
          left: Math.round(overflowLeft),
          bottom: Math.round(overflowBottom),
        });
      }
    });
    // 상위 8개만 (중복 방지 위해 깊이 우선 정렬)
    return {
      vw,
      vh,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 12),
      offenderCount: offenders.length,
    };
  });

  console.log(`\n== ${width}x${height} == scrollW=${info.docScrollWidth} offenders=${info.offenderCount}`);
  info.offenders.forEach((o) => console.log(`  ${o.tag} r+${o.right} l+${o.left} b+${o.bottom} | ${o.cls} | ${o.text}`));
  await page.screenshot({ path: `${outDir}/responsive-${width}x${height}.png` });
  await context.close();
}

await browser.close();
