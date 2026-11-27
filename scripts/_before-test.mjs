// 수정 전 라이브 빌드에 깨진 반응 데이터를 넣었을 때의 상태 확인(비교용)
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'https://cmtp0531-wq.github.io/remix-nexus-workspace/';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const now = Date.now();
  localStorage.setItem('workchat_active_scope_v1', 'guest');
  localStorage.setItem(
    'workchat_messages_v6::guest',
    JSON.stringify({
      space_general: [
        {
          id: 'msg_broken_1',
          spaceId: 'space_general',
          senderId: 'guest',
          senderName: '나 (게스트)',
          content: '깨진 반응 메시지',
          timestamp: '오후 1:00',
          reactions: [{ emoji: '👍' }],
          repliesCount: 0,
          createdAt: now - 5000,
        },
      ],
    })
  );
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({
  boundary: document.body.innerText.includes('채팅 화면을 표시하지 못했습니다') || document.body.innerText.includes('채팅 화면 일부를 표시하지 못했습니다'),
  textarea: Boolean(document.querySelector('textarea[placeholder*="메시지 입력"]')),
  text: document.body.innerText.slice(0, 160).replace(/\n/g, ' | '),
}));
console.log('STATE:', JSON.stringify(state));
await page.screenshot({ path: '/workspace/downloads/nexus-v7-poll-chat/before-broken-data.png' });
await browser.close();
