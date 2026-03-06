// Nominatim geocoding — debounce at call site (500ms minimum)
// Policy: 1 req/s max, no automated bulk queries
// In production: routes through /api/proxy/nominatim (Vercel serverless)
// In dev: calls Nominatim directly (no Vercel CLI required for local dev)

// In production: route through /api/proxy/nominatim (Vercel serverless)
// In dev: call Nominatim directly (no Vercel CLI required for local dev)
const NOMINATIM_BASE = import.meta.env.PROD
  ? '/api/proxy/nominatim'
  : 'https://nominatim.openstreetmap.org/search';

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  place_id: number;
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export async function searchPlace(query: string): Promise<NominatimResult[]> {
  const url = new URL(NOMINATIM_BASE, self.location.origin);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');

  const headers: Record<string, string> = { 'Accept-Language': 'en' };
  if (import.meta.env.DEV) {
    // Nominatim policy requires a valid User-Agent / Referer — set only in dev (direct call)
    headers['Referer'] = self.location.origin;
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}

export function parseBbox(result: NominatimResult): BoundingBox {
  const [south, north, west, east] = result.boundingbox.map(Number);
  return { south, north, west, east };
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const results = await searchPlace(query);
  if (results.length === 0) return null;
  const first = results[0];
  return { lat: Number(first.lat), lng: Number(first.lon), name: first.display_name };
}
