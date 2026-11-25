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
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    const register = () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch((error) => console.warn('[SW] registration skipped:', error));
    };
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(register, { timeout: 3000 });
    } else {
      window.setTimeout(register, 1200);
    }
  });
}
