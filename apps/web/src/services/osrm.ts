import type { Town } from '@weatherchaser/core';

// In dev: proxied through Vite server (/osrm → localhost:5000) to avoid CORS.
// Falls back to the public OSRM demo API if the proxy is unavailable (dev only).
// In production: set VITE_OSRM_URL to a self-hosted OSRM endpoint; falls back to Haversine.
// Public OSRM demo server is prohibited in production per ToS — guarded behind !import.meta.env.PROD.
const OSRM_URL = import.meta.env.VITE_OSRM_URL ?? '/osrm';
const OSRM_PUBLIC_URL = 'https://router.project-osrm.org';

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

async function tryOsrm(baseUrl: string, coords: string): Promise<DistanceMatrix> {
  const url = `${baseUrl}/table/v1/driving/${coords}?annotations=duration,distance`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data: { durations: number[][]; distances: number[][] } = await res.json();
  return { durations: data.durations, distances: data.distances };
}

/**
 * Pre-compute the NxN distance matrix via OSRM /table endpoint.
 * Tries the configured/proxied OSRM first, then the public OSRM demo API,
 * and finally falls back to straight-line Haversine distances.
 */
export async function fetchDistanceMatrix(towns: Town[]): Promise<DistanceMatrix> {
  if (towns.length === 0) return { durations: [], distances: [] };

  const coords = towns.map((t) => `${t.lng},${t.lat}`).join(';');

  // 1. Try configured/proxied OSRM (dev proxy or VITE_OSRM_URL)
  try {
    return await tryOsrm(OSRM_URL, coords);
  } catch {
    // fall through
  }

  // 2. Try public OSRM demo API — only in dev (prohibited in production per ToS)
  if (!import.meta.env.PROD) {
    try {
      const result = await tryOsrm(OSRM_PUBLIC_URL, coords);
      console.info('[OSRM] Using public demo API');
      return result;
    } catch {
      // fall through
    }
  }

  // 3. Last resort: straight-line Haversine
  console.warn('[OSRM] Unavailable — using straight-line Haversine fallback');
  return buildHaversineFallback(towns);
}
