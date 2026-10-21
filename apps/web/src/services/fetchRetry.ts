/**
 * fetchJsonWithRetry — resilient JSON fetch for our own /api endpoints.
 *
 * Open-Meteo fails transiently under load (502 → 504 → 500 in a row, then
 * recovery). A retry with a short backoff bridges these blips; a per-attempt
 * timeout stops a hung upstream from stalling the whole pipeline.
 *
 * Time budget: an optional absolute `deadline` (epoch ms) caps every wait and
 * every attempt, so callers that run many requests can bound their total time.
 * A 429 `Retry-After` is honoured as long as it fits into the deadline.
 */

/** Longest Retry-After we are willing to wait for (ms), regardless of deadline. */
const MAX_RETRY_AFTER_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse a Retry-After header (seconds or HTTP date) into ms; null if absent/invalid. */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export interface FetchRetryOptions {
  attempts?: number;
  /** Per-attempt timeout. Keep it above the proxy's own total time. */
  timeoutMs?: number;
  backoffMs?: number;
  /** Absolute deadline (epoch ms) for the whole call including waits. */
  deadline?: number;
}

export async function fetchJsonWithRetry(
  url: string,
  { attempts = 2, timeoutMs = 20_000, backoffMs = 800, deadline = Infinity }: FetchRetryOptions = {},
): Promise<unknown> {
  let lastError: Error = new Error('fetch failed');
  let waitMs = 0;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      if (Date.now() + waitMs >= deadline) break;
      await sleep(waitMs);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    waitMs = backoffMs * (attempt + 1);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)) });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        // 4xx (except 429) won't get better by retrying
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw lastError;
        if (res.status === 429) {
          const retryAfter = parseRetryAfterMs(res.headers.get('Retry-After'));
          // Waiting longer than we may (or than the deadline allows) is pointless
          if (retryAfter !== null) {
            if (retryAfter > MAX_RETRY_AFTER_MS || Date.now() + retryAfter >= deadline) break;
            waitMs = Math.max(waitMs, retryAfter);
          }
        }
        continue;
      }
      return await res.json(); // SyntaxError (HTML error page) → retry via catch
    } catch (e) {
      if (e instanceof Error && /^HTTP 4(?!29)/.test(e.message)) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError;
}
