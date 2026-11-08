import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import os from 'os';

const detectHostNetworkIps = () => {
  let tailscaleIp = '';
  let lanIp = '';
  try {
    const interfaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!Array.isArray(addrs)) continue;
      for (const addr of addrs) {
        if (!addr || addr.internal || addr.family !== 'IPv4') continue;
        const ip = addr.address;
        if (ip.startsWith('100.') || name.toLowerCase().includes('tailscale')) {
          if (!tailscaleIp) tailscaleIp = ip;
        } else if (
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
        ) {
          if (!lanIp || name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) {
            lanIp = ip;
          }
        }
      }
    }
  } catch {
    // ignore network detection error
  }
  return {
    tailscaleIp: tailscaleIp || '100.64.240.42',
    lanIp: lanIp || '192.168.1.149',
  };
};

const detectedIps = detectHostNetworkIps();

const customLogger = createLogger();
const originalError = customLogger.error.bind(customLogger);
customLogger.error = (msg, options) => {
  if (
    (typeof msg === 'string' && msg.includes('ws proxy socket error')) ||
    options?.error?.code === 'ECONNRESET' ||
    options?.error?.code === 'ECONNABORTED'
  ) {
    return;
  }
  originalError(msg, options);
};

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
  customLogger,
  define: {
    __DETECTED_TAILSCALE_IP__: JSON.stringify(detectedIps.tailscaleIp),
    __DETECTED_LAN_IP__: JSON.stringify(detectedIps.lanIp),
  },
  plugins: [react(), basicSsl(), preventEconnresetPlugin()],
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tensorflow') || id.includes('@mediapipe')) {
              return 'vendor-vision';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor-core';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
});

