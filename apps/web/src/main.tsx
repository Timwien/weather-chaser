import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import './styles/global.css';
import { App } from './app.tsx';
import { useAuthStore } from './stores/authStore.ts';

function Root() {
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initialize();
    return unsubscribe;
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
