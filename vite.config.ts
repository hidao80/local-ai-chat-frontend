/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api/gpt4all': {
        target: 'http://localhost:4891',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gpt4all/, '')
      }
    }
  },
  plugins: [
    react(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/**/*.test.ts'],
    },
  },
});
