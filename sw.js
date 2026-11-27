// Remix Nexus 서비스 워커
// - 앱 셸 정적 자산을 캐시해 재방문 시 즉시 로딩 (체감 로그인/진입 시간 단축)
// - 미디어(YouTube iframe)는 캐시하지 않고 네트워크로 그대로 전달합니다.
const CACHE = 'nexus-shell-v2';
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
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
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
