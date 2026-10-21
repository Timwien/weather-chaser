import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import './styles/global.css';
import { App } from './app.tsx';
import { AppErrorBoundary } from './components/common/AppErrorBoundary.tsx';
import { useAuthStore } from './stores/authStore.ts';
import { initTheme } from './stores/themeStore.ts';
import { initAnalytics } from './lib/analytics.ts';
import { registerGlobalErrorHandlers } from './lib/logger.ts';

// After a deploy, lazy chunks of the old build are gone and the SPA rewrite
// serves index.html instead → the dynamic import fails. Reload once to pick up
// the new build; the timestamp guard prevents a reload loop if it keeps failing.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('wc_chunk_reload') ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('wc_chunk_reload', String(Date.now()));
  } catch {
    // Storage unavailable: without the guard a reload could loop, so let the
    // error boundary handle it instead.
    return;
  }
  event.preventDefault();
  window.location.reload();
});

function Root() {
  useEffect(() => {
    // Both idempotent (guarded against StrictMode double-mount); no cleanup.
    initAnalytics();
    registerGlobalErrorHandlers();
    const unsubAuth = useAuthStore.getState().initialize();
    const cleanupTheme = initTheme();
    return () => { unsubAuth(); cleanupTheme(); };
  }, []);

  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
