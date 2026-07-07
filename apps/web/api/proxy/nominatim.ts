// Vercel serverless proxy for Nominatim geocoding API
// Nominatim policy: requires User-Agent + Referer; prohibits direct production browser use
// Cache: 1h (s-maxage=3600) with 10min stale-while-revalidate

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

    const limit = url.searchParams.get('limit') ?? '5';
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

    const upstreamRes = await fetch(upstream.toString(), {
      headers: {
        'User-Agent': 'WeatherChaser/1.0 (weatherchaser.vercel.app)',
        'Referer': 'https://weatherchaser.vercel.app',
      },
    });

    const body = await upstreamRes.text();

    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
