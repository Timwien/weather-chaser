import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';

// NOTE: keep STORAGE_KEY, the 'system' default, and the resolve rule in sync with
// the pre-paint anti-FOUC script in apps/web/index.html (intentional duplication —
// that script must run before this module loads, so it can't import from here).
const STORAGE_KEY = 'wc-theme';

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* localStorage unavailable (private mode, disabled) — fall through */
  }
  return 'system';
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode;
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', resolve(mode));
}

interface ThemeState {
  mode: ThemeMode;
  /** The effective theme after resolving 'system' — consumers (e.g. the map
   *  style switch) subscribe to this instead of re-deriving matchMedia. */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  resolved: resolve(readStoredMode()),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* persistence best-effort — still apply for this session */
    }
    applyTheme(mode);
    set({ mode, resolved: resolve(mode) });
  },
}));

/**
 * Apply the current theme and keep it in sync with the OS (while in 'system')
 * and across tabs (via the storage event). Returns a cleanup function.
 */
export function initTheme(): () => void {
  applyTheme(useThemeStore.getState().mode);

  const mq =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onOSChange = () => {
    if (useThemeStore.getState().mode === 'system') {
      applyTheme('system');
      useThemeStore.setState({ resolved: resolve('system') });
    }
  };
  mq?.addEventListener('change', onOSChange);

  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key !== STORAGE_KEY) return;
    const next = readStoredMode();
    useThemeStore.setState({ mode: next, resolved: resolve(next) });
    applyTheme(next);
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return () => {
    mq?.removeEventListener('change', onOSChange);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
