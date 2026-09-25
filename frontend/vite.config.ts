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
  build: {
    // Vendor kutubxonalarni alohida chunklarga bo'lish — brauzer keshini
    // yaxshilaydi (kod o'zgarganda vendor qayta yuklanmaydi) va route
    // lazy-loading bilan birgalikda boshlang'ich yukni kamaytiradi.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['react-query'],
          'chart-vendor': ['recharts'],
          'util-vendor': ['date-fns', 'clsx', 'axios'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
    },
  },
});
