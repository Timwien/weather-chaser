// Overpass API — tries primary endpoint first, falls back to mirror on 429/5xx
// In production (Phase 3): proxied through /api/proxy/overpass (Vercel serverless)
// In dev: uses public Overpass endpoints directly with fallback
//
// Place type filter adapts to search area size (granularity 'auto'):
//   < 2 500 km²    → city + town + village  (e.g. ≤28 km radius)
//   2 500–40 000   → city + town            (typical drawn polygon / 50–110 km radius)
//   > 40 000 km²   → city only
// The user can override via granularity 'cities' (city+town) or 'all'
// (city+town+village regardless of size). Every query carries a hard
// server-side result cap so a huge area can never time out the endpoint.

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';

/** User-facing search granularity (appStore.searchGranularity). */
export type SearchGranularity = 'auto' | 'cities' | 'all';

/** Hard cap on Overpass results — quadtile-ordered, prevents endpoint timeouts. */
const QUERY_LIMIT = 800;

/** Endpoints tried in order in dev; the first one to succeed wins */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Rounds over all endpoints — the public servers fail transiently (406/504),
 *  and an immediate retry of the same endpoint often succeeds. */
const RETRY_ROUNDS = 2;
const RETRY_PAUSE_MS = 800;

/** Production proxy endpoint (Vercel serverless) */
const OVERPASS_PROXY = '/api/proxy/overpass';

// ── Adaptive place filter ──────────────────────────────────────────────────

/**
 * Place types for the right granularity given a search area.
 * Returned as a list of EXACT tag values — exact matches hit the Overpass
 * value index directly, while a regex (`~"^(city|town)$"`) forces a scan that
 * times out on the loaded public servers (measured: regex query killed after
 * 13 s, exact-match union of the same area returned 144 places).
 */
function placeTypes(areaKm2: number, granularity: SearchGranularity): string[] {
  if (granularity === 'cities') return ['city', 'town'];
  if (granularity === 'all') return ['city', 'town', 'village'];
  // auto: adapt to area size
  if (areaKm2 < 2_500) return ['city', 'town', 'village'];
  if (areaKm2 < 40_000) return ['city', 'town'];
  return ['city'];
}

/** Union of exact-match node statements for one spatial filter. */
function unionClauses(types: string[], spatial: string): string {
  return types.map((t) => `node["place"="${t}"]${spatial};`).join('\n      ');
}

/** Approximate polygon area in km² (shoelace formula + spherical correction). */
function polygonAreaKm2(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  let areaDeg2 = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = polygon[i];
    const [lng2, lat2] = polygon[(i + 1) % n];
    areaDeg2 += lng1 * lat2 - lng2 * lat1;
  }
  areaDeg2 = Math.abs(areaDeg2) / 2;
  const avgLat = polygon.reduce((s, [, lat]) => s + lat, 0) / polygon.length;
  return areaDeg2 * 111 * (111 * Math.cos((avgLat * Math.PI) / 180));
}

function buildBboxQuery(bbox: BoundingBox, granularity: SearchGranularity): string {
  const { south, west, north, east } = bbox;
  const centerLat = (south + north) / 2;
  const areaKm2 = (north - south) * 111 * ((east - west) * 111 * Math.cos((centerLat * Math.PI) / 180));
  const spatial = `(${south},${west},${north},${east})`;
  return `
    [out:json][timeout:10];
    (
      ${unionClauses(placeTypes(areaKm2, granularity), spatial)}
    );
    out body ${QUERY_LIMIT};
  `.trim();
}

function buildPolygonQuery(polygon: [number, number][], granularity: SearchGranularity): string {
  // Overpass poly format: "lat1 lng1 lat2 lng2 ..."
  const polyStr = polygon.map(([lng, lat]) => `${lat} ${lng}`).join(' ');
  const spatial = `(poly:"${polyStr}")`;
  return `
    [out:json][timeout:10];
    (
      ${unionClauses(placeTypes(polygonAreaKm2(polygon), granularity), spatial)}
    );
    out body ${QUERY_LIMIT};
  `.trim();
}

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags: { name?: string; population?: string; place?: string };
}

function parseTowns(nodes: OverpassNode[]): Town[] {
  return nodes
    .filter((n) => n.tags.name && n.tags.name.trim().length > 0)
    .map((n) => ({
      id: String(n.id),
      name: n.tags.name!,
      lat: n.lat,
      lng: n.lon,
      population: n.tags.population ? parseInt(n.tags.population, 10) : undefined,
    }));
}

async function tryEndpoint(url: string, query: string): Promise<Town[] | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(15000),
    });

    // ALL non-OK responses are treated as transient → try next endpoint/round.
    // The public servers return flaky 406/504 from the Apache front-end even
    // for valid queries (measured: same query → 504, 406, then 200).
    if (!res.ok) return null;

    const data: { elements?: OverpassNode[]; remark?: string } = await res.json();
    // Server-side timeout returns 200 with empty elements + a remark — retry
    if (data.remark?.includes('timed out') && (data.elements?.length ?? 0) === 0) return null;
    return parseTowns(data.elements ?? []);
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return null;
    if (e instanceof TypeError) return null; // fetch network failure
    if (e instanceof SyntaxError) return null; // Overpass returned XML/HTML instead of JSON (overloaded)
    throw e; // unexpected errors
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runOverpassQuery(query: string): Promise<Town[]> {
  // Production: proxy ONLY (Phase 3 requirement: no client-to-public-Overpass
  // calls in prod; the proxy itself can fall back across mirrors server-side).
  // The retry rounds still apply to the proxy — transient failures are common.
  const endpoints = import.meta.env.PROD ? [OVERPASS_PROXY] : OVERPASS_ENDPOINTS;

  for (let round = 0; round < RETRY_ROUNDS; round++) {
    if (round > 0) await sleep(RETRY_PAUSE_MS);
    for (const url of endpoints) {
      const result = await tryEndpoint(url, query);
      if (result !== null) return result;
    }
  }
  throw new Error('Overpass error: all endpoints unavailable');
}

function buildAroundQuery(lat: number, lng: number, radiusKm: number, granularity: SearchGranularity): string {
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const spatial = `(around:${radiusKm * 1000},${lat},${lng})`;
  return `
    [out:json][timeout:10];
    (
      ${unionClauses(placeTypes(areaKm2, granularity), spatial)}
    );
    out body ${QUERY_LIMIT};
  `.trim();
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
  granularity: SearchGranularity = 'auto',
): Promise<Town[]> {
  return runOverpassQuery(buildAroundQuery(lat, lng, radiusKm, granularity));
}

export async function fetchTownsInArea(
  bbox: BoundingBox,
  granularity: SearchGranularity = 'auto',
): Promise<Town[]> {
  return runOverpassQuery(buildBboxQuery(bbox, granularity));
}

export async function fetchTownsInPolygon(
  polygon: [number, number][],
  granularity: SearchGranularity = 'auto',
): Promise<Town[]> {
  return runOverpassQuery(buildPolygonQuery(polygon, granularity));
}
