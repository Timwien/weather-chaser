// Central client-side error logger: console + PostHog error tracking.
// Logging must never throw — every path is wrapped.

import { captureError } from './analytics.ts';

/** Short, non-reversible-enough fingerprint (djb2) so equal errors can be grouped. */
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Reduce an error to what may leave the device: its type name and a short hash
 * of its message. The raw message/stack can contain place names or URLs.
 */
export function sanitizeError(error: unknown): { name: string; hash: string } {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(error.name) ? error.name : 'Error';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return { name, hash: shortHash(message) };
}

/**
 * Log an error with a stable scope tag. Use for every caught error worth
 * knowing about in production (worker failures, render crashes, API errors).
 * The console keeps the full detail locally; only name + scope + hash are sent
 * to analytics, and only when the user consented.
 */
export function logError(scope: string, error: unknown, context?: Record<string, unknown>): void {
  try {
    console.error(`[${scope}]`, error, context ?? '');
    captureError({ scope, ...sanitizeError(error) });
  } catch { /* never throw from the logger */ }
}

let registered = false;

/**
 * Global last-resort handlers for uncaught errors and promise rejections.
 * Idempotent (StrictMode double-mount safe). PostHog's dashboard-side
 * "Exception autocapture" toggle must stay OFF to avoid double capture.
 */
export function registerGlobalErrorHandlers(): void {
  if (registered) return;
  registered = true;

  window.addEventListener('error', (e) => {
    try {
      logError('window_error', e.error ?? e.message);
    } catch { /* noop */ }
  });

  window.addEventListener('unhandledrejection', (e) => {
    try {
      logError('unhandled_rejection', e.reason);
    } catch { /* noop */ }
  });
}
