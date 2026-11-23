import { chromium } from 'playwright';
import fs from 'fs';

const target = process.argv[2];
const outDir = '/workspace/downloads/nexus-verify';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(2500);

// --- 연락처 이름 변경 + 중복 방지 ---
await page.getByRole('button', { name: /내 연락처/ }).first().click();
await page.waitForTimeout(800);
const opened = await page.evaluate(() => document.body.innerText.includes('이름을 원하는 대로 저장하세요'));
const nameInput = page.getByPlaceholder('저장할 이름 (예: 우리팀 지훈)');
await nameInput.fill('우리팀 지훈');
await page.getByPlaceholder('상대방 이메일 (중복 확인)').fill('jihun@example.com');
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.waitForTimeout(600);
const firstSaved = await page.evaluate(() => document.body.innerText.includes('우리팀 지훈'));
// 같은 이메일(대소문자만 다름)로 다시 저장 → 중복 생성 없이 이름만 갱신
await nameInput.fill('지훈(별명)');
await page.getByPlaceholder('상대방 이메일 (중복 확인)').fill('JIHUN@Example.com');
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.waitForTimeout(700);
const hint = await page.evaluate(() => document.body.innerText.includes('이미 연락처에 있습니다'));
const rowCount = await page.evaluate(() => document.querySelectorAll('input[placeholder="저장할 이름 (예: 우리팀 지훈)"]').length);
const listNames = await page.evaluate(() => Array.from(document.querySelectorAll('div')).filter((d) => /지훈/.test(d.textContent || '') && d.children.length === 0).map((d) => d.textContent));
const stored = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.startsWith('nexus_contacts_v1_'));
  return key ? JSON.parse(localStorage.getItem(key) || '[]').length : -1;
});
await page.screenshot({ path: `${outDir}/desktop-14-contacts-live.png` });
console.log(JSON.stringify({ opened, firstSaved, hint, rowCount, listNames: listNames.slice(0, 3), storedContacts: stored }));
await page.locator('[aria-label="닫기"]').last().click({ force: true }).catch(() => {});
await page.waitForTimeout(500);

// --- 회의: 매번 새 회의가 생성되는지 ---
await page.locator('[data-testid="start-meeting"]').click();
await page.waitForTimeout(3500);
const code1 = await page.evaluate(() => {
  const map = JSON.parse(localStorage.getItem('workchat_messages_v6') || '{}');
  const meets = Object.values(map).flat().flatMap((m) => m.attachments || []).filter((a) => a.type === 'meet');
  return meets.map((m) => m.meetCode).filter(Boolean);
});
await page.locator('button:has-text("새 회의 만들기")').first().click();
await page.waitForTimeout(4000);
const code2 = await page.evaluate(() => {
  const map = JSON.parse(localStorage.getItem('workchat_messages_v6') || '{}');
  const meets = Object.values(map).flat().flatMap((m) => m.attachments || []).filter((a) => a.type === 'meet');
  return meets.map((m) => m.meetCode).filter(Boolean);
});
await page.screenshot({ path: `${outDir}/desktop-15-meeting-live.png` });
console.log(JSON.stringify({ meetings: code1.length, uniqueCodes: new Set([...code1, ...code2]).size, first: code1[0], second: code2[code2.length - 1] }));
await page.locator('button:has-text("나가기")').first().click().catch(() => {});
await page.waitForTimeout(600);

// --- 유튜브 재생 + 화면 전환 유지 ---
await page.getByTitle('YouTube 인앱 미디어 센터 및 동영상 공유').click();
await page.waitForTimeout(1200);
const ytInput = page.getByPlaceholder('검색어 또는 YouTube 링크');
await ytInput.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
await ytInput.press('Enter');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/desktop-16-youtube-live.png` });
const before = await page.locator('iframe').count();
await page.locator('button[title="대화방으로 돌아가기"]').first().click();
await page.waitForTimeout(1500);
const after = await page.locator('iframe').count();
const mini = await page.evaluate(() => document.body.innerText.includes('영상 화면으로 이동') || document.body.innerText.includes('소리'));
await page.screenshot({ path: `${outDir}/desktop-17-youtube-mini-live.png` });
console.log(JSON.stringify({ iframeBefore: before, iframeAfter: after, miniVisible: mini, pageErrors: errors.length }));

await browser.close();
