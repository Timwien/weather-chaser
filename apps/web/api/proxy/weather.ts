// Vercel serverless proxy for Open-Meteo — avoids CORS issues and caches at CDN edge
// Cache: 6h (s-maxage=21600) with 1h stale-while-revalidate

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

    const forecastDays = url.searchParams.get('forecast_days') ?? '16';
    const hourly =
      url.searchParams.get('hourly') ??
      'temperature_2m,precipitation,sunshine_duration,wind_speed_10m';
    const timezone = url.searchParams.get('timezone') ?? 'Europe/Berlin';

    const upstream = new URL('https://api.open-meteo.com/v1/forecast');
    upstream.searchParams.set('latitude', latitude);
    upstream.searchParams.set('longitude', longitude);
    upstream.searchParams.set('forecast_days', forecastDays);
    upstream.searchParams.set('hourly', hourly);
    upstream.searchParams.set('timezone', timezone);

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
