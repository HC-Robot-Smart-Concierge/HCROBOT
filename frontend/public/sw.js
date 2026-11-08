// Service Worker for HC-Robot PWA
const CACHE_NAME = 'hc-robot-app-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/map.html',
  '/manifest.json',
  '/manifest-login.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const isStandaloneMap = url.pathname === '/map.html' || url.pathname.endsWith('/map.html');

  // Network-First strategy: Luôn ưu tiên lấy bản mới nhất từ Server khi online
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (isStandaloneMap) {
              cache.put('/map.html', copy);
            } else {
              cache.put(event.request, copy);
            }
          });
        }
        return response;
      })
      .catch(async () => {
        // Với trang chỉ đường độc lập (/map.html), luôn ưu tiên bản cache của /map.html (bỏ qua query ?t=...)
        // Tuyệt đối không fallback /map.html về /index.html để tránh nhảy vào trang nhân sự
        if (isStandaloneMap) {
          const cachedMap = await caches.match('/map.html', { ignoreSearch: true });
          if (cachedMap) return cachedMap;
        }
        // Chỉ fallback về cache nếu mất mạng (Offline)
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate' && !isStandaloneMap) {
          return caches.match('/index.html');
        }
        return Response.error();
      })
  );
});
