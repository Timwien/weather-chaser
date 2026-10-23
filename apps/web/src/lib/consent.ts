// Opt-in consent for analytics (§ 25 TDDDG / Art. 6(1)(a) GDPR).
//
// Default is "not decided" = nothing loaded, nothing sent. The decision is kept
// in localStorage (wc_consent_analytics). If storage is unavailable the user is
// asked again next time, and the in-session decision still holds.

import { create } from 'zustand';
import { disableAnalytics, enableAnalytics } from './analytics.ts';
import { useAuthStore } from '../stores/authStore.ts';

export const CONSENT_KEY = 'wc_consent_analytics';
/** Bump when the purposes change materially → everyone is asked again. */
export const CONSENT_VERSION = 1;

export type ConsentChoice = 'granted' | 'denied';

/** Read the persisted decision; null = undecided / outdated / storage unavailable. */
export function readStoredConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: unknown; version?: unknown };
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed.value === 'granted' || parsed.value === 'denied' ? parsed.value : null;
  } catch {
    return null;
  }
}

function persist(choice: ConsentChoice): void {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ value: choice, ts: new Date().toISOString(), version: CONSENT_VERSION }),
    );
  } catch {
    /* storage unavailable: decision holds for this session only */
  }
}

interface ConsentState {
  /** null = not decided yet (denied in effect). */
  choice: ConsentChoice | null;
  /** Banner visible (undecided, or reopened from settings). */
  bannerOpen: boolean;
  accept: () => void;
  decline: () => void;
  openBanner: () => void;
}

export const useConsentStore = create<ConsentState>((set) => ({
  choice: null,
  bannerOpen: false,
  accept: () => {
    persist('granted');
    set({ choice: 'granted', bannerOpen: false });
    enableAnalytics(useAuthStore.getState().user?.id ?? null);
  },
  decline: () => {
    persist('denied');
    set({ choice: 'denied', bannerOpen: false });
    disableAnalytics();
  },
  openBanner: () => set({ bannerOpen: true }),
}));

/** Call once at startup: restore the decision; ask if there is none. */
export function initConsent(): void {
  const stored = readStoredConsent();
  if (stored === 'granted') {
    useConsentStore.setState({ choice: 'granted', bannerOpen: false });
    enableAnalytics(useAuthStore.getState().user?.id ?? null);
  } else if (stored === 'denied') {
    useConsentStore.setState({ choice: 'denied', bannerOpen: false });
  } else {
    useConsentStore.setState({ choice: null, bannerOpen: true });
  }
}
