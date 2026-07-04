import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, 'http://localhost:5008',
        changeOrigin: true,
        secure: false,
      },
    },
  },
    proxy: {
      '/api': {
        // Local server. For the deployed backend instead, use https://travel.nakshatranamahacreations.in
        target:
});
