// Remix Nexus 서비스 워커
// - 앱 셸 정적 자산을 캐시해 재방문 시 즉시 로딩 (체감 로그인/진입 시간 단축)
// - 미디어(YouTube iframe)는 캐시하지 않고 네트워크로 그대로 전달합니다.
// - 새 빌드로 교체되면 열려 있는 화면에 알려 새로고침을 안내합니다.
//   (휴대폰에 앱처럼 띄워 둔 화면이 옛 코드로 남아 이미 고친 버그가 계속 보이던 문제 방지)
const CACHE = 'nexus-shell-DGQY9hZ1-mwywcqeq';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // 이전 버전의 캐시가 남아 있다면 = 새 빌드로 교체되는 중입니다.
      const isUpgrade = keys.some((key) => key !== CACHE);
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();

      if (!isUpgrade) return;
      // 열려 있는 화면에 새 버전이 준비됐다고 알립니다.
      // (화면을 프로그램으로 강제 새로고침하면 입력 중인 내용을 잃거나 로딩이 멈출 수 있어,
      //  새로고침은 화면 쪽에서 안내 후 사용자가/백그라운드 전환 시 하도록 둡니다.)
      const clientList = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        clientList.map(async (client) => {
          try {
            client.postMessage({ type: 'NEXUS_SW_UPDATED', version: CACHE });
          } catch {
            /* 개별 화면 실패는 무시 */
          }
        })
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 다른 출처(YouTube, Google API, 번역 등)는 절대 가로채지 않습니다.
  if (url.origin !== self.location.origin) return;

  // 탐색 요청: 네트워크 우선, 실패 시 캐시된 셸 제공
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // 해시가 붙은 정적 자산: 캐시 우선
  if (url.pathname.includes('/assets/') || /\.(?:css|js|woff2?|png|jpg|svg|webp)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        });
      })
    );
  }
});
