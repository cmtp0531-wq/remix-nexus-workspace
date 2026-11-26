import { chromium } from 'playwright';

const target = process.argv[2] || 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const scan = async (label) => {
  const data = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('button, [role="button"]').forEach((b) => {
      const icon = b.querySelector('svg')?.getAttribute('class')?.match(/lucide-([a-z0-9-]+)/)?.[1] || '';
      const text = (b.getAttribute('title') || b.getAttribute('aria-label') || b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (icon) rows.push({ icon, text });
    });
    return rows;
  });
  const grouped = {};
  data.forEach(({ icon, text }) => {
    grouped[icon] = grouped[icon] || new Set();
    if (text) grouped[icon].add(text);
  });
  const conflicts = Object.entries(grouped)
    .map(([icon, set]) => ({ icon, labels: Array.from(set) }))
    .filter((g) => g.labels.length > 1)
    .sort((a, b) => b.labels.length - a.labels.length);
  console.log(`--- ${label}: ${conflicts.length} icons with multiple labels`);
  conflicts.forEach((c) => console.log(`  ${c.icon}: ${JSON.stringify(c.labels)}`));
};

await scan('main');
await page.locator('[aria-label="왼쪽 서랍 토글"]').first().click();
await page.waitForTimeout(500);
await page.locator('[aria-label="왼쪽 서랍 토글"]').first().click();
await page.waitForTimeout(500);

// 메시지 호버 액션
const composer = page.locator('textarea').first();
await composer.click();
await composer.fill('아이콘 점검용 메시지');
await composer.press('Enter');
await page.waitForTimeout(900);
await page.locator('[id^="msg-"]').last().hover();
await page.waitForTimeout(400);
await scan('message-actions');

await browser.close();
