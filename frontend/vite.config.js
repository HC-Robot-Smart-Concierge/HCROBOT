import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
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

