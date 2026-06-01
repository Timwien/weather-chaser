import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import './styles/global.css';
import { App } from './app.tsx';
import { useAuthStore } from './stores/authStore.ts';
import { initTheme } from './stores/themeStore.ts';

function Root() {
  useEffect(() => {
    const unsubAuth = useAuthStore.getState().initialize();
    const cleanupTheme = initTheme();
    return () => { unsubAuth(); cleanupTheme(); };
  }, []);

  return <App />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
