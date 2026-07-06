// Vercel serverless proxy for Overpass API — forwards Overpass QL queries
// Cache: 24h (s-maxage=86400) with 1h stale-while-revalidate
// Upstream: POST with data=<encoded query> (application/x-www-form-urlencoded)
// Tries primary endpoint first, falls back to mirror on 429/5xx/timeout

const UPSTREAM_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.text();

    for (const url of UPSTREAM_URLS) {
      try {
        const upstreamRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'WeatherChaser/1.0 (weatherchaser.vercel.app)',
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        // Treat ALL non-OK as transient — the public Apache front-ends return
        // flaky 406/504 even for valid queries; the next mirror often succeeds
        if (!upstreamRes.ok) continue;

        const responseBody = await upstreamRes.text();

        // B6: harden against soft timeouts — Overpass returns HTTP 200 with a
        // `remark: ... timed out ...` and empty elements when the query was too
        // heavy. Previously this was cached and forwarded as a "success" with
        // zero places. Detect it and try the next mirror instead; only cache
        // genuinely valid results.
        let softTimedOut = false;
        try {
          const parsed = JSON.parse(responseBody) as { elements?: unknown[]; remark?: string };
          const empty = (parsed.elements?.length ?? 0) === 0;
          if (empty && /timed out|runtime error/i.test(parsed.remark ?? '')) {
            softTimedOut = true;
          }
        } catch {
          // Not JSON (XML/HTML error page from an overloaded front-end) → transient
          softTimedOut = true;
        }
        if (softTimedOut) continue;

        return new Response(responseBody, {
          status: upstreamRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch {
        // Network error or timeout — try next mirror
        continue;
      }
    }

    return new Response(JSON.stringify({ error: 'All Overpass endpoints unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
