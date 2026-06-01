import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'wc-theme';

function readStoredMode(): ThemeMode {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', resolve(mode));
}

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  resolved: resolve(readStoredMode()),
  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    set({ mode, resolved: resolve(mode) });
  },
}));

/** Apply current theme and keep it in sync with the OS while in 'system' mode. Returns cleanup. */
export function initTheme(): () => void {
  applyTheme(useThemeStore.getState().mode);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (useThemeStore.getState().mode === 'system') {
      applyTheme('system');
      useThemeStore.setState({ resolved: resolve('system') });
    }
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
