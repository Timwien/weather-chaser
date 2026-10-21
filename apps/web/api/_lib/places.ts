// Pure query logic for /api/places — no I/O, no framework types, unit-tested.
// Data: GeoNames cities1000 (CC BY 4.0, https://www.geonames.org/), built by
// scripts/build-places.mjs into api/_data/places.json (sorted by population desc).

/** [geonameId, name, lat, lng, population, nameDe|0, nameEn|0] */
export type PlaceTuple = readonly [number, string, number, number, number, string | 0, string | 0];

export type PlaceLang = 'de' | 'en';

export interface PlaceOut {
  id: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
}

export interface PlacesQuery {
  /** [south, west, north, east] */
  bbox?: [number, number, number, number];
  center?: { lat: number; lng: number; radiusKm: number };
  minPop: number;
  limit: number;
  lang: PlaceLang;
}

export const MAX_LIMIT = 1500;
export const DEFAULT_LIMIT = 800;
export const MAX_RADIUS_KM = 600;
export const MAX_BBOX_LAT_SPAN = 25;
export const MAX_BBOX_LNG_SPAN = 40;

const ALLOWED_PARAMS = new Set(['bbox', 'lat', 'lng', 'radiusKm', 'minPop', 'limit', 'lang']);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Strict number parsing: rejects '', 'NaN', '1e999', '12abc'. */
function num(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type ParseResult = { ok: true; query: PlacesQuery } | { ok: false; error: string };

/** Validate request params → typed query. Unknown params are rejected (CDN cache-busting). */
export function parsePlacesQuery(params: URLSearchParams): ParseResult {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) return { ok: false, error: `unknown parameter: ${key}` };
  }

  const minPop = params.has('minPop') ? num(params.get('minPop')) : 0;
  if (minPop === null || minPop < 0 || minPop > 10_000_000) return { ok: false, error: 'invalid minPop' };

  const limitRaw = params.has('limit') ? num(params.get('limit')) : DEFAULT_LIMIT;
  if (limitRaw === null || limitRaw < 1) return { ok: false, error: 'invalid limit' };
  const limit = Math.min(MAX_LIMIT, Math.floor(limitRaw));

  const langRaw = params.get('lang') ?? 'en';
  const lang: PlaceLang = langRaw === 'de' ? 'de' : 'en';

  const hasBbox = params.has('bbox');
  const hasCenter = params.has('lat') || params.has('lng') || params.has('radiusKm');
  if (hasBbox === hasCenter) return { ok: false, error: 'provide either bbox or lat,lng,radiusKm' };

  if (hasBbox) {
    const parts = (params.get('bbox') ?? '').split(',').map((p) => num(p));
    if (parts.length !== 4 || parts.some((p) => p === null)) return { ok: false, error: 'invalid bbox' };
    const [south, west, north, east] = parts as [number, number, number, number];
    if (south < -90 || north > 90 || west < -180 || east > 180 || south > north || west > east) {
      return { ok: false, error: 'invalid bbox' };
    }
    if (north - south > MAX_BBOX_LAT_SPAN || east - west > MAX_BBOX_LNG_SPAN) {
      return { ok: false, error: 'bbox too large' };
    }
    return { ok: true, query: { bbox: [south, west, north, east], minPop, limit, lang } };
  }

  const lat = num(params.get('lat'));
  const lng = num(params.get('lng'));
  const radiusKm = num(params.get('radiusKm'));
  if (lat === null || lng === null || radiusKm === null) return { ok: false, error: 'invalid lat, lng or radiusKm' };
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: 'invalid lat or lng' };
  if (radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) return { ok: false, error: 'invalid radiusKm' };
  return { ok: true, query: { center: { lat, lng, radiusKm }, minPop, limit, lang } };
}

function localName(p: PlaceTuple, lang: PlaceLang): string {
  const local = lang === 'de' ? p[5] : p[6];
  return local || p[1];
}

/** Filter by bbox or radius + minPop, keep dataset order (population desc), cap at limit. */
export function queryPlaces(data: readonly PlaceTuple[], q: PlacesQuery): PlaceOut[] {
  let south = -90, west = -180, north = 90, east = 180;
  if (q.bbox) {
    [south, west, north, east] = q.bbox;
  } else if (q.center) {
    const { lat, lng, radiusKm } = q.center;
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
    south = lat - dLat; north = lat + dLat; west = lng - dLng; east = lng + dLng;
  }

  const out: PlaceOut[] = [];
  for (const p of data) {
    if (p[4] < q.minPop) continue;
    const plat = p[2], plng = p[3];
    if (plat < south || plat > north || plng < west || plng > east) continue;
    if (q.center && haversineKm(q.center.lat, q.center.lng, plat, plng) > q.center.radiusKm) continue;
    out.push({ id: `gn-${p[0]}`, name: localName(p, q.lang), lat: plat, lng: plng, population: p[4] });
    if (out.length >= q.limit) break;
  }
  return out;
}
