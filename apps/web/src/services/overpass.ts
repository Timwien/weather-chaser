// Overpass API — tries primary endpoint first, falls back to mirror on 429/5xx
// Production (Phase 3): must proxy through own server
// Only fetches city/town/village nodes with name tags — excludes hamlets, isolated_dwelling, farm

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';

/** Endpoints tried in order; the first one to succeed wins */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function buildBboxQuery(bbox: BoundingBox): string {
  const { south, west, north, east } = bbox;
  return `
    [out:json][timeout:30];
    (
      node["place"~"^(city|town|village)$"]["name"](${south},${west},${north},${east});
    );
    out body;
  `.trim();
}

function buildPolygonQuery(polygon: [number, number][]): string {
  // Overpass poly format: "lat1 lng1 lat2 lng2 ..."
  const polyStr = polygon.map(([lng, lat]) => `${lat} ${lng}`).join(' ');
  return `
    [out:json][timeout:30];
    (
      node["place"~"^(city|town|village)$"]["name"](poly:"${polyStr}");
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
      signal: AbortSignal.timeout(35000),
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
  for (const url of OVERPASS_ENDPOINTS) {
    const result = await tryEndpoint(url, query);
    if (result !== null) return result;
  }
  throw new Error('Overpass error: all endpoints unavailable');
}

function buildAroundQuery(lat: number, lng: number, radiusM: number): string {
  return `
    [out:json][timeout:30];
    (
      node["place"~"^(city|town|village)$"]["name"](around:${radiusM},${lat},${lng});
    );
    out body;
  `.trim();
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Town[]> {
  return runOverpassQuery(buildAroundQuery(lat, lng, radiusKm * 1000));
}

export async function fetchTownsInArea(bbox: BoundingBox): Promise<Town[]> {
  return runOverpassQuery(buildBboxQuery(bbox));
}

export async function fetchTownsInPolygon(polygon: [number, number][]): Promise<Town[]> {
  return runOverpassQuery(buildPolygonQuery(polygon));
}
