// GET /api/places — place lookup from the bundled GeoNames dataset (CC BY 4.0).
//   ?bbox=south,west,north,east | ?lat=&lng=&radiusKm=   (exactly one of the two)
//   &minPop=<n> &limit=<n ≤ 1500> &lang=de|en
// Responses are immutable per URL → long CDN cache. Clients round coordinates
// to 2 decimals so that nearby searches share cache entries.

import data from './_data/places.json' with { type: 'json' };
import { parsePlacesQuery, queryPlaces, type PlacesDataset } from './_lib/places.js';

const { places, regions } = data as unknown as PlacesDataset;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }

    const parsed = parsePlacesQuery(new URL(request.url).searchParams);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
      });
    }

    return new Response(JSON.stringify(queryPlaces(places, parsed.query, regions)), {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
