import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECONNREFUSED'].includes(err.code)) {
              return;
            }
            console.warn('[vite proxy error]:', err.message);
          });
          proxy.on('open', (proxySocket) => {
            proxySocket.on('error', (err) => {
              if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECONNREFUSED'].includes(err.code)) {
                return;
              }
              console.warn('[vite proxy target socket error]:', err.message);
            });
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, clientSocket) => {
            clientSocket.on('error', (err) => {
              if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECONNREFUSED'].includes(err.code)) {
                return;
              }
              console.warn('[vite proxy client socket error]:', err.message);
            });
          });
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'node',
  },
});
