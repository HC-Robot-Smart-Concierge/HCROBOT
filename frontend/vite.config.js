import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// Chỉ bật SSL khi truyền biến môi trường HTTPS=true (để test cục bộ)
// Mặc định chạy HTTP thuần (http://localhost:3000) an toàn cho Robot, Pi 5 và phần cứng
const enableSsl = process.env.HTTPS === 'true' || process.env.VITE_HTTPS === 'true';

export default defineConfig({
  plugins: [
    react(),
    ...(enableSsl ? [basicSsl()] : []),
  ],
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
            if (err.code !== 'ECONNRESET') {
              console.warn('[vite-proxy]', err.message);
            }
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
