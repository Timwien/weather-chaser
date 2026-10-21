// Vercel serverless proxy for Open-Meteo — avoids CORS issues and caches at CDN edge
// Cache: 6h (s-maxage=21600) with 1h stale-while-revalidate
//
// Hardened: the paid OPEN_METEO_API_KEY must not be usable as an open relay, so
// only the exact query shape the client sends is accepted — unknown parameters,
// unknown variables, oversized coordinate lists and long date spans get a 400.
//
// Time budget (client timeout is 20 s, this stays below it):
//   max 2 attempts × 8 s upstream timeout + short backoff; a 429 with a short
//   Retry-After is waited out once, a longer one is passed on to the client.

const MAX_COORDS = 50;
const MAX_SPAN_DAYS = 16;
const MAX_FORECAST_DAYS = 16;
const UPSTREAM_TIMEOUT_MS = 8000;
const ATTEMPTS = 2;
const MAX_INLINE_RETRY_AFTER_S = 2;

const ALLOWED_PARAMS = new Set([
  'latitude', 'longitude', 'daily', 'hourly', 'start_date', 'end_date', 'forecast_days', 'timezone',
]);
const ALLOWED_DAILY = new Set([
  'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'sunshine_duration', 'wind_speed_10m_max',
]);
const ALLOWED_HOURLY = new Set([
  'temperature_2m', 'precipitation', 'sunshine_duration', 'wind_speed_10m',
]);

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra },
  });

const bad = (error: string) => json({ error }, 400, { 'Cache-Control': 'no-store' });

/** Comma-separated finite numbers within ±max, at most MAX_COORDS entries. */
function validList(raw: string | null, max: number): raw is string {
  if (!raw) return false;
  const parts = raw.split(',');
  return (
    parts.length <= MAX_COORDS &&
    parts.every((v) => v.trim() !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max)
  );
}

function validVariables(raw: string | null, allowed: Set<string>): boolean {
  return !!raw && raw.split(',').every((v) => allowed.has(v));
}

function parseIsoDate(raw: string | null): number | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== raw ? null : ms;
}

/** Returns an error message, or null when the query is acceptable. */
function validate(params: URLSearchParams): string | null {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) return `unknown parameter: ${key}`;
    // Only the first value is validated below, but forwarding would send the
    // last one — a repeated key would smuggle unvalidated values upstream.
    if (params.getAll(key).length > 1) return `duplicate parameter: ${key}`;
  }
  const latitude = params.get('latitude');
  const longitude = params.get('longitude');
  if (!validList(latitude, 90) || !validList(longitude, 180)) {
    return 'valid latitude and longitude are required (max 50 coordinates)';
  }
  if (latitude.split(',').length !== longitude.split(',').length) return 'latitude/longitude count mismatch';

  const hasDaily = params.has('daily');
  const hasHourly = params.has('hourly');
  if (!hasDaily && !hasHourly) return 'daily or hourly is required';
  if (hasDaily && !validVariables(params.get('daily'), ALLOWED_DAILY)) return 'invalid daily variables';
  if (hasHourly && !validVariables(params.get('hourly'), ALLOWED_HOURLY)) return 'invalid hourly variables';

  const hasStart = params.has('start_date');
  const hasEnd = params.has('end_date');
  if (hasStart !== hasEnd) return 'start_date and end_date must be given together';
  if (hasStart) {
    const start = parseIsoDate(params.get('start_date'));
    const end = parseIsoDate(params.get('end_date'));
    if (start === null || end === null) return 'start_date and end_date must be YYYY-MM-DD';
    const spanDays = (end - start) / 86_400_000 + 1;
    if (spanDays < 1 || spanDays > MAX_SPAN_DAYS) return `date span must be 1-${MAX_SPAN_DAYS} days`;
  }
  if (params.has('forecast_days')) {
    const days = Number(params.get('forecast_days'));
    if (!Number.isInteger(days) || days < 1 || days > MAX_FORECAST_DAYS) return 'invalid forecast_days';
    if (hasStart) return 'forecast_days cannot be combined with start_date/end_date';
  }
  if (params.has('timezone') && !/^[A-Za-z0-9_\/+-]{1,64}$/.test(params.get('timezone') ?? '')) {
    return 'invalid timezone';
  }
  return null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const error = validate(url.searchParams);
    if (error) return bad(error);

    const upstream = new URL('https://api.open-meteo.com/v1/forecast');
    for (const [key, value] of url.searchParams) upstream.searchParams.set(key, value);

    const apiKey = process.env.OPEN_METEO_API_KEY;
    if (apiKey) {
      upstream.searchParams.set('apikey', apiKey);
    }

    // Open-Meteo fails transiently under load (measured: 502 → 504 → 500 in a
    // row, then recovery). One retry with a per-attempt timeout.
    let lastStatus = 502;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      try {
        const upstreamRes = await fetch(upstream.toString(), {
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        lastStatus = upstreamRes.status;

        if (upstreamRes.status === 429) {
          const retryAfter = Number(upstreamRes.headers.get('Retry-After'));
          const known = Number.isFinite(retryAfter) && retryAfter > 0;
          if (known && retryAfter <= MAX_INLINE_RETRY_AFTER_S && attempt < ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }
          // Let the client decide (it bounds the wait by its own deadline)
          return json({ error: 'rate_limited' }, 429, {
            'Cache-Control': 'no-store',
            ...(known ? { 'Retry-After': String(Math.ceil(retryAfter)) } : {}),
          });
        }
        if (!upstreamRes.ok) continue;

        const body = await upstreamRes.text();
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            // Cache ONLY successes — error bodies must never sit in the CDN
            'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch {
        lastStatus = 504; // timeout / network — try again
      }
    }

    return json({ error: 'open_meteo_unavailable' }, lastStatus >= 400 ? lastStatus : 502, {
      'Cache-Control': 'no-store',
    });
  },
};
