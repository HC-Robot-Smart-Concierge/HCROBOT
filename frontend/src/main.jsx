import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import './index.css';

// Production builds and HTTPS tunnels both need a service worker for installation.
const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
const shouldEnablePwa = import.meta.env.PROD
  || (window.isSecureContext && !localHostnames.has(window.location.hostname));

if ('serviceWorker' in navigator && shouldEnablePwa) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((err) => {
      console.warn('PWA SW registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

