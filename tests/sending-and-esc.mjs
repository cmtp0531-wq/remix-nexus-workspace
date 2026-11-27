// 워크챗 검증: 메시지 전송 후 '보내는 중'이 남지 않는지 + 검색창 ESC 닫기
// 사용법: node tests/sending-and-esc.mjs http://127.0.0.1:4174/
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4174/';
const outDir = '/workspace/downloads/nexus-v8-sending-fix';
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`[console] ${m.text()}`);
});

const input = () => page.getByPlaceholder(/메시지 입력/).first();
const send = async (text) => {
  const field = input();
  await field.click();
  await field.fill(text);
  await field.press('Enter');
};

await page.goto(base, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);

// ---------- 1) 로그인 전(게스트) 전송 ----------
const stamp = Date.now();
const desktopMsg = `[로컬 점검] 데스크톱 전송 ${stamp}`;
await send(desktopMsg);
await page.waitForTimeout(700);
const sendingRightAfter = await page.getByText('보내는 중').count();
await page.waitForTimeout(3000);
const sendingAfter = await page.getByText('보내는 중').count();
const desktopVisible = await page.getByText(desktopMsg).count();
record('데스크톱: 전송 직후에도 "보내는 중" 없음(게스트는 즉시 완료)', sendingRightAfter === 0, `count=${sendingRightAfter}`);
record('데스크톱: 3초 뒤 "보내는 중" 없음(전송 완료)', sendingAfter === 0, `count=${sendingAfter}`);
record('데스크톱: 메시지가 화면에 남음', desktopVisible > 0, `count=${desktopVisible}`);
await page.screenshot({ path: `${outDir}/desktop-sent.png` });

// ---------- 2) 새로고침 후에도 '보내는 중' 없음 ----------
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000);
const sendingAfterReload = await page.getByText('보내는 중').count();
record('데스크톱: 새로고침 후 "보내는 중" 없음', sendingAfterReload === 0, `count=${sendingAfterReload}`);
await page.screenshot({ path: `${outDir}/desktop-after-reload.png` });

// ---------- 3) 검색창 ESC 닫기 ----------
await page.keyboard.press('Control+k');
await page.waitForTimeout(600);
const modalOpen = await page.getByPlaceholder(/빠른 이동/).count();
record('검색창: Ctrl+K 로 열림', modalOpen > 0, `count=${modalOpen}`);
await page.screenshot({ path: `${outDir}/desktop-search-open.png` });

// 입력창에 글자를 넣은 상태에서 ESC
await page.getByPlaceholder(/빠른 이동/).fill('테스트');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const modalAfterEsc = await page.getByPlaceholder(/빠른 이동/).count();
record('검색창: ESC 로 즉시 닫힘', modalAfterEsc === 0, `count=${modalAfterEsc}`);
await page.screenshot({ path: `${outDir}/desktop-search-closed.png` });

// 다시 열고 바깥(어두운 영역) 클릭으로 닫기
await page.keyboard.press('Control+k');
await page.waitForTimeout(500);
await page.mouse.click(20, 830);
await page.waitForTimeout(500);
const modalAfterBackdrop = await page.getByPlaceholder(/빠른 이동/).count();
record('검색창: 바깥 클릭으로 닫힘', modalAfterBackdrop === 0, `count=${modalAfterBackdrop}`);

// 설정·연락처 창도 ESC 로 닫히는지 확인
await page.getByRole('button', { name: '설정 열기' }).first().click();
await page.waitForTimeout(700);
const settingsOpen = await page.getByText('게스트(로컬) 모드로 사용 중입니다').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const settingsAfterEsc = await page.getByText('게스트(로컬) 모드로 사용 중입니다').count();
record('설정: ESC 로 닫힘', settingsOpen > 0 && settingsAfterEsc === 0, `open=${settingsOpen}, after=${settingsAfterEsc}`);

await page.getByRole('button', { name: '연락처' }).first().click();
await page.waitForTimeout(700);
const contactsOpen = await page.getByText('내 연락처').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const contactsAfterEsc = await page.getByText('내 연락처').count();
record('연락처: ESC 로 닫힘', contactsOpen > 0 && contactsAfterEsc === 0, `open=${contactsOpen}, after=${contactsAfterEsc}`);

// ---------- 4) 오프라인 전송 → 실패 표시 + 재전송 ----------
await context.setOffline(true);
const offlineMsg = `[로컬 점검] 오프라인 전송 ${stamp}`;
await input().click();
await input().fill(offlineMsg);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const failedBadge = await page.locator('[data-testid^="failed-badge-"]').count();
record('오프라인: "전송 실패"와 재전송 버튼 표시', failedBadge > 0, `count=${failedBadge}`);
await page.screenshot({ path: `${outDir}/desktop-offline-failed.png` });

