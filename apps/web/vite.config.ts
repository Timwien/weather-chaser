import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  server: {
    proxy: {
      // Proxy local OSRM requests through the dev server to avoid CORS.
      // Set VITE_OSRM_URL=/osrm (default) or override with a remote URL.
      '/osrm': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm/, ''),
      },
    },
  },
});
