import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFont, initTheme } from './theme';

// 저장된 테마·글씨체를 첫 페인트 전에 적용해 깜박임을 막습니다.
initTheme();
initFont();

createRoot(document.getElementById('root')!).render(<App />);

// PWA 서비스 워커: 재방문 시 앱 셸을 캐시에서 즉시 로드합니다.
// (설치형 앱/백그라운드 재생 안내에 필요한 매니페스트와 함께 동작)
// 새 빌드가 올라오면 화면을 오래 켜 둔 기기(휴대폰 PWA 등)가 옛 코드로 남아
// 이미 고친 버그가 계속 보이는 일이 있어, 새 버전이 준비되면 알려 줍니다.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const announceUpdate = () => window.dispatchEvent(new CustomEvent('nexus-update-ready'));
  navigator.serviceWorker.addEventListener('controllerchange', announceUpdate);
  navigator.serviceWorker.addEventListener('message', (event) => {
    if ((event.data as { type?: string } | null)?.type === 'NEXUS_SW_UPDATED') announceUpdate();
  });

  window.addEventListener('load', () => {
    const register = () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .then((registration) => {
          const watch = (worker: ServiceWorker | null) => {
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
            });
          };
          registration.addEventListener('updatefound', () => watch(registration.installing));
          watch(registration.installing);
          // 앱으로 돌아올 때마다 새 빌드가 있는지 확인합니다.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
          });
          registration.update().catch(() => undefined);
        })
        .catch((error) => console.warn('[SW] registration skipped:', error));
    };
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(register, { timeout: 3000 });
    } else {
      window.setTimeout(register, 1200);
    }
  });
}
