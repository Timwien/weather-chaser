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
import {
  fallbackPlacesInBbox,
  fallbackPlacesInRadius,
  fallbackPlacesInPolygon,
} from './fallbackPlaces.ts';
import { pointInPolygon, polygonAreaKm2, bboxOfPolygon } from '../utils/geo.ts';

/** User-facing search granularity (appStore.searchGranularity). */
export type SearchGranularity = 'auto' | 'cities' | 'all';

/** Hard cap on Overpass results — quadtile-ordered, prevents endpoint timeouts. */
const QUERY_LIMIT = 800;
/** Polygon searches query the (larger) bounding box → allow more candidates
 *  before the client-side point-in-polygon filter trims them. */
const POLYGON_QUERY_LIMIT = 1200;
/** Overall wall-clock budget for all Overpass rounds before we give up and
 *  serve the bundled fallback. A user waiting longer than this is lost. */
const OVERPASS_DEADLINE_MS = 12_000;

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

/** Assemble an Overpass query for a spatial filter + place types. */
function buildQuery(spatial: string, types: string[], limit: number): string {
  return `
    [out:json][timeout:10];
    (
      ${unionClauses(types, spatial)}
    );
    out body ${limit};
  `.trim();
}

function bboxAreaKm2(bbox: BoundingBox): number {
  const { south, west, north, east } = bbox;
  const centerLat = (south + north) / 2;
  return (north - south) * 111 * ((east - west) * 111 * Math.cos((centerLat * Math.PI) / 180));
}

function buildBboxQuery(bbox: BoundingBox, granularity: SearchGranularity): string {
  const { south, west, north, east } = bbox;
  const spatial = `(${south},${west},${north},${east})`;
  return buildQuery(spatial, placeTypes(bboxAreaKm2(bbox), granularity), QUERY_LIMIT);
}

/**
 * B6: query the polygon's BOUNDING BOX (index-backed, fast/reliable) instead of
 * the expensive `poly:` filter that soft-times-out on the public servers, then
 * trim client-side with point-in-polygon. Granularity is driven by the REAL
 * polygon area, not the (larger) bbox area, so place-type selection is unchanged.
 */
function buildPolygonBboxQuery(bbox: BoundingBox, realAreaKm2: number, granularity: SearchGranularity): string {
  const { south, west, north, east } = bbox;
  const spatial = `(${south},${west},${north},${east})`;
  return buildQuery(spatial, placeTypes(realAreaKm2, granularity), POLYGON_QUERY_LIMIT);
}

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string | undefined> & { name?: string; population?: string; place?: string };
}

function parseTowns(nodes: OverpassNode[], lang: string): Town[] {
  // F4: prefer the localized name tag (e.g. name:de) when present. `out body`
  // already returns all tags, so this costs no extra query.
  const localTag = `name:${lang}`;
  return nodes
    .filter((n) => n.tags.name && n.tags.name.trim().length > 0)
    .map((n) => ({
      id: String(n.id),
      name: n.tags[localTag] ?? n.tags.name!,
      lat: n.lat,
      lng: n.lon,
      population: n.tags.population ? parseInt(n.tags.population, 10) : undefined,
    }));
}

