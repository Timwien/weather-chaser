// Place lookup via our own /api/places (GeoNames cities1000, CC BY 4.0).
// Replaces the former Overpass client. The endpoint is CDN-cached, so request
// coordinates are rounded to 2 decimals (outward for bboxes) to share cache entries.
//
// Granularity maps OSM-style place classes to population thresholds
// (city ≈ ≥100k, town ≈ ≥10k, village < 10k). 'auto' adapts to the search area:
//   < 2 500 km²    → ≥ 1 000    (city + town + village)
//   2 500–40 000   → ≥ 10 000   (city + town)
//   > 40 000 km²   → ≥ 100 000  (city only)

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';
import { fetchJsonWithRetry } from './fetchRetry.ts';
import { pointInPolygon, polygonAreaKm2, bboxOfPolygon } from '../utils/geo.ts';

/** User-facing search granularity (appStore.searchGranularity). */
export type SearchGranularity = 'auto' | 'cities' | 'all';

/** Candidate caps per query (population-ordered server-side). */
const QUERY_LIMIT = 800;
const POLYGON_QUERY_LIMIT = 1200;

const MIN_POP_VILLAGE = 1_000;
const MIN_POP_TOWN = 10_000;
const MIN_POP_CITY = 100_000;

// Server limits (api/_lib/places.ts) — clamp so a huge selection never yields a 400.
const MAX_RADIUS_KM = 600;
const MAX_BBOX_LAT_SPAN = 25;
const MAX_BBOX_LNG_SPAN = 40;

/** Population threshold for the right granularity given a search area. */
export function minPopulation(areaKm2: number, granularity: SearchGranularity): number {
  if (granularity === 'cities') return MIN_POP_TOWN;
  if (granularity === 'all') return MIN_POP_VILLAGE;
  if (areaKm2 < 2_500) return MIN_POP_VILLAGE;
  if (areaKm2 < 40_000) return MIN_POP_TOWN;
  return MIN_POP_CITY;
}

export function bboxAreaKm2(bbox: BoundingBox): number {
  const { south, west, north, east } = bbox;
  const centerLat = (south + north) / 2;
  return (north - south) * 111 * ((east - west) * 111 * Math.cos((centerLat * Math.PI) / 180));
}

const floor2 = (v: number) => Math.floor(v * 100) / 100;
const ceil2 = (v: number) => Math.ceil(v * 100) / 100;
const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Round a bbox outward to 2 decimals and clamp it to the server's size limits. */
export function normalizeBbox(bbox: BoundingBox): BoundingBox {
  let south = clamp(floor2(bbox.south), -90, 90);
  let north = clamp(ceil2(bbox.north), -90, 90);
  let west = clamp(floor2(bbox.west), -180, 180);
  let east = clamp(ceil2(bbox.east), -180, 180);
  // round2(… - 0.01): plain `south + MAX` drifts to e.g. 64.02000000000001,
  // which the server rejects as a span of 25.000000000000007.
  if (north - south > MAX_BBOX_LAT_SPAN) {
    const mid = (north + south) / 2;
    south = floor2(mid - MAX_BBOX_LAT_SPAN / 2);
    north = round2(south + MAX_BBOX_LAT_SPAN - 0.01);
  }
  if (east - west > MAX_BBOX_LNG_SPAN) {
    const mid = (east + west) / 2;
    west = floor2(mid - MAX_BBOX_LNG_SPAN / 2);
    east = round2(west + MAX_BBOX_LNG_SPAN - 0.01);
  }
  return { south, west, north, east };
}

/** Below this many candidates, 'auto' retries with the next lower threshold —
 *  sparse regions (Lapland, Highlands, alpine valleys) have few large towns. */
const MIN_AUTO_RESULTS = 10;

export async function withSparseFallback(
  minPop: number,
  granularity: SearchGranularity,
  query: (minPop: number) => Promise<Town[]>,
): Promise<Town[]> {
  let towns = await query(minPop);
  while (granularity === 'auto' && towns.length < MIN_AUTO_RESULTS && minPop > MIN_POP_VILLAGE) {
    minPop = minPop > MIN_POP_TOWN ? MIN_POP_TOWN : MIN_POP_VILLAGE;
    towns = await query(minPop);
  }
  return towns;
}

function langOf(lang: string): 'de' | 'en' {
  return lang.slice(0, 2).toLowerCase() === 'de' ? 'de' : 'en';
}

async function requestPlaces(params: URLSearchParams): Promise<Town[]> {
  const url = new URL('/api/places', self.location.origin);
  url.search = params.toString();
  try {
    const raw = await fetchJsonWithRetry(url.toString(), { attempts: 2, timeoutMs: 10_000 });
    if (!Array.isArray(raw)) throw new Error('unexpected response');
    return raw as Town[];
  } catch (err) {
    throw new Error(`places_unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function bboxParams(
  bbox: BoundingBox, minPop: number, limit: number, lang: string,
): URLSearchParams {
  const b = normalizeBbox(bbox);
  return new URLSearchParams({
    bbox: `${b.south},${b.west},${b.north},${b.east}`,
    minPop: String(minPop),
    limit: String(limit),
    lang: langOf(lang),
  });
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  const radius = clamp(Math.ceil(radiusKm), 1, MAX_RADIUS_KM);
  return withSparseFallback(minPopulation(Math.PI * radius * radius, granularity), granularity, (minPop) =>
    requestPlaces(new URLSearchParams({
      lat: String(round2(lat)),
      lng: String(round2(lng)),
      radiusKm: String(radius),
      minPop: String(minPop),
      limit: String(QUERY_LIMIT),
      lang: langOf(lang),
    })),
  );
}

export async function fetchTownsInArea(
  bbox: BoundingBox,
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  return withSparseFallback(minPopulation(bboxAreaKm2(bbox), granularity), granularity, (minPop) =>
    requestPlaces(bboxParams(bbox, minPop, QUERY_LIMIT, lang)),
  );
}

/** Session cache — repeat searches in the same polygon skip the network entirely. */
const polygonCache = new Map<string, Town[]>();

function polygonCacheKey(polygon: [number, number][], granularity: SearchGranularity, lang: string): string {
  const hash = polygon.map(([lng, lat]) => `${lng.toFixed(3)},${lat.toFixed(3)}`).join(';');
  return `${langOf(lang)}:${granularity}:${hash}`;
}

/**
 * Query the polygon's bounding box, then trim client-side with point-in-polygon.
 * Granularity is driven by the REAL polygon area, not the (larger) bbox area.
 */
export async function fetchTownsInPolygon(
  polygon: [number, number][],
  granularity: SearchGranularity = 'auto',
  lang = 'en',
): Promise<Town[]> {
  const cacheKey = polygonCacheKey(polygon, granularity, lang);
  const cached = polygonCache.get(cacheKey);
  if (cached) return cached;

  const bbox = bboxOfPolygon(polygon);
  const towns = await withSparseFallback(minPopulation(polygonAreaKm2(polygon), granularity), granularity,
    async (minPop) => {
      const inBbox = await requestPlaces(bboxParams(bbox, minPop, POLYGON_QUERY_LIMIT, lang));
      return inBbox.filter((t) => pointInPolygon(t.lat, t.lng, polygon));
    },
  );

  polygonCache.set(cacheKey, towns);
  return towns;
}
