import { chromium } from 'playwright';
import fs from 'fs';

const target = process.argv[2];
const outDir = '/workspace/downloads/nexus-verify';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

async function shot(viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/chrome-extension:|jitsi|ERR_UNKNOWN_URL_SCHEME/i.test(t)) errors.push(t.slice(0, 160));
  });
  await page.goto(target, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${tag}-home.png` });

  // 슬라이드 도형 패널
  if (viewport.width < 768) {
    await page.locator('[data-testid="drawer-toggle"] button').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/${tag}-drawer.png` });
  }
  await page.locator('button:has-text("Google Workspace")').first().click();
  await page.waitForTimeout(700);
  await page.getByText('새 프레젠테이션').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("생성 및 실시간 편집기 열기")').first().click();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="panel-elements"]').click();
  await page.waitForTimeout(400);
  const shapes = await page.locator('button[data-testid^="element-"]').count();
  await page.locator('[data-testid="element-pentagon"]').click();
  await page.waitForTimeout(500);
  if (viewport.width < 768) {
    await page.locator('[data-testid="close-panel"]').click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${outDir}/${tag}-slide-shapes.png` });
  const editorErrors = errors.slice(0, 3);

  // 나가기
  await page.locator('[title="에디터 닫기"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('[title="작업실을 닫고 대화창으로 돌아갑니다"]').first().click().catch(() => {});
  await page.waitForTimeout(600);

  // 회의실
  await page.locator('[data-testid="start-meeting"]').click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/${tag}-meeting.png` });
  const meeting = await page.evaluate(() => ({
    iframe: !!document.querySelector('iframe[title="nexus-meeting"]'),
    card: (() => {
      try {
        const map = JSON.parse(localStorage.getItem('workchat_messages_v6') || '{}');
        return Object.values(map).flat().flatMap((m) => m.attachments || []).filter((a) => a.type === 'meet').length;
      } catch {
        return 0;
      }
    })(),
  }));
  await page.locator('button:has-text("나가기")').first().click().catch(() => {});
  await page.waitForTimeout(600);

  // 유튜브
  await page.getByTitle('YouTube 인앱 미디어 센터 및 동영상 공유').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${tag}-youtube-empty.png` });
  const empty = await page.evaluate(() => document.body.innerText.includes('검색어를 입력해 주세요'));
  const input = page.getByPlaceholder('검색어 또는 YouTube 링크');
  await input.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await input.press('Enter');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/${tag}-youtube-playing.png` });
  await page.locator('button[title="대화방으로 돌아가기"]').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const iframeAfter = await page.locator('iframe').count();
  await page.screenshot({ path: `${outDir}/${tag}-youtube-mini.png` });

  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  await ctx.close();
  return { tag, shapes, meeting, empty, iframeAfter, overflow, errors };
}

const desk = await shot({ width: 1440, height: 900 }, 'final-desktop');
const mob = await shot({ width: 390, height: 844 }, 'final-mobile');
console.log(JSON.stringify({ desk, mob }, null, 2));
await browser.close();
