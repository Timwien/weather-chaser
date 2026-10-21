// Vercel serverless proxy for Nominatim geocoding API
// Nominatim policy: requires User-Agent + Referer; prohibits direct production browser use
// Cache: 1h (s-maxage=3600) with 10min stale-while-revalidate — successes only

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get('q');

    if (!q) {
      return new Response(JSON.stringify({ error: 'q parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clamp limit to 1–10 (default 5); anything non-numeric falls back to the default.
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '5', 10);
    const limit = String(Number.isFinite(limitRaw) ? Math.min(10, Math.max(1, limitRaw)) : 5);
    // F4: forward the requested language (whitelisted) so results are localized.
    // Cache stays correct because the param is part of the request URL / cache key.
    const acceptLanguage = url.searchParams.get('accept-language');

    const upstream = new URL('https://nominatim.openstreetmap.org/search');
    upstream.searchParams.set('q', q);
    upstream.searchParams.set('format', 'json');
    upstream.searchParams.set('limit', limit);
    upstream.searchParams.set('addressdetails', '0');
    if (acceptLanguage && /^[a-z]{2}$/.test(acceptLanguage)) {
      upstream.searchParams.set('accept-language', acceptLanguage);
    }

    // Nominatim can hang or fail under load — bound the wait and report a 502
    // instead of holding the function open until Vercel kills it.
    try {
      const upstreamRes = await fetch(upstream.toString(), {
        headers: {
          'User-Agent': 'WeatherChaser/1.0 (weatherchaser.vercel.app)',
          'Referer': 'https://weatherchaser.vercel.app',
        },
        signal: AbortSignal.timeout(8000),
      });

      const body = await upstreamRes.text();

      return new Response(body, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': 'application/json',
          // Cache ONLY successes — error bodies must never sit in the CDN
          'Cache-Control': upstreamRes.ok
            ? 'public, s-maxage=3600, stale-while-revalidate=600'
            : 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'nominatim_unavailable' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
