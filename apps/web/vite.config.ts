import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // maplibre-gl embeds its tile worker as a self-contained blob URL.
    // Vite dep-optimization re-bundles it and breaks the worker's internal
    // class-field helpers (__publicField) — "not defined" errors at runtime.
    // Excluding both packages preserves their native ESM import relationship.
    exclude: ['maplibre-gl', '@vis.gl/react-maplibre'],
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
