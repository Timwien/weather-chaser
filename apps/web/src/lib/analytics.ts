// PostHog EU wrapper — the ONLY module that imports posthog-js.
//
// Privacy posture (see docs/analytics-2026-07/SETUP-POSTHOG.md):
// - EU cloud (Frankfurt) host.
// - `persistence: 'memory'`: nothing written to cookies/localStorage → no
//   consent banner needed. (`cookieless_mode: 'always'` would also work but
//   disables session replay, so memory persistence is the deliberate choice.
//   Trade-off: guests get a fresh distinct_id per pageload.)
// - Inputs masked in session replay.
// - Every wrapper is a silent no-op when VITE_POSTHOG_KEY is absent (local dev
//   default) or init failed — product code must never depend on analytics.

import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics(): void {
  // StrictMode double-mount guard + no-op without a key.
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

  try {
    posthog.init(key, {
      api_host: host,
      persistence: 'memory',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: 'history_change',
      session_recording: { maskAllInputs: true },
      loaded: (ph) => {
        if (import.meta.env.DEV) {
          ph.debug();
          // Console smoke-testing hook, dev only.
          (window as unknown as { posthog: unknown }).posthog = ph;
        }
      },
    });
    initialized = true;
  } catch (e) {
    console.error('[analytics] init failed:', e);
  }
}

/** Track a product event. Silent no-op when analytics is not initialized. */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch { /* never let analytics break the app */ }
}

/** Report an exception to PostHog error tracking. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    posthog.captureException(err, context);
  } catch { /* never let analytics break the app */ }
}

/** Tie events to the signed-in user (id only — no email, no name). */
export function identifyUser(userId: string): void {
  if (!initialized) return;
  try {
    posthog.identify(userId);
  } catch { /* noop */ }
}

/** Drop the identity again on sign-out. */
export function resetIdentity(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch { /* noop */ }
}
