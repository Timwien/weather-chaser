// Nominatim geocoding — debounce at call site (500ms minimum)
// Policy: 1 req/s max, no automated bulk queries
// In production: routes through /api/proxy/nominatim (Vercel serverless)
// In dev: calls Nominatim directly (no Vercel CLI required for local dev)

// In production: route through /api/proxy/nominatim (Vercel serverless)
// In dev: call Nominatim directly (no Vercel CLI required for local dev)
const NOMINATIM_BASE = import.meta.env.PROD
  ? '/api/proxy/nominatim'
  : 'https://nominatim.openstreetmap.org/search';

const NOMINATIM_REVERSE_BASE = import.meta.env.PROD
  ? '/api/proxy/nominatim-reverse'
  : 'https://nominatim.openstreetmap.org/reverse';

const TIMEOUT_MS = 8000;

export interface NominatimAddress {
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  hamlet?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country?: string;
}

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  place_id: number;
  address?: NominatimAddress; // present when addressdetails=1
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Normalise an i18n language tag to a 2-letter code Nominatim understands. */
function normalizeLang(lang: string): string {
  return (lang || 'en').slice(0, 2).toLowerCase();
}

async function nominatimSearch(
  query: string,
  lang: string,
  featureType?: 'settlement',
): Promise<NominatimResult[]> {
  const url = new URL(NOMINATIM_BASE, self.location.origin);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');
  // F4: language as a URL param (not a header) so the proxy cache separates per
  // language — cache key is the full URL. Nominatim honours accept-language here.
  url.searchParams.set('accept-language', normalizeLang(lang));
  // D9: prefer settlements over pubs/companies/streets
  if (featureType) url.searchParams.set('featureType', featureType);

  const headers: Record<string, string> = {};
  if (import.meta.env.DEV) {
    // Nominatim policy requires a valid User-Agent / Referer — set only in dev (direct call)
    headers['Referer'] = self.location.origin;
  }

  const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}

/** Half-width (degrees) of the synthetic bbox for a point-only local match. */
const LOCAL_BBOX_PAD = 0.05;

/** Name-prefix match against our bundled GeoNames dataset (Nominatim does no prefix matching). */
async function searchLocalPrefix(query: string, lang: string): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL('/api/places', self.location.origin);
  url.searchParams.set('q', q);
  url.searchParams.set('lang', normalizeLang(lang) === 'de' ? 'de' : 'en');
  url.searchParams.set('limit', '4');
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  const raw = (await res.json()) as Array<{ id: string; name: string; lat: number; lng: number }>;
  if (!Array.isArray(raw)) return [];
  return raw.map((p, i) => ({
    display_name: p.name,
    lat: String(p.lat),
    lon: String(p.lng),
    boundingbox: [
      String(p.lat - LOCAL_BBOX_PAD), String(p.lat + LOCAL_BBOX_PAD),
      String(p.lng - LOCAL_BBOX_PAD), String(p.lng + LOCAL_BBOX_PAD),
    ] as [string, string, string, string],
    place_id: -(i + 1) - Number(p.id.replace(/\D/g, '') || 0),
  }));
}

/** True when two results are the same place (same lowercase first name part and < 5 km apart). */
function samePlace(a: NominatimResult, b: NominatimResult): boolean {
  const name = (r: NominatimResult) => r.display_name.split(',')[0].trim().toLowerCase();
  if (name(a) !== name(b)) return false;
  return Math.hypot(Number(a.lat) - Number(b.lat), Number(a.lon) - Number(b.lon)) < 0.05;
}

/**
 * D9: place search that prefers settlements. Local GeoNames prefix matches
 * (so "Inns" finds Innsbruck) come first, then Nominatim restricted to
 * featureType=settlement; if that yields nothing we fall back to the plain search.
 */
export async function searchPlace(query: string, lang = 'en'): Promise<NominatimResult[]> {
  const [local, remote] = await Promise.allSettled([
    searchLocalPrefix(query, lang),
    nominatimSearch(query, lang, 'settlement'),
  ]);
  const localRes = local.status === 'fulfilled' ? local.value : [];
  let remoteRes = remote.status === 'fulfilled' ? remote.value : [];

  if (remote.status === 'fulfilled' && remoteRes.length === 0 && localRes.length === 0) {
    remoteRes = await nominatimSearch(query, lang);
  } else if (remote.status === 'rejected' && localRes.length === 0) {
    throw remote.reason;
  }

  const merged = [...localRes];
  for (const r of remoteRes) if (!merged.some((m) => samePlace(m, r))) merged.push(r);
  return merged.slice(0, 6);
}

export function parseBbox(result: NominatimResult): BoundingBox {
  const [south, north, west, east] = result.boundingbox.map(Number);
  return { south, north, west, east };
}

export async function geocodeAddress(query: string, lang = 'en'): Promise<{ lat: number; lng: number; name: string } | null> {
  const results = await searchPlace(query, lang);
  if (results.length === 0) return null;
  const first = results[0];
  return { lat: Number(first.lat), lng: Number(first.lon), name: first.display_name };
}

const SETTLEMENT_KEYS = ['village', 'town', 'city', 'municipality', 'hamlet'] as const;

/** Best settlement-level name for a reverse result; null if nothing usable.
 *  Deliberately skips `suburb` — a tap inside a city district should name the city. */
export function settlementName(result: NominatimResult): string | null {
  const addr = result.address;
  if (addr) {
    for (const key of SETTLEMENT_KEYS) {
      if (addr[key]) return addr[key]!;
    }
  }
  const first = result.display_name?.split(',')[0]?.trim();
  return first || null;
}

export async function reverseGeocode(lat: number, lng: number, lang = 'en'): Promise<NominatimResult | null> {
  const url = new URL(NOMINATIM_REVERSE_BASE, self.location.origin);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  // zoom=13 caps detail at village/suburb level — never a street or house number
  url.searchParams.set('zoom', '13');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', normalizeLang(lang));
  const headers: Record<string, string> = {};
  if (import.meta.env.DEV) headers['Referer'] = self.location.origin;
  const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  return res.json();
}
