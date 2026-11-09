/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The local Express proxy listens on 3001. Set VITE_DEV_PROXY_TARGET when that port is taken.
const localDevProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:3001';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/weekly-schedule/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Registered ahead of Vite's base middleware, so /api is not trapped under /weekly-schedule/.
      '/api': {
        target: localDevProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
