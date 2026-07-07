// Static place fallback — used ONLY when every Overpass endpoint fails.
//
// The public Overpass infrastructure has full outages (measured 2026-06-11:
// all three mirrors down simultaneously, from local AND Vercel networks).
// Without a fallback that takes WeatherChaser's core feature down with it.
//
// Dataset: /fallback-places.json — 8 604 European places with ≥15 000
// population from GeoNames (CC-BY 4.0, geonames.org), built as compact
// [name, lat, lng, population] tuples (~300 KB, lazy-loaded once on first
// failure, then cached). Effectively the "cities" granularity tier.

import type { Town } from '@weatherchaser/core';
import type { BoundingBox } from './nominatim.ts';
import { haversineKm, pointInPolygon } from '../utils/geo.ts';

type PlaceTuple = [string, number, number, number];

let cache: Town[] | null = null;
let loading: Promise<Town[]> | null = null;

export async function loadPlaces(): Promise<Town[]> {
  if (cache) return cache;
  loading ??= (async () => {
    const url = new URL('/fallback-places.json', self.location.origin);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`fallback dataset unavailable: ${res.status}`);
    const tuples = (await res.json()) as PlaceTuple[];
    cache = tuples.map(([name, lat, lng, population], i) => ({
      id: `gn-${i}`,
      name,
      lat,
      lng,
      population,
    }));
    return cache;
  })();
  return loading;
}

export async function fallbackPlacesInBbox(bbox: BoundingBox): Promise<Town[]> {
  const places = await loadPlaces();
  return places.filter(
    (p) => p.lat >= bbox.south && p.lat <= bbox.north && p.lng >= bbox.west && p.lng <= bbox.east,
  );
}

export async function fallbackPlacesInRadius(lat: number, lng: number, radiusKm: number): Promise<Town[]> {
  const places = await loadPlaces();
  return places.filter((p) => haversineKm(lat, lng, p.lat, p.lng) <= radiusKm);
}

export async function fallbackPlacesInPolygon(polygon: [number, number][]): Promise<Town[]> {
  const places = await loadPlaces();
  return places.filter((p) => pointInPolygon(p.lat, p.lng, polygon));
}
