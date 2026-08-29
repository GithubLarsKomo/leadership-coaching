import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist' },
  server: {
    port: 3010,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3011',
      '/healthz': 'http://127.0.0.1:3011'
    }
  }
});
