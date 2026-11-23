import { chromium } from 'playwright';
import fs from 'fs';
const target = 'https://cmtp0531-wq.github.io/remix-nexus-workspace/';
const out = '/workspace/downloads/remix-nexus-final';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = {};

async function run(viewport, prefix) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/chrome-extension|jitsi|framatalk|framasoft|gum\.not_found|wake lock|Permissions policy|ERR_UNKNOWN|membersOnly/i.test(t)) errs.push(t.slice(0, 140));
  });
  await p.goto(target, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${prefix}-1-home.png` });

  // 대화 메시지 + 번역 (데스크톱에서 검증)
  const composer = p.locator('textarea').first();
  await composer.fill('Hello team, the meeting starts at ten.');
  await composer.press('Enter');
  await p.waitForTimeout(800);
  const bubble = p.locator('[id^="msg-"]').last();
  if (viewport.width >= 768) await bubble.hover();
  await p.waitForTimeout(300);
  let translated = false;
  if (viewport.width >= 768) {
    await bubble.locator('button[title="메시지 번역 (모든 언어)"]').first().click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${prefix}-2-translate-modal.png` });
    await p.locator('button:has-text("번역")').last().click();
    await p.waitForTimeout(6500);
    await p.locator('[aria-label="닫기"]').last().click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${prefix}-3-translated.png` });
    translated = await p.evaluate(() => document.body.innerText.includes('번역 ·'));
  }

  // 연락처
  if (viewport.width < 768) {
    await p.locator('[data-testid="drawer-toggle"] button').first().click();
    await p.waitForTimeout(700);
  }
  await p.locator('button:has-text("내 연락처")').first().click();
  await p.waitForTimeout(700);
  await p.getByPlaceholder('저장할 이름 (예: 우리팀 지훈)').fill('우리팀 지훈');
  await p.getByRole('button', { name: '저장', exact: true }).first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${prefix}-4-contacts.png` });
  await p.locator('[aria-label="닫기"]').last().click({ force: true }).catch(() => {});
  await p.waitForTimeout(500);

  // 회의
  await p.locator('[data-testid="start-meeting"]').click();
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${out}/${prefix}-5-meeting.png` });
  const meetCard = await p.evaluate(() => {
    try {
      const map = JSON.parse(localStorage.getItem('workchat_messages_v6') || '{}');
      return Object.values(map).flat().flatMap((m) => m.attachments || []).filter((a) => a.type === 'meet').length;
    } catch { return 0; }
  });
  await p.locator('button:has-text("나가기")').first().click().catch(() => {});
  await p.waitForTimeout(700);

  // 유튜브
  await p.getByTitle('YouTube 인앱 미디어 센터 및 동영상 공유').click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${prefix}-6-youtube-empty.png` });
  const emptyState = await p.evaluate(() => document.body.innerText.includes('검색어를 입력해 주세요'));
  await p.getByPlaceholder('검색어 또는 YouTube 링크').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await p.getByPlaceholder('검색어 또는 YouTube 링크').press('Enter');
  await p.waitForTimeout(3500);
  await p.locator('button[title="대화방으로 돌아가기"]').first().click().catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${prefix}-7-youtube-mini.png` });
  const iframes = await p.locator('iframe').count();

  // 슬라이드
  const wsBtn = p.locator('button:has-text("Google Workspace")').first();
  if (!(await wsBtn.isVisible().catch(() => false))) {
    await p.locator('[data-testid="drawer-toggle"] button').first().click();
    await p.waitForTimeout(800);
  }
  await p.screenshot({ path: `${out}/${prefix}-7b-before-slide.png` });
  await wsBtn.click();
  await p.waitForTimeout(700);
  await p.getByText('새 프레젠테이션').first().click();
  await p.waitForTimeout(400);
  await p.locator('button:has-text("생성 및 실시간 편집기 열기")').first().click();
  await p.waitForTimeout(1500);
  await p.locator('[data-testid="panel-elements"]').click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${prefix}-8-shapes-panel.png` });
  const shapes = await p.locator('button[data-testid^="element-"]').count();
  await p.locator('[data-testid="element-star6"]').click();
  await p.waitForTimeout(500);
  if (viewport.width < 768) {
    await p.locator('[data-testid="close-panel"]').click().catch(() => {});
    await p.waitForTimeout(400);
  }
  await p.screenshot({ path: `${out}/${prefix}-9-slide-canvas.png` });

  const overflow = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  await ctx.close();
  return { prefix, shapes, meetCard, emptyState, iframes, translated, overflow, errs };
}

results.desktop = await run({ width: 1440, height: 900 }, 'desktop');
results.mobile = await run({ width: 390, height: 844 }, 'mobile');
console.log(JSON.stringify(results, null, 2));
await browser.close();
