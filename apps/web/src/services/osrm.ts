import type { Town } from '@weatherchaser/core';

// In dev: proxied through Vite server (/osrm → localhost:5000) to avoid CORS.
// In production: set VITE_OSRM_URL to the real OSRM endpoint.
const OSRM_URL = import.meta.env.VITE_OSRM_URL ?? '/osrm';

export interface DistanceMatrix {
  durations: number[][];  // seconds NxN
  distances: number[][];  // meters NxN
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildHaversineFallback(towns: Town[]): DistanceMatrix {
  const n = towns.length;
  const distances = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      haversineKm(towns[i].lat, towns[i].lng, towns[j].lat, towns[j].lng) * 1000,
    ),
  );
  // Rough 70 km/h average driving speed for duration estimate
  const durations = distances.map((row) => row.map((d) => (d / 1000 / 70) * 3600));
  return { distances, durations };
}

/**
 * Pre-compute the NxN distance matrix via OSRM /table endpoint.
 * Falls back to straight-line Haversine distances if OSRM is unavailable.
 */
export async function fetchDistanceMatrix(towns: Town[]): Promise<DistanceMatrix> {
  if (towns.length === 0) return { durations: [], distances: [] };

  try {
    const coords = towns.map((t) => `${t.lng},${t.lat}`).join(';');
    const url = `${OSRM_URL}/table/v1/driving/${coords}?annotations=duration,distance`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM error: ${res.status}`);

    const data: { durations: number[][]; distances: number[][] } = await res.json();
    return { durations: data.durations, distances: data.distances };
  } catch {
    console.warn('[OSRM] Unavailable — using straight-line Haversine fallback');
    return buildHaversineFallback(towns);
  }
}
