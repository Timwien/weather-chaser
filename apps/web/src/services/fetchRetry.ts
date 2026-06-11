/**
 * fetchJsonWithRetry — resilient JSON fetch for the public weather/geo APIs.
 *
 * Open-Meteo (like Overpass) fails transiently under load: measured
 * 2026-06-11 the same request returned 502 → 504 → 500 in a row, then
 * recovered. A couple of retries with a short backoff bridges these blips;
 * a per-attempt timeout stops a hung upstream from stalling the whole
 * pipeline (the worker has no other watchdog).
 */
export async function fetchJsonWithRetry(
  url: string,
  {
    attempts = 3,
    timeoutMs = 15000,
    backoffMs = 800,
  }: { attempts?: number; timeoutMs?: number; backoffMs?: number } = {},
): Promise<unknown> {
  let lastError: Error = new Error('fetch failed');

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, backoffMs * attempt));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        // 4xx (except 429) won't get better by retrying
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw lastError;
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
