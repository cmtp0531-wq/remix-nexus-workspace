import { chromium } from 'playwright';
const BASE='https://cmtp0531-wq.github.io/remix-nexus-workspace/';
const OUT='/workspace/downloads/nexus-v5-fix';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto(BASE,{waitUntil:'load'}); await p.waitForTimeout(3500);
await p.evaluate(()=>document.querySelector('button[aria-label="설정 열기"]')?.click());
await p.waitForTimeout(700);
await p.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>(b.textContent||'').trim()==='테마·색상')?.click());
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-testid="theme-wallpaper-card"]')?.scrollIntoView({block:'center'}));
await p.waitForTimeout(600);
await p.screenshot({path:`${OUT}/live-05-wallpaper-card.png`});
// 우주 테마 + 배경화면 space 선택 상태
await p.evaluate(()=>document.querySelector('[data-testid="wallpaper-space"]')?.click());
await p.waitForTimeout(800);
await p.screenshot({path:`${OUT}/live-06-wallpaper-space-selected.png`});
await b.close();
