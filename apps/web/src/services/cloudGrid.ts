// Client side of the cloud-cover lattice (see api/_lib/cloudgrid.ts for the
// lattice convention): zoom → step, covering tiles, throttled fetch with
// in-flight dedupe + session cache, base64 decoding.

import { fetchJsonWithRetry } from './fetchRetry.ts';

export const GRID_N = 8;
export const LAT_RANGE = [30, 72] as const;
export const LNG_RANGE = [-25, 45] as const;
export const MAX_TILES = 16;
export const MAX_CONCURRENT = 4;
const FAIL_COOLDOWN_MS = 30_000;
const CACHE_MAX = 96;

export type Step = 1 | 0.5 | 0.25;
const STEPS: Step[] = [1, 0.5, 0.25];

export interface Bounds { south: number; west: number; north: number; east: number }
export interface TileRef { step: Step; lat0: number; lng0: number }
export interface CloudTile extends TileRef {
  /** instant (ms) of hour index 0 */
  startMs: number;
  hours: number;
  /** hour-major: data[hour × 64 + row × 8 + col], cloud cover 0..100 */
  data: Uint8Array;
}

export function stepForZoom(zoom: number): Step {
  return zoom <= 5 ? 1 : zoom < 7 ? 0.5 : 0.25;
}

export const tileEdge = (step: Step) => GRID_N * step;
export const tileKey = (t: TileRef) => `${t.step}/${t.lat0}/${t.lng0}`;

/**
 * Tiles (aligned to the lattice) covering `bounds`, clipped to the supported
 * area. If more than `cap` tiles would be needed the next coarser step is used.
 */
export function tilesForBounds(bounds: Bounds, zoom: number, cap = MAX_TILES): { step: Step; tiles: TileRef[] } {
  const south = Math.max(bounds.south, LAT_RANGE[0]);
  const north = Math.min(bounds.north, LAT_RANGE[1]);
  const west = Math.max(bounds.west, LNG_RANGE[0]);
  const east = Math.min(bounds.east, LNG_RANGE[1]);
  let idx = STEPS.indexOf(stepForZoom(zoom));
  for (;;) {
    const step = STEPS[idx];
    const edge = tileEdge(step);
    const tiles: TileRef[] = [];
    if (south < north && west < east) {
      for (let lat0 = Math.floor(south / edge) * edge; lat0 < north; lat0 += edge) {
        for (let lng0 = Math.floor(west / edge) * edge; lng0 < east; lng0 += edge) {
          tiles.push({ step, lat0, lng0 });
        }
      }
    }
    if (tiles.length <= cap || idx === 0) return { step, tiles };
    idx--;
  }
}

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Validates an API payload; null when malformed. */
export function parseTilePayload(raw: unknown, ref: TileRef): CloudTile | null {
  const p = raw as Partial<{ start: string; hours: number; step: number; lat0: number; lng0: number; values: string }> | null;
  if (!p || typeof p.values !== 'string' || typeof p.start !== 'string' || !Number.isInteger(p.hours)) return null;
  if (p.step !== ref.step || p.lat0 !== ref.lat0 || p.lng0 !== ref.lng0) return null;
  const hours = p.hours as number;
  const data = decodeBase64(p.values);
  const startMs = Date.parse(p.start);
  if (hours < 1 || data.length !== hours * GRID_N * GRID_N || !Number.isFinite(startMs)) return null;
  return { ...ref, startMs, hours, data };
}

// ── fetch with cache / dedupe / concurrency cap ───────────────────────────
const cache = new Map<string, CloudTile>();
const inFlight = new Map<string, Promise<CloudTile>>();
const failedAt = new Map<string, number>();
const queue: Array<() => void> = [];
let active = 0;
let requestCount = 0;

/** Number of /api/cloudgrid requests started (diagnostics + tests). */
export const cloudGridRequestCount = () => requestCount;

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(); }
  return new Promise((resolve) => queue.push(() => { active++; resolve(); }));
}
function release() {
  active--;
  queue.shift()?.();
}

export function getCachedTile(ref: TileRef): CloudTile | undefined {
  const hit = cache.get(tileKey(ref));
  if (hit) { cache.delete(tileKey(ref)); cache.set(tileKey(ref), hit); } // LRU touch
  return hit;
}

export function loadTile(ref: TileRef): Promise<CloudTile> {
  const key = tileKey(ref);
  const hit = getCachedTile(ref);
  if (hit) return Promise.resolve(hit);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const failed = failedAt.get(key);
  if (failed && Date.now() - failed < FAIL_COOLDOWN_MS) return Promise.reject(new Error('cloudgrid_cooldown'));

  const p = (async () => {
    await acquire();
    try {
      requestCount++;
      const url = `/api/cloudgrid?step=${ref.step}&lat0=${ref.lat0}&lng0=${ref.lng0}`;
      const tile = parseTilePayload(await fetchJsonWithRetry(url, { attempts: 2, timeoutMs: 15_000 }), ref);
      if (!tile) throw new Error('unexpected response');
      cache.set(key, tile);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      failedAt.delete(key);
      return tile;
    } catch (err) {
      failedAt.set(key, Date.now());
      throw new Error(`cloudgrid_unavailable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      release();
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

/** Test hook: forget everything. */
export function resetCloudGridCache() {
  cache.clear(); inFlight.clear(); failedAt.clear(); queue.length = 0; active = 0; requestCount = 0;
}
