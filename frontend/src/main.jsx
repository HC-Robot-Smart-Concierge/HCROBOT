import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import './index.css';

// Tự động reload khi gặp lỗi chunk preload sau khi deploy bản mới
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('vite_preload_retry')) {
    sessionStorage.setItem('vite_preload_retry', '1');
    window.location.reload();
  }
});

// Chỉ bật Service Worker ở bản build Production; ở môi trường Dev (npm run dev), tự động gỡ SW cũ và xóa cache để tránh kẹt trang chủ trên điện thoại.
const shouldEnablePwa = Boolean(import.meta.env.PROD);

if ('serviceWorker' in navigator) {
  if (!shouldEnablePwa) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let hadController = Boolean(navigator.serviceWorker.controller);
      Promise.all(registrations.map((reg) => reg.unregister())).then((results) => {
        if (window.caches) {
          window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k)));
        }
        if (hadController && results.some(Boolean) && !sessionStorage.getItem('aurora_sw_purged')) {
          sessionStorage.setItem('aurora_sw_purged', '1');
          window.location.reload();
        }
      });
    }).catch(() => {});
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
        registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      }).catch((err) => {
        console.warn('PWA SW registration failed:', err);
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ErrorBoundary>,
);

