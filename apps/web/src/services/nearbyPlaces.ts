// F2: "Nearby" suggestions — larger towns/cities close to already-chosen places,
// for one-tap adding. Fully offline & free: served from the bundled GeoNames
// dataset (/fallback-places.json, 8 604 EU places ≥ 15k pop) via loadPlaces().

import { loadPlaces } from './fallbackPlaces.ts';
import { haversineKm } from '../utils/geo.ts';

export interface NearbySuggestion {
  name: string;
  lat: number;
  lng: number;
  population: number;
  distanceKm: number;
}

interface Anchor {
  lat: number;
  lng: number;
}

interface SuggestOptions {
  limit?: number;
  maxKm?: number;
  /** Names already chosen — excluded from suggestions. */
  exclude?: Set<string>;
}

/**
 * Rank candidates near the anchors: prefer big cities, penalise distance.
 * score = population / (distanceKm + 10)²
 */
export async function suggestNearby(
  anchors: Anchor[],
  opts: SuggestOptions = {},
): Promise<NearbySuggestion[]> {
  const { limit = 6, maxKm = 75, exclude } = opts;
  if (anchors.length === 0) return [];

  const places = await loadPlaces();

  const scored: Array<NearbySuggestion & { score: number }> = [];
  for (const p of places) {
    if (exclude?.has(p.name)) continue;

    // Min distance to any anchor.
    let minDist = Infinity;
    for (const a of anchors) {
      const d = haversineKm(a.lat, a.lng, p.lat, p.lng);
      if (d < minDist) minDist = d;
    }
    if (minDist > maxKm) continue;
    // Skip a candidate sitting essentially on top of an anchor (already chosen).
    if (minDist < 1) continue;

    const population = p.population ?? 0;
    const score = population / (minDist + 10) ** 2;
    scored.push({ name: p.name, lat: p.lat, lng: p.lng, population, distanceKm: minDist, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ score: _score, ...rest }) => rest);
}
