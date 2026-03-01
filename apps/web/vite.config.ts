import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // MapLibre GL embeds its tile worker as a self-contained blob URL.
    // Vite's dep optimization re-bundles it and breaks the worker's internal
    // class-field helpers (__publicField), causing "not defined" errors.
    // Excluding it preserves the original pre-built bundle as-is.
    exclude: ['maplibre-gl'],
  },
});
