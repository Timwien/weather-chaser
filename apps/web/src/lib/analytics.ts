// PostHog EU wrapper — the ONLY module that imports posthog-js.
//
// Privacy posture (see docs/analytics-2026-07/SETUP-POSTHOG.md):
// - OPT-IN ONLY: posthog-js is not even downloaded until `enableAnalytics()` is
//   called, which happens exclusively after the user accepted the consent
//   banner (lib/consent.ts). Before that, every wrapper is a silent no-op and
//   calls are DROPPED (never queued for later), so nothing the user did before
//   consenting is ever sent.
// - EU cloud (Frankfurt) host.
// - `persistence: 'memory'`: no cookies/localStorage written by PostHog while
//   capturing. Guests get a fresh distinct_id per pageload.
// - Session replay masks all inputs AND all text.
// - Withdrawing consent: opt out, stop the recording (its final buffer flush is
//   then dropped), `reset()`, and `opt_out_capturing()` again LAST. reset() runs
//   consent.reset(), which deletes the `__ph_opt_in_out_` flag — called after the
//   opt-out it silently re-enabled capture (posthog-js 1.398).
// - `request_batching: false`: events go out when captured. posthog-js does not
//   check consent when it flushes its batch queue, so with batching the last
//   ~3 s of (consented) events left the browser AFTER a withdrawal.
// - Granting consent on a fresh page load calls `opt_in_capturing()` after init,
//   so a stale opt-out flag from an earlier withdrawal cannot keep it disabled.
// - No console logs, network timing or exception autocapture: those can carry
//   URLs, search terms and place names. Errors go only through captureError().
// - Every wrapper is a silent no-op when VITE_POSTHOG_KEY is absent (local dev
//   default) or init failed — product code must never depend on analytics.

import type { PostHog } from 'posthog-js';

let ph: PostHog | null = null;
let started = false;
/** True only between an explicit opt-in and a withdrawal. */
let granted = false;
// Calls made while posthog-js is still loading, AFTER consent (capped so a
// failed load can't grow it). Dropped on withdrawal.
const queue: Array<(p: PostHog) => void> = [];
const MAX_QUEUE = 100;

/** Run against PostHog now, or queue until it has loaded. Never throws. */
function run(fn: (p: PostHog) => void): void {
  if (!granted) return; // no consent → drop, never queue
  if (ph) {
    try { fn(ph); } catch { /* never let analytics break the app */ }
  } else if (started && queue.length < MAX_QUEUE) {
    queue.push(fn);
  }
}

/**
 * Start analytics. Call ONLY after the user opted in. Idempotent. If a user id
 * is passed (already signed in), the session is identified once PostHog is up.
 */
export function enableAnalytics(userId?: string | null): void {
  granted = true;
  if (ph) {
    // Re-opt-in after a withdrawal in the same pageview.
    try {
      ph.set_config({ advanced_disable_feature_flags: false });
      ph.opt_in_capturing({ captureEventName: false });
      ph.startSessionRecording();
      if (userId) ph.identify(userId);
    } catch { /* noop */ }
    return;
  }
  if (started) {
    if (userId) run((p) => p.identify(userId));
    return;
  }
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  started = true;
  if (userId) queue.push((p) => p.identify(userId));

  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

  import('posthog-js')
    .then(({ default: posthog }) => {
      // Consent withdrawn while the chunk was loading → never initialise.
      if (!granted) {
        started = false;
        queue.length = 0;
        return;
      }
      posthog.init(key, {
        api_host: host,
        persistence: 'memory',
        person_profiles: 'identified_only',
        autocapture: true,
        capture_pageview: 'history_change',
        // recordHeaders/recordBody false: an explicit client `false` beats the
        // dashboard, so replays never contain API request/response payloads.
        session_recording: { maskAllInputs: true, maskTextSelector: '*', recordHeaders: false, recordBody: false },
        mask_all_text: true,
        request_batching: false,
        // Explicitly off (they could carry URLs, search terms or place names):
        enable_recording_console_log: false,
        capture_exceptions: false,
        capture_performance: { network_timing: false, web_vitals: false },
        loaded: (p) => {
          if (import.meta.env.DEV) {
            p.debug();
            // Console smoke-testing hook, dev only.
            (window as unknown as { posthog: unknown }).posthog = p;
          }
        },
      });
      ph = posthog;
      // A withdrawal on an earlier visit left `__ph_opt_in_out_` = 0 in
      // localStorage; init() would honour it and capture nothing. The user has
      // just (re-)consented, so that flag is outdated → opt in explicitly.
      try { posthog.opt_in_capturing({ captureEventName: false }); } catch { /* noop */ }
      for (const fn of queue.splice(0)) {
        try { fn(posthog); } catch { /* noop */ }
      }
    })
    .catch((e) => {
      // Chunk blocked/offline: stay a no-op.
      started = false;
      queue.length = 0;
      console.error('[analytics] init failed:', e instanceof Error ? e.name : 'unknown');
    });
}

/** Withdraw / refuse: stop capturing immediately, forget identity, drop queue. */
export function disableAnalytics(): void {
  granted = false;
  queue.length = 0;
  if (!ph) return;
  // Opt out first so the recorder's final buffer flush on stop is dropped.
  try { ph.opt_out_capturing(); } catch { /* noop */ }
  try { ph.stopSessionRecording(); } catch { /* noop */ }
  try {
    // reset() would otherwise re-fetch feature flags (one more request after withdrawal).
    ph.set_config({ advanced_disable_feature_flags: true });
    // ORDER MATTERS: reset() deletes the opt-out flag (consent.reset()), so it
    // must run BEFORE opt_out_capturing(), never after it.
    ph.reset();
  } catch { /* noop */ }
  try { ph.opt_out_capturing(); } catch { /* noop */ }
}

/** Track a product event. Silent no-op without consent. */
export function capture(event: string, props?: Record<string, unknown>): void {
  run((p) => p.capture(event, props));
}

/**
 * Report an error to PostHog error tracking. Only the error type, our own scope
 * tag and a short hash are sent — never the message or stack, which may contain
 * place names or URLs.
 */
export function captureError(report: { name: string; scope: string; hash: string }): void {
  run((p) => {
    p.capture('$exception', {
      $exception_list: [
        { type: report.name, value: `hash:${report.hash}`, mechanism: { handled: true, synthetic: true } },
      ],
      scope: report.scope,
    });
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
