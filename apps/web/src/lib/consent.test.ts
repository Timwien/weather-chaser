import { describe, it, expect, beforeEach, vi } from 'vitest';

const mem = new Map<string, string>();
let storageBroken = false;
vi.stubGlobal('localStorage', {
  getItem: (k: string) => { if (storageBroken) throw new Error('denied'); return mem.get(k) ?? null; },
  setItem: (k: string, v: string) => { if (storageBroken) throw new Error('denied'); mem.set(k, v); },
});

const analytics = { enableAnalytics: vi.fn(), disableAnalytics: vi.fn() };
vi.mock('./analytics.ts', () => analytics);
vi.mock('../stores/authStore.ts', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'u1' } }) },
}));

const { useConsentStore, initConsent, readStoredConsent, CONSENT_KEY, CONSENT_VERSION } = await import('./consent.ts');

describe('consent store', () => {
  beforeEach(() => {
    mem.clear();
    storageBroken = false;
    analytics.enableAnalytics.mockClear();
    analytics.disableAnalytics.mockClear();
    useConsentStore.setState({ choice: null, bannerOpen: false });
  });

  it('asks and loads nothing when undecided', () => {
    initConsent();
    expect(useConsentStore.getState().bannerOpen).toBe(true);
    expect(analytics.enableAnalytics).not.toHaveBeenCalled();
  });

  it('accept persists, closes the banner and enables analytics with the user id', () => {
    initConsent();
    useConsentStore.getState().accept();
    expect(analytics.enableAnalytics).toHaveBeenCalledWith('u1');
    const stored = JSON.parse(mem.get(CONSENT_KEY)!);
    expect(stored).toMatchObject({ value: 'granted', version: CONSENT_VERSION });
    expect(typeof stored.ts).toBe('string');
    expect(useConsentStore.getState().bannerOpen).toBe(false);
  });

  it('decline never loads analytics and is remembered (no banner after reload)', () => {
    initConsent();
    useConsentStore.getState().decline();
    expect(analytics.enableAnalytics).not.toHaveBeenCalled();
    useConsentStore.setState({ choice: null, bannerOpen: false });
    initConsent();
    expect(useConsentStore.getState()).toMatchObject({ choice: 'denied', bannerOpen: false });
    expect(analytics.enableAnalytics).not.toHaveBeenCalled();
  });

  it('a stored grant enables analytics on startup without a banner', () => {
    useConsentStore.getState().accept();
    analytics.enableAnalytics.mockClear();
    initConsent();
    expect(analytics.enableAnalytics).toHaveBeenCalledTimes(1);
    expect(useConsentStore.getState().bannerOpen).toBe(false);
  });

  it('withdrawing (reopen + decline) disables analytics', () => {
    useConsentStore.getState().accept();
    useConsentStore.getState().openBanner();
    expect(useConsentStore.getState().bannerOpen).toBe(true);
    useConsentStore.getState().decline();
    expect(analytics.disableAnalytics).toHaveBeenCalled();
    expect(readStoredConsent()).toBe('denied');
  });

  it('outdated version or broken storage = undecided, denied in effect', () => {
    mem.set(CONSENT_KEY, JSON.stringify({ value: 'granted', version: CONSENT_VERSION - 1, ts: 'x' }));
    expect(readStoredConsent()).toBeNull();
    storageBroken = true;
    initConsent();
    expect(useConsentStore.getState().bannerOpen).toBe(true);
    useConsentStore.getState().decline(); // must not throw
    expect(useConsentStore.getState().choice).toBe('denied');
  });
});
