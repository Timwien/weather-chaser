// Shared Open-Meteo upstream access for the API functions (weather proxy, cloud grid).
//
// Time budget (client timeout is 20 s, this stays below it):
//   max 2 attempts × 8 s upstream timeout + short backoff; a 429 with a short
//   Retry-After is waited out once, a longer one is passed on to the client.

const UPSTREAM_TIMEOUT_MS = 8000;
const ATTEMPTS = 2;
const MAX_INLINE_RETRY_AFTER_S = 2;

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export const jsonResponse = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra },
  });

export const badRequest = (error: string) => jsonResponse({ error }, 400, { 'Cache-Control': 'no-store' });

export type UpstreamResult = { ok: true; body: string } | { ok: false; response: Response };

/**
 * GET the Open-Meteo forecast API with the given (already validated) query.
 * Adds the paid API key when configured. Open-Meteo fails transiently under
 * load (measured: 502 → 504 → 500 in a row, then recovery) → one retry with a
 * per-attempt timeout. Error responses are never cacheable.
 */
export async function fetchOpenMeteo(params: URLSearchParams): Promise<UpstreamResult> {
  const upstream = new URL(OPEN_METEO_FORECAST_URL);
  for (const [key, value] of params) upstream.searchParams.set(key, value);

  const apiKey = process.env.OPEN_METEO_API_KEY;
  if (apiKey) upstream.searchParams.set('apikey', apiKey);

  let lastStatus = 502;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(upstream.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      lastStatus = res.status;

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        const known = Number.isFinite(retryAfter) && retryAfter > 0;
        if (known && retryAfter <= MAX_INLINE_RETRY_AFTER_S && attempt < ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        // Let the client decide (it bounds the wait by its own deadline)
        return {
          ok: false,
          response: jsonResponse({ error: 'rate_limited' }, 429, {
            'Cache-Control': 'no-store',
            ...(known ? { 'Retry-After': String(Math.ceil(retryAfter)) } : {}),
          }),
        };
      }
      if (!res.ok) continue;
      return { ok: true, body: await res.text() };
    } catch {
      lastStatus = 504; // timeout / network — try again
    }
  }
  return {
    ok: false,
    response: jsonResponse({ error: 'open_meteo_unavailable' }, lastStatus >= 400 ? lastStatus : 502, {
      'Cache-Control': 'no-store',
    }),
  };
}
