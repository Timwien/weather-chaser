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
// - posthog-js is loaded with a dynamic import (own chunk, only fetched when a
//   key is set). Calls made before it has loaded are queued and replayed.

import type { PostHog } from 'posthog-js';

let ph: PostHog | null = null;
let started = false;
// Calls made while posthog-js is still loading (capped so a failed load can't grow it).
const queue: Array<(p: PostHog) => void> = [];
const MAX_QUEUE = 100;

/** Run against PostHog now, or queue until it has loaded. Never throws. */
function run(fn: (p: PostHog) => void): void {
  if (ph) {
    try { fn(ph); } catch { /* never let analytics break the app */ }
  } else if (started && queue.length < MAX_QUEUE) {
    queue.push(fn);
  }
}

export function initAnalytics(): void {
  // StrictMode double-mount guard + no-op without a key.
  if (started) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  started = true;

  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        persistence: 'memory',
        person_profiles: 'identified_only',
        autocapture: true,
        capture_pageview: 'history_change',
        session_recording: { maskAllInputs: true },
        loaded: (p) => {
          if (import.meta.env.DEV) {
            p.debug();
            // Console smoke-testing hook, dev only.
            (window as unknown as { posthog: unknown }).posthog = p;
          }
        },
      });
      ph = posthog;
      for (const fn of queue.splice(0)) {
        try { fn(posthog); } catch { /* noop */ }
      }
    })
    .catch((e) => {
      // Chunk blocked/offline: stay a no-op.
      started = false;
      queue.length = 0;
      console.error('[analytics] init failed:', e);
    });
}

/** Track a product event. Silent no-op when analytics is not initialized. */
export function capture(event: string, props?: Record<string, unknown>): void {
  run((p) => p.capture(event, props));
}

/** Report an exception to PostHog error tracking. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  run((p) => {
    const err = error instanceof Error ? error : new Error(String(error));
    p.captureException(err, context);
  });
}

/** Tie events to the signed-in user (id only — no email, no name). */
export function identifyUser(userId: string): void {
  run((p) => p.identify(userId));
}

/** Drop the identity again on sign-out. */
export function resetIdentity(): void {
  run((p) => p.reset());
}
