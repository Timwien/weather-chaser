// Central client-side error logger: console + PostHog error tracking.
// Logging must never throw — every path is wrapped.

import { captureException } from './analytics.ts';

/**
 * Log an error with a stable scope tag. Use for every caught error worth
 * knowing about in production (worker failures, render crashes, API errors).
 */
export function logError(scope: string, error: unknown, context?: Record<string, unknown>): void {
  try {
    console.error(`[${scope}]`, error, context ?? '');
    captureException(error, { scope, ...context });
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
      logError('window_error', e.error ?? e.message, {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    } catch { /* noop */ }
  });

  window.addEventListener('unhandledrejection', (e) => {
    try {
      logError('unhandled_rejection', e.reason);
    } catch { /* noop */ }
  });
}
