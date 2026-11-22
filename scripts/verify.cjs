const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/workspace/downloads';
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`);
};

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('   [console.error]', m.text().slice(0, 160)); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  /* ---------- 데스크톱 ---------- */
  const { page } = await newPage(browser, { width: 1440, height: 900 });

  const body0 = await page.innerText('body');
  record('로그인 게이트 없이 게스트로 진입', !body0.includes('Firebase에서 Google 로그인 제공자를 활성화'));
  await page.screenshot({ path: `${OUT}/nexus_preview_01_home.png` });

  /* 채팅 + 영속성 */
  const msg = '자동검증 메시지 ' + Date.now();
  const chatInput = page.locator('textarea').first();
  await chatInput.click();
  await chatInput.fill(msg);
  await chatInput.press('Enter');
  await page.waitForTimeout(1200);
  record('채팅 메시지 전송', (await page.innerText('body')).includes(msg));
  await page.screenshot({ path: `${OUT}/nexus_preview_02_chat.png` });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  record('새로고침 후 채팅 유지', (await page.innerText('body')).includes(msg));
  await page.screenshot({ path: `${OUT}/nexus_preview_03_chat_after_reload.png` });

  /* 설정 */
  await page.getByRole('button', { name: '설정 (Gemini 키 · Google 연동 · 데이터)' }).first().click();
  await page.waitForTimeout(700);
  const aiTabText = await page.innerText('body');
  record('설정 → AI 탭 (Gemini 키 입력)', aiTabText.includes('Gemini API 키'));
  await page.screenshot({ path: `${OUT}/nexus_preview_04_settings_ai.png` });

  await page.getByRole('button', { name: 'Google 연동', exact: true }).first().click();
  await page.waitForTimeout(600);
  const googleTabText = await page.innerText('body');
  record('설정 → Google 연동 탭', googleTabText.includes('구글 계정 연결'), googleTabText.includes('내 Firebase 설정') ? 'Firebase 설정 폼 보임' : '');
  await page.screenshot({ path: `${OUT}/nexus_preview_05_settings_google.png` });

  await page.getByRole('button', { name: '데이터', exact: true }).first().click();
  await page.waitForTimeout(500);
  record('설정 → 데이터 탭 (백업)', (await page.innerText('body')).includes('백업 파일'));
  await page.screenshot({ path: `${OUT}/nexus_preview_06_settings_data.png` });
  await page.getByRole('button', { name: '닫기', exact: true }).first().click();
  await page.waitForTimeout(400);

  /* 문서 */
  await page.getByRole('button', { name: '내 드라이브' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: '새 문서 작성' }).first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('예: 프로젝트 기획서').fill('자동검증 기획서');
  await page.getByRole('button', { name: 'Docs', exact: true }).first().click();
  await page.getByRole('button', { name: '생성 후 편집 시작' }).first().click();
  await page.waitForTimeout(1600);

  const docBody = '이 문서는 자동 검증으로 작성되었습니다. 새로고침 후에도 내용이 유지되어야 합니다.';
  // 제목 입력 깜박임(값 덮어쓰기) 검사
  const titleField = page.getByTestId('doc-title');
  await titleField.click();
  await titleField.fill('');
  await page.keyboard.type('제목입력테스트', { delay: 90 });
  await page.waitForTimeout(1200);
  const typedTitle = await page.getByTestId('doc-title').inputValue().catch(() => '');
  record('제목 입력 중 값 유지 (깜박임 없음)', typedTitle === '제목입력테스트', typedTitle);
  await titleField.fill('자동검증 기획서 (수정됨)');
  await page.getByPlaceholder('문서 작성을 시작하세요... (상단 도구 모음 또는 이미지 삽입 지원)').fill(docBody);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/nexus_preview_07_docs.png` });

  const savedDocs = await page.evaluate(() => {
    const raw = localStorage.getItem('gchat_real_drive_docs_v6');
    return raw ? JSON.parse(raw) : [];
  });
  record('문서 본문 자동 저장', savedDocs.some((d) => (d.content || '').includes('자동 검증으로 작성되었습니다')));
  record('문서 제목 자동 저장', savedDocs.some((d) => (d.title || '').includes('자동검증 기획서 (수정됨)')));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '내 드라이브' }).first().click();
  await page.waitForTimeout(1000);
  record('드라이브 목록 유지', (await page.innerText('body')).includes('자동검증 기획서 (수정됨)'));
  await page.getByText('자동검증 기획서 (수정됨)', { exact: false }).first().click();
  await page.waitForTimeout(1500);
  const reopened = await page.locator('textarea').first().inputValue();
  record('새로고침 후 문서 본문 복원', reopened.includes('자동 검증으로 작성되었습니다'));
  await page.screenshot({ path: `${OUT}/nexus_preview_08_docs_after_reload.png` });

  /* 시트 */
  await page.getByRole('button', { name: '구글 시트' }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/nexus_preview_09_sheets.png` });
  const cells = page.locator('table tbody tr td input');
  const cellCount = await cells.count();
  const COLS = 10;
  if (cellCount > 60) {
    // B5 부터 값 입력 (앞쪽 4행은 예시 데이터)
    await cells.nth(4 * COLS + 1).click();
    await page.waitForTimeout(300);
    await page.keyboard.type('10', { delay: 40 });
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.type('20', { delay: 40 });
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await page.keyboard.type('=SUM(B5:B6)', { delay: 60 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    const vals = await page.$$eval('table tbody tr td input', (els) => els.map((e) => e.value));
    record('시트 수식 계산 (=SUM → 30)', vals.includes('30'), vals.filter((v) => v === '30' || v.startsWith('=')).slice(0, 4).join('|'));
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/nexus_preview_10_sheets_formula.png` });
    await page.waitForTimeout(900);
    const sheetStore = await page.evaluate(() => localStorage.getItem('gchat_real_drive_docs_v6') || '');
    record('시트 데이터 자동 저장', sheetStore.includes('=SUM(B5:B6)'));
  } else {
    record('시트 셀 렌더링', false, `cells=${cellCount}`);
  }

  /* 슬라이드 */
  await page.getByRole('button', { name: '구글 슬라이드' }).first().click();
  await page.waitForTimeout(1800);
  record('슬라이드 편집기 열림', /템플릿|프레젠테이션/.test(await page.innerText('body')));
  await page.screenshot({ path: `${OUT}/nexus_preview_11_slides.png` });

  /* AI 패널 (키 없음 상태 안내) */
  await page.getByRole('button', { name: '대화', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Gemini AI', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/nexus_preview_12_gemini_panel.png` });
  const aiPanelText = await page.innerText('body');
  record('Gemini AI 패널 열림', aiPanelText.includes('Gemini') && /비서|AI/.test(aiPanelText));

  /* 모바일 */
  const { page: m } = await newPage(browser, { width: 390, height: 844 });
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${OUT}/nexus_preview_13_mobile_chat.png` });
  record('모바일 뷰 렌더링', (await m.innerText('body')).includes('전체-라운지'));

  await m.getByRole('button', { name: '메뉴 열기' }).first().click().catch(() => {});
  await m.waitForTimeout(700);
  await m.screenshot({ path: `${OUT}/nexus_preview_14_mobile_sidebar.png` });
  await m.getByRole('button', { name: '내 드라이브' }).first().click().catch(() => {});
  await m.waitForTimeout(1200);
  await m.screenshot({ path: `${OUT}/nexus_preview_15_mobile_drive.png` });

  fs.writeFileSync(`${OUT}/nexus_verify_results.json`, JSON.stringify(results, null, 2));
  console.log('\n요약:', results.filter((r) => r.ok).length + '/' + results.length, '통과');
  await browser.close();
})();
