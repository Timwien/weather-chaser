import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devApiPlugin } from './build/vite-api-plugin.ts';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'api');

export default defineConfig({
  plugins: [react(), devApiPlugin(apiDir)],
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
