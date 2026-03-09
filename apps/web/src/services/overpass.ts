// Overpass API — tries primary endpoint first, falls back to mirror on 429/5xx
// In production (Phase 3): proxied through /api/proxy/overpass (Vercel serverless)
// In dev: uses public Overpass endpoints directly with fallback
// Place type filter adapts to search area size to keep query fast and result count manageable:
//   < 10 000 km²  → city + town + village  (e.g. 50 km radius)
//   10 000–100 000 km² → city + town        (e.g. 100–180 km radius)
//   > 100 000 km²  → city only              (e.g. 200 km+ radius, large drawn polygon)

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';

/** Endpoints tried in order in dev; the first one to succeed wins */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Production proxy endpoint (Vercel serverless) */
const OVERPASS_PROXY = '/api/proxy/overpass';

// ── Adaptive place filter ──────────────────────────────────────────────────

/** Overpass filter string for the right granularity given a search area. */
function placeFilter(areaKm2: number): string {
  if (areaKm2 < 10_000)  return '"place"~"^(city|town|village)$"';
  if (areaKm2 < 100_000) return '"place"~"^(city|town)$"';
  return '"place"="city"';
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

function buildBboxQuery(bbox: BoundingBox): string {
  const { south, west, north, east } = bbox;
  const centerLat = (south + north) / 2;
  const areaKm2 = (north - south) * 111 * ((east - west) * 111 * Math.cos((centerLat * Math.PI) / 180));
  const filter = placeFilter(areaKm2);
  return `
    [out:json][timeout:8];
    (
      node[${filter}]["name"](${south},${west},${north},${east});
    );
    out body;
  `.trim();
}

function buildPolygonQuery(polygon: [number, number][]): string {
  // Overpass poly format: "lat1 lng1 lat2 lng2 ..."
  const polyStr = polygon.map(([lng, lat]) => `${lat} ${lng}`).join(' ');
  const filter = placeFilter(polygonAreaKm2(polygon));
  return `
    [out:json][timeout:8];
    (
      node[${filter}]["name"](poly:"${polyStr}");
    );
    out body;
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
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      // Only retry on rate-limiting or server errors; fail fast on 4xx
      if (res.status === 429 || res.status >= 500) return null;
      throw new Error(`Overpass error: ${res.status}`);
    }

    const data: { elements: OverpassNode[] } = await res.json();
    return parseTowns(data.elements);
  } catch (e) {
    // Network or timeout errors — try next endpoint
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return null;
    if (e instanceof TypeError) return null; // fetch network failure
    if (e instanceof SyntaxError) return null; // Overpass returned XML/HTML instead of JSON (overloaded)
    throw e; // re-throw 4xx and unexpected errors
  }
}

async function runOverpassQuery(query: string): Promise<Town[]> {
  if (import.meta.env.PROD) {
    // Production: use proxy endpoint (single endpoint, Vercel CDN caches responses)
    const result = await tryEndpoint(OVERPASS_PROXY, query);
    if (result !== null) return result;
    throw new Error('Overpass proxy error: request failed');
  }
  // Dev: try multiple public endpoints with fallback
  for (const url of OVERPASS_ENDPOINTS) {
    const result = await tryEndpoint(url, query);
    if (result !== null) return result;
  }
  throw new Error('Overpass error: all endpoints unavailable');
}

function buildAroundQuery(lat: number, lng: number, radiusKm: number): string {
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const filter = placeFilter(areaKm2);
  return `
    [out:json][timeout:8];
    (
      node[${filter}]["name"](around:${radiusKm * 1000},${lat},${lng});
    );
    out body;
  `.trim();
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Town[]> {
  return runOverpassQuery(buildAroundQuery(lat, lng, radiusKm));
}

export async function fetchTownsInArea(bbox: BoundingBox): Promise<Town[]> {
  return runOverpassQuery(buildBboxQuery(bbox));
}

export async function fetchTownsInPolygon(polygon: [number, number][]): Promise<Town[]> {
  return runOverpassQuery(buildPolygonQuery(polygon));
}
