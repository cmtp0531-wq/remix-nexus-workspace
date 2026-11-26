import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const BASE = process.argv[2];
const OUT = '/workspace/downloads/nexus-v5-fix';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
// 테스트 메시지 몇 개
const composer = p.locator('textarea').first();
const texts = ['오늘 회의 3시에 시작해요', '슬라이드 초안 공유했어요 📎', '우주 테마 진짜 예쁘다', '노을 도시 배경도 봐봐'];
for (const t of texts) { await composer.fill(t); await composer.press('Enter'); await p.waitForTimeout(120); }
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/theme-live-cream.png` });

const setTheme = async (theme) => {
  await p.evaluate(() => {
    const btn = document.querySelector('button[aria-label="설정 열기"]');
    btn?.click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '테마·색상');
    btn?.click();
  });
  await p.waitForTimeout(500);
  await p.evaluate((t) => {
    const btn = document.querySelector(`[data-testid="theme-${t}"]`);
    btn?.scrollIntoView({ block: 'center' });
    btn?.click();
  }, theme);
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '닫기');
    btn?.click();
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/theme-live-${theme}.png` });
  console.log('shot', theme);
};

for (const t of ['space', 'aurora', 'city', 'cat', 'puppy', 'winter', 'xmas', 'bubble', 'chic', 'astro', 'cream']) {
  await setTheme(t);
}
await b.close();
