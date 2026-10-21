// Vercel serverless proxy for Nominatim reverse geocoding API
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
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    const latN = Number(lat);
    const lonN = Number(lon);
    if (!lat || !lon || !Number.isFinite(latN) || !Number.isFinite(lonN)
        || Math.abs(latN) > 90 || Math.abs(lonN) > 180) {
      return new Response(JSON.stringify({ error: 'valid lat/lon required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // F4: forward the requested language (whitelisted).
    const acceptLanguage = url.searchParams.get('accept-language');

    const upstream = new URL('https://nominatim.openstreetmap.org/reverse');
    upstream.searchParams.set('lat', lat);
    upstream.searchParams.set('lon', lon);
    upstream.searchParams.set('format', 'json');
    if (acceptLanguage && /^[a-z]{2}$/.test(acceptLanguage)) {
      upstream.searchParams.set('accept-language', acceptLanguage);
    }

    // Forward zoom + addressdetails (whitelisted) so pins resolve to
    // settlement-level names instead of streets/house numbers.
    const zoom = url.searchParams.get('zoom');
    if (zoom && /^\d{1,2}$/.test(zoom)) {
      upstream.searchParams.set('zoom', zoom);
    }
    const addressdetails = url.searchParams.get('addressdetails');
    if (addressdetails === '0' || addressdetails === '1') {
      upstream.searchParams.set('addressdetails', addressdetails);
    }

    // Nominatim can hang or fail under load — bound the wait and report a 502
    // instead of holding the function open until Vercel kills it.
    try {
      const upstreamRes = await fetch(upstream.toString(), {
        headers: {
          'User-Agent': 'WeatherChaser/1.0 (weather-chaser.vercel.app)',
          'Referer': 'https://weather-chaser.vercel.app',
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
