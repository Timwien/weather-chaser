// Overpass API — uses public overpass-api.de for Phase 1 dev only
// Production (Phase 3): must proxy through own server
// Only fetches city/town/village nodes with name tags — excludes hamlets, isolated_dwelling, farm

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

async function runOverpassQuery(query: string): Promise<Town[]> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(35000),
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const data: { elements: OverpassNode[] } = await res.json();
  return parseTowns(data.elements);
}

export async function fetchTownsInArea(bbox: BoundingBox): Promise<Town[]> {
  return runOverpassQuery(buildBboxQuery(bbox));
}

export async function fetchTownsInPolygon(polygon: [number, number][]): Promise<Town[]> {
  return runOverpassQuery(buildPolygonQuery(polygon));
}