async function tryEndpoint(url: string, query: string, timeoutMs: number, lang: string): Promise<Town[] | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(timeoutMs),
    });

    // ALL non-OK responses are treated as transient → try next endpoint/round.
    // The public servers return flaky 406/504 from the Apache front-end even
    // for valid queries (measured: same query → 504, 406, then 200).
    if (!res.ok) return null;

    const data: { elements?: OverpassNode[]; remark?: string } = await res.json();
    // Server-side timeout returns 200 with empty elements + a remark — retry
    if (data.remark?.includes('timed out') && (data.elements?.length ?? 0) === 0) return null;
    return parseTowns(data.elements ?? [], lang);
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return null;
    if (e instanceof TypeError) return null; // fetch network failure
    if (e instanceof SyntaxError) return null; // Overpass returned XML/HTML instead of JSON (overloaded)
    throw e; // unexpected errors
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runOverpassQuery(query: string, lang: string): Promise<Town[]> {
  // Production: proxy ONLY (Phase 3 requirement: no client-to-public-Overpass
  // calls in prod; the proxy itself can fall back across mirrors server-side).
  // The retry rounds still apply to the proxy — transient failures are common.
  const endpoints = import.meta.env.PROD ? [OVERPASS_PROXY] : OVERPASS_ENDPOINTS;

  // B6: hard wall-clock deadline. Once it passes we stop trying and let the
  // caller serve the bundled fallback rather than making the user wait ~30s.
  const deadline = Date.now() + OVERPASS_DEADLINE_MS;

  for (let round = 0; round < RETRY_ROUNDS; round++) {
    if (round > 0) {
      if (Date.now() >= deadline) break;
      await sleep(RETRY_PAUSE_MS);
    }
    for (const url of endpoints) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const result = await tryEndpoint(url, query, Math.min(15_000, remaining), lang);
      if (result !== null) return result;
    }
  }
  throw new Error('Overpass error: all endpoints unavailable');
}

function buildAroundQuery(lat: number, lng: number, radiusKm: number, granularity: SearchGranularity): string {
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const spatial = `(around:${radiusKm * 1000},${lat},${lng})`;
  return buildQuery(spatial, placeTypes(areaKm2, granularity), QUERY_LIMIT);
}

/**
 * Last line of defense: when every Overpass endpoint failed, serve places
 * from the bundled GeoNames dataset (European places ≥15k population —
 * effectively the "cities" tier). Only if THAT also yields nothing does the
 * original error propagate to the UI.
 */
async function withFallback(
  overpass: () => Promise<Town[]>,
  fallback: () => Promise<Town[]>,
): Promise<Town[]> {
  try {
    return await overpass();
  } catch (err) {
    try {
      const places = await fallback();
      if (places.length > 0) {
        console.warn('[overpass] all endpoints down — using bundled GeoNames fallback');
        return places;
      }
    } catch {
      // fallback dataset unavailable — fall through to the original error
    }
    throw err;
  }
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  return withFallback(
    () => runOverpassQuery(buildAroundQuery(lat, lng, radiusKm, granularity), lang),
    () => fallbackPlacesInRadius(lat, lng, radiusKm),
  );
}

export async function fetchTownsInArea(
  bbox: BoundingBox,
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  return withFallback(
    () => runOverpassQuery(buildBboxQuery(bbox, granularity), lang),
    () => fallbackPlacesInBbox(bbox),
  );
}

/** B6: session cache — repeat searches in the same polygon (e.g. after a preset
 *  switch) skip the network entirely. Keyed by rounded polygon + granularity. */
const polygonCache = new Map<string, Town[]>();

function polygonCacheKey(polygon: [number, number][], granularity: SearchGranularity): string {
  const hash = polygon.map(([lng, lat]) => `${lng.toFixed(3)},${lat.toFixed(3)}`).join(';');
  return `${granularity}:${hash}`;
}

export async function fetchTownsInPolygon(
  polygon: [number, number][],
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  const cacheKey = `${lang}:${polygonCacheKey(polygon, granularity)}`;
  const cached = polygonCache.get(cacheKey);
  if (cached) return cached;

  const bbox = bboxOfPolygon(polygon);
  const realAreaKm2 = polygonAreaKm2(polygon);

  const towns = await withFallback(
    // Query the bounding box (fast, index-backed) then trim to the exact polygon.
    async () => {
      const inBbox = await runOverpassQuery(buildPolygonBboxQuery(bbox, realAreaKm2, granularity), lang);
      return inBbox.filter((t) => pointInPolygon(t.lat, t.lng, polygon));
    },
    () => fallbackPlacesInPolygon(polygon),
  );

  polygonCache.set(cacheKey, towns);
  return towns;
}
