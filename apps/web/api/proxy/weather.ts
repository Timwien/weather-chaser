// Vercel serverless proxy for Open-Meteo — avoids CORS issues and caches at CDN edge
// Cache: 6h (s-maxage=21600) with 1h stale-while-revalidate
// Forwards all Open-Meteo query params: latitude, longitude, daily, hourly, start_date,
// end_date, forecast_days, timezone — supports both date-range batch and forecast_days modes.

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');

    if (!latitude || !longitude) {
      return new Response(JSON.stringify({ error: 'latitude and longitude are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstream = new URL('https://api.open-meteo.com/v1/forecast');
    upstream.searchParams.set('latitude', latitude);
    upstream.searchParams.set('longitude', longitude);

    // Forward optional Open-Meteo parameters
    const forwardParams = [
      'daily',
      'hourly',
      'start_date',
      'end_date',
      'forecast_days',
      'timezone',
    ] as const;

    for (const param of forwardParams) {
      const value = url.searchParams.get(param);
      if (value !== null) {
        upstream.searchParams.set(param, value);
      }
    }

    const apiKey = process.env.OPEN_METEO_API_KEY;
    if (apiKey) {
      upstream.searchParams.set('apikey', apiKey);
    }

    const upstreamRes = await fetch(upstream.toString());
    const body = await upstreamRes.text();

    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
