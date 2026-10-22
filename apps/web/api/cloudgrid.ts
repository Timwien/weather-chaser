// GET /api/cloudgrid?step=1|0.5|0.25&lat0=<south edge>&lng0=<west edge>
// One 8×8 lattice tile of hourly cloud cover (next 7 days) from Open-Meteo
// (CC BY 4.0) for the cloud layer of the weather map. Only tile-aligned
// requests are accepted, so the CDN cache is shared across users and the paid
// API key cannot be used as an open relay. See api/_lib/cloudgrid.ts for the
// lattice convention.

import { buildPayload, canonicalSearch, parseCloudGridQuery, upstreamParams } from './_lib/cloudgrid.js';
import { badRequest, fetchOpenMeteo, jsonResponse } from './_lib/openMeteo.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

    const url = new URL(request.url);
    const parsed = parseCloudGridQuery(url.searchParams);
    if (!parsed.ok) return badRequest(parsed.error);
    if (url.search !== canonicalSearch(parsed.query)) {
      return badRequest(`non-canonical query, use ${canonicalSearch(parsed.query)}`);
    }

    // One upstream call: 64 locations in a single request.
    const result = await fetchOpenMeteo(upstreamParams(parsed.query));
    if (!result.ok) return result.response;

    let payload = null;
    try {
      payload = buildPayload(parsed.query, JSON.parse(result.body));
    } catch { /* falls through to the error below */ }
    if (!payload) return jsonResponse({ error: 'unexpected_upstream_response' }, 502, { 'Cache-Control': 'no-store' });

    return jsonResponse(payload, 200, {
      // Cache ONLY successes. 3 h: cloud forecasts update every few hours and every
      // tile costs 64 Open-Meteo calls, so sharing it longer across users matters.
      'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=3600',
    });
  },
};
