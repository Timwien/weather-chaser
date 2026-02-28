// Nominatim geocoding — debounce at call site (500ms minimum)
// Policy: 1 req/s max, no automated bulk queries
// Phase 1 dev only — Phase 3 adds a proxy

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
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'en',
      // Nominatim policy requires a valid User-Agent / Referer
      'Referer': window.location.origin,
    },
  });

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