await context.setOffline(false);
await page.waitForTimeout(1200);
const retryButtons = page.locator('[data-testid^="retry-"]');
const retryCount = await retryButtons.count();
if (retryCount > 0) {
  await retryButtons.last().click();
  await page.waitForTimeout(1500);
}
const failedAfterRetry = await page.locator('[data-testid^="failed-badge-"]').count();
const sendingAfterRetry = await page.getByText('보내는 중').count();
record(
  '오프라인: 연결 복구 후 재전송하면 실패 표시 사라지고 "보내는 중"도 없음',
  failedAfterRetry === 0 && sendingAfterRetry === 0,
  `failed=${failedAfterRetry}, sending=${sendingAfterRetry}, retryButtons=${retryCount}`
);
await page.screenshot({ path: `${outDir}/desktop-after-retry.png` });

// ---------- 4-1) 기기에 '보내는 중'으로 남아 있던 메시지 복구 ----------
// (앱을 끄거나 연결이 끊겨 전송이 끝나지 못한 상태를 흉내냅니다)
await page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.includes('workchat_messages')) continue;
    try {
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      Object.values(map).forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((m) => {
          if (m && m.deliveryStatus === 'sent') m.deliveryStatus = 'sending';
        });
      });
      localStorage.setItem(key, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3500);
const sendingAfterRecovery = await page.getByText('보내는 중').count();
record('남아 있던 "보내는 중" 메시지가 자동 정리됨', sendingAfterRecovery === 0, `count=${sendingAfterRecovery}`);
await page.screenshot({ path: `${outDir}/desktop-stale-recovered.png` });

// ---------- 5) 모바일 뷰포트 ----------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
});
const mpage = await mobile.newPage();
const mobileErrors = [];
mpage.on('pageerror', (e) => mobileErrors.push(String(e)));
await mpage.goto(base, { waitUntil: 'load', timeout: 60000 });
await mpage.waitForTimeout(2500);
const mobileMsg = `[로컬 점검] 모바일 전송 ${stamp}`;
const mfield = mpage.getByPlaceholder(/메시지 입력/).first();
await mfield.click();
await mfield.fill(mobileMsg);
await mfield.press('Enter');
await mpage.waitForTimeout(3500);
const mobileSending = await mpage.getByText('보내는 중').count();
const mobileVisible = await mpage.getByText(mobileMsg).count();
record('모바일: 전송 후 "보내는 중" 없음', mobileSending === 0, `count=${mobileSending}`);
record('모바일: 메시지 표시됨', mobileVisible > 0, `count=${mobileVisible}`);
await mpage.screenshot({ path: `${outDir}/mobile-sent.png` });

// 모바일 검색 ESC: 사이드바를 열어 검색 버튼을 누른 뒤 ESC
await mpage.getByRole('button', { name: /사이드바 열기/ }).first().click();
await mpage.waitForTimeout(700);
await mpage.getByRole('button', { name: /대화, 드라이브, 일정 검색/ }).first().click();
await mpage.waitForTimeout(700);
const mobileModalOpen = await mpage.getByPlaceholder(/빠른 이동/).count();
await mpage.screenshot({ path: `${outDir}/mobile-search-open.png` });
await mpage.getByPlaceholder(/빠른 이동/).fill('모바일');
await mpage.keyboard.press('Escape');
await mpage.waitForTimeout(600);
const mobileModalAfterEsc = await mpage.getByPlaceholder(/빠른 이동/).count();
record('모바일: 검색창 열림', mobileModalOpen > 0, `count=${mobileModalOpen}`);
record('모바일: ESC 로 검색창 닫힘', mobileModalAfterEsc === 0, `count=${mobileModalAfterEsc}`);
await mpage.screenshot({ path: `${outDir}/mobile-search-closed.png` });

const relevantErrors = [...pageErrors, ...mobileErrors].filter(
  (text) => !/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|net::ERR_/i.test(text)
);
record('콘솔/페이지 오류 없음(의도한 오프라인 테스트 제외)', relevantErrors.length === 0, relevantErrors.join(' | ').slice(0, 300));

console.log('\n요약:', results.filter((r) => r.ok).length, '/', results.length, '통과');
await browser.close();
if (results.some((r) => !r.ok)) process.exit(1);
