// R5: typed error codes replace fragile error-string matching in the UI.
// Workers classify at the source (where the context exists) and post a code;
// the UI maps it with `t(\`errors.${code}\`)` — one mapping, both languages.

export type AppErrorCode =
  | 'no_towns'
  | 'no_towns_small_area'
  | 'places_unavailable'
  | 'weather_failed'
  | 'missing_config'
  | 'missing_polygon'
  | 'missing_coords'
  | 'no_location'
  | 'unknown';

/** Map a thrown error to a stable code. Called from worker catch blocks. */
export function classifyError(err: unknown): AppErrorCode {
  const msg = err instanceof Error ? err.message : String(err);
  // AbortSignal.timeout() rejects with a DOMException whose message varies by
  // browser ("signal timed out", "The operation timed out.") — check its name.
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'weather_failed';
  }
  if (msg === 'no_towns_small_area') return 'no_towns_small_area';
  if (msg === 'no_towns') return 'no_towns';
  if (msg.startsWith('places_unavailable')) return 'places_unavailable';
  if (/HTTP \d|Open-?Meteo|TimeoutError|AbortError|Failed to fetch|weather/i.test(msg)) {
    return 'weather_failed';
  }
  return 'unknown';
}
