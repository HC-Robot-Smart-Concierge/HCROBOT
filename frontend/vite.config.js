import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const preventEconnresetPlugin = () => ({
  name: 'prevent-econnreset',
  configureServer(server) {
    // Process-level safeguard for unhandled ECONNRESET in dev
    process.on('uncaughtException', (err) => {
      if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED') {
        return;
      }
      console.error('Uncaught Exception:', err);
    });

    server.httpServer?.on('clientError', (err, socket) => {
      if (err?.code === 'ECONNRESET' || !socket.writable) {
        socket.destroy();
        return;
      }
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    server.httpServer?.on('connection', (socket) => {
      socket.on('error', (err) => {
        if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED') {
          return;
        }
      });
    });

    server.httpServer?.on('upgrade', (req, socket, head) => {
      socket.on('error', (err) => {
        if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED') {
          return;
        }
      });
    });
  },
});

export default defineConfig({
  plugins: [react(), preventEconnresetPlugin()],
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
            if (err?.code === 'ECONNRESET') return;
            console.warn('[Vite Proxy]', err.message);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', (err) => {
              if (err?.code === 'ECONNRESET') return;
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

