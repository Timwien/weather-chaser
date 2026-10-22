// Pure helpers for the WMS tile cache: Web-Mercator tile maths, the normalised
// cache key and a small LRU. No DOM access — unit-testable.

/** Half the Web-Mercator world width in metres (EPSG:3857). */
export const WORLD = 20037508.342789244;

export type Bbox = [number, number, number, number]; // minx, miny, maxx, maxy
export interface TileCoord { z: number; x: number; y: number }
export interface LngLatBounds { west: number; south: number; east: number; north: number }

/** EPSG:3857 bbox of an XYZ tile. */
export function bboxOfTile(z: number, x: number, y: number): Bbox {
  const s = (2 * WORLD) / 2 ** z;
  return [-WORLD + x * s, WORLD - (y + 1) * s, -WORLD + (x + 1) * s, WORLD - y * s];
}

/** XYZ tile of a (tile-aligned) bbox as MapLibre requests it; null when it is not tile-shaped. */
export function tileFromBbox(bbox: Bbox): TileCoord | null {
  const size = bbox[2] - bbox[0];
  if (!(size > 0)) return null;
  const z = Math.round(Math.log2((2 * WORLD) / size));
  if (z < 0 || z > 24) return null;
  const x = Math.round((bbox[0] + WORLD) / size) || 0; // `|| 0` folds -0
  const y = Math.round((WORLD - bbox[3]) / size) || 0;
  return { z, x, y };
}

const mercX = (lng: number) => ((lng + 180) / 360);
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

/** All XYZ tiles at zoom z intersecting the bounds (x wraps are not handled: bounds stay inside ±180°). */
export function tilesForViewport(bounds: LngLatBounds, z: number): TileCoord[] {
  const n = 2 ** z;
  const clampIdx = (v: number) => Math.min(n - 1, Math.max(0, Math.floor(v * n)));
  const x0 = clampIdx(mercX(Math.max(-180, bounds.west)));
  const x1 = clampIdx(mercX(Math.min(180, bounds.east)));
  const y0 = clampIdx(mercY(bounds.north));
  const y1 = clampIdx(mercY(bounds.south));
  const out: TileCoord[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ z, x, y });
  return out;
}

/**
 * Normalised cache key of a WMS GetMap tile URL: layer + time + z/x/y derived from the
 * bbox (so the float spelling of the bbox does not matter) + the `#variant` fragment.
 */
export function wmsTileKey(url: string): string {
  try {
    const u = new URL(url);
    const layer = u.searchParams.get('layers') ?? '';
    const time = u.searchParams.get('time') ?? '';
    const bbox = (u.searchParams.get('bbox') ?? '').split(',').map(Number);
    const tile = bbox.length === 4 && bbox.every(Number.isFinite) ? tileFromBbox(bbox as Bbox) : null;
    const where = tile ? `${tile.z}/${tile.x}/${tile.y}` : u.searchParams.get('bbox') ?? '';
    return `${layer}|${time}|${u.hash.slice(1)}|${where}`;
  } catch {
    return url;
  }
}

interface Entry { data: ArrayBuffer; bytes: number; expires: number }

/** LRU of processed tiles, bounded by entry count and total bytes, entries expire. */
export class TileCache {
  private map = new Map<string, Entry>();
  private total = 0;

  constructor(private maxEntries = 1200, private maxBytes = 64 * 1024 * 1024, private now: () => number = Date.now) {}

  get size() { return this.map.size; }
  get bytes() { return this.total; }

  has(key: string): boolean {
    const e = this.map.get(key);
    if (!e) return false;
    if (e.expires <= this.now()) { this.delete(key); return false; }
    return true;
  }

  /** Returns the buffer and marks the entry most recently used. */
  get(key: string): ArrayBuffer | undefined {
    if (!this.has(key)) return undefined;
    const e = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, e);
    return e.data;
  }

  set(key: string, data: ArrayBuffer, ttlMs: number) {
    this.delete(key);
    this.map.set(key, { data, bytes: data.byteLength, expires: this.now() + ttlMs });
    this.total += data.byteLength;
    while (this.map.size > this.maxEntries || this.total > this.maxBytes) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined || oldest === key) break;
      this.delete(oldest);
    }
  }

  delete(key: string) {
    const e = this.map.get(key);
    if (e) { this.total -= e.bytes; this.map.delete(key); }
  }

  clear() { this.map.clear(); this.total = 0; }
}

/**
 * Zoom of the 512-px WMS tiles MapLibre requests for a map zoom (raster sources round),
 * clamped to the source's maxzoom.
 */
export function wmsTileZoom(mapZoom: number, maxzoom = 9): number {
  return Math.min(maxzoom, Math.max(0, Math.round(mapZoom)));
}
