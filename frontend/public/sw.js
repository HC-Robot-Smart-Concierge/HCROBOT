// Service Worker for HC-Robot PWA
const CACHE_NAME = 'hc-robot-app-cache-v3';
const ASSETS_TO_CACHE = [
  '/map.html',
  '/manifest.json',
  '/manifest-login.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
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

  // Không bao giờ cache các module Vite dev (/src/, /node_modules/, /@vite/) để tránh lỗi giữ code cũ trên mobile
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@')
  ) {
    return;
  }

  const isStandaloneMap =
    url.pathname === '/map.html' ||
    url.pathname.endsWith('/map.html') ||
    url.searchParams.has('t') ||
    url.searchParams.has('dest');

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && isStandaloneMap && url.pathname.endsWith('/map.html')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/map.html', copy));
        }
        return response;
      })
      .catch(async () => {
        if (isStandaloneMap) {
          const cachedMap = await caches.match('/map.html', { ignoreSearch: true });
          if (cachedMap) return cachedMap;
        }
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return Response.error();
      })
  );
});
