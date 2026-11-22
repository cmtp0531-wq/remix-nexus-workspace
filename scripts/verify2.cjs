const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/workspace/downloads';
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  /* AI 패널: 키 없음 안내 */
  await page.getByRole('button', { name: 'Gemini AI', exact: true }).first().click();
  await page.waitForTimeout(900);
  const aiInput = page.locator('textarea').last();
  await aiInput.fill('안녕, 오늘 일정 요약해줘');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const aiText = await page.innerText('body');
  record('Gemini 키 없음 → 안내 문구 표시', aiText.includes('Gemini API 키가 아직 없습니다'));
  await page.screenshot({ path: `${OUT}/nexus_preview_16_gemini_no_key.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  /* 설정에서 Gemini 키 저장 */
  await page.getByRole('button', { name: '설정 (Gemini 키 · Google 연동 · 데이터)' }).first().click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder('AIza... (Google AI Studio API 키)').fill('AIzaSyTESTKEY_for_local_store_only');
  await page.getByRole('button', { name: '저장', exact: true }).first().click();
  await page.waitForTimeout(700);
  const storedKey = await page.evaluate(() => localStorage.getItem('workchat_gemini_api_key_v1'));
  record('설정에서 Gemini 키 저장 (localStorage)', storedKey === 'AIzaSyTESTKEY_for_local_store_only');
  await page.screenshot({ path: `${OUT}/nexus_preview_17_settings_key_saved.png` });
  await page.getByRole('button', { name: '키 삭제' }).first().click();
  await page.waitForTimeout(400);
  record('Gemini 키 삭제', !(await page.evaluate(() => localStorage.getItem('workchat_gemini_api_key_v1'))));
  await page.getByRole('button', { name: '닫기', exact: true }).first().click();
  await page.waitForTimeout(300);

  /* Gmail (게스트) 안내 */
  await page.getByRole('button', { name: 'Gmail 수신함' }).first().click();
  await page.waitForTimeout(2000);
  const gmailText = await page.innerText('body');
  record('Gmail 화면이 게스트에서도 열림(크래시 없음)', gmailText.includes('Gmail') || gmailText.includes('메일'));
  await page.screenshot({ path: `${OUT}/nexus_preview_18_gmail_guest.png` });

  /* 드라이브 화면 */
  await page.getByRole('button', { name: '내 드라이브' }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/nexus_preview_19_drive.png` });
  record('드라이브 화면 열림', (await page.innerText('body')).includes('드라이브'));

  /* 슬라이드 상세 */
  await page.getByRole('button', { name: '구글 슬라이드' }).first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/nexus_preview_20_slides_studio.png` });

  /* 문서: 인쇄/이미지/미리보기 도구 확인 */
  await page.getByRole('button', { name: '구글 독스' }).first().click();
  await page.waitForSelector('text=Google Docs', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const titles = await page.$$eval('button', (els) => els.map((e) => e.getAttribute('title') || e.innerText || '').join(' | '));
  const hasImg = (await page.locator('[title*="이미지"]').count()) > 0 || titles.includes('이미지 삽입');
  const hasPrint = titles.includes('인쇄');
  const hasSave = titles.includes('저장');
  record('독스 도구(이미지 삽입·미리보기·인쇄) 존재', hasImg && hasPrint && hasSave, `img=${hasImg} print=${hasPrint} save=${hasSave} :: ${titles.slice(0, 200)}`);
  await page.screenshot({ path: `${OUT}/nexus_preview_21_docs_tools.png` });

  /* 모바일 상세 */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  await m.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await m.waitForTimeout(1200);
  await m.screenshot({ path: `${OUT}/nexus_preview_22_mobile_home.png` });
  await m.getByRole('button', { name: '메뉴 열기' }).first().click();
  await m.waitForTimeout(700);
  await m.screenshot({ path: `${OUT}/nexus_preview_23_mobile_sidebar.png` });
  await m.getByRole('button', { name: '내 드라이브' }).first().click();
  await m.waitForTimeout(1500);
  await m.screenshot({ path: `${OUT}/nexus_preview_24_mobile_drive.png` });
  const mobileOverflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  record('모바일 가로 스크롤 없음', !mobileOverflow, mobileOverflow ? '가로 오버플로 있음' : '');

  /* 설정 모달 모바일 */
  await m.getByRole('button', { name: '메뉴 열기' }).first().click().catch(() => {});
  await m.waitForTimeout(500);
  await m.getByRole('button', { name: '설정 (Gemini 키 · Google 연동 · 데이터)' }).first().click().catch(() => {});
  await m.waitForTimeout(700);
  await m.screenshot({ path: `${OUT}/nexus_preview_25_mobile_settings.png` });

  const realErrors = errors.filter((e) => !e.includes('/api/') && !e.includes('404 (Not Found)'));
  record('콘솔/페이지 에러 없음 (정적 호스팅의 /api 404 제외)', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  fs.writeFileSync(`${OUT}/nexus_verify_results_extra.json`, JSON.stringify(results, null, 2));
  console.log('\n요약:', results.filter((r) => r.ok).length + '/' + results.length, '통과');
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5));
  await browser.close();
})();
