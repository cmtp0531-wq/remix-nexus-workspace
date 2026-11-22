const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 잘못된 Firebase 설정을 저장한 뒤에도 앱이 열리는지 (게스트 폴백)
  await page.evaluate(() => {
    localStorage.setItem('workchat_custom_firebase_config', JSON.stringify({
      projectId: 'invalid-project-xyz',
      appId: '1:000:web:000',
      apiKey: 'AIzaSyINVALIDKEY',
      authDomain: 'invalid-project-xyz.firebaseapp.com',
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const text = await page.innerText('body');
  const opens = text.includes('전체-라운지');
  console.log((opens ? 'PASS' : 'FAIL') + ' · 잘못된 Firebase 설정에도 게스트로 진입');
  console.log('설정 화면 표시:', text.includes('설정') ? 'yes' : 'no');

  // 설정 모달에서 연결 해제 후 정상 동작
  await page.getByRole('button', { name: '설정 (Gemini 키 · Google 연동 · 데이터)' }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Google 연동', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/workspace/downloads/nexus_preview_26_invalid_firebase.png' });
  const hasDisconnect = await page.getByRole('button', { name: '연결 해제' }).count();
  if (hasDisconnect) {
    await page.getByRole('button', { name: '연결 해제' }).first().click();
    await page.waitForTimeout(400);
  }
  const cleared = await page.evaluate(() => localStorage.getItem('workchat_custom_firebase_config'));
  console.log((cleared === null ? 'PASS' : 'FAIL') + ' · 잘못된 Firebase 설정 연결 해제');
  console.log('pageerrors:', errors.slice(0, 3));
  await browser.close();
})();
