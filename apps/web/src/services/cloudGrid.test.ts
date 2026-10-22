import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cloudGridRequestCount, decodeBase64, loadTile, parseTilePayload, resetCloudGridCache, stepForZoom,
  tilesForBounds, tilesAtStep, tilesHorizon, utcDayStart, CACHE_TTL_MS, getCachedTile, MAX_CONCURRENT,
  type Bounds, type CloudTile,
} from './cloudGrid.ts';

describe('stepForZoom', () => {
  it.each([[3, 1], [5, 1], [5.9, 0.5], [6, 0.5], [6.9, 0.5], [7, 0.25], [10, 0.25]])('zoom %s → %s°', (z, s) => {
    expect(stepForZoom(z)).toBe(s);
  });
});

describe('tilesForBounds', () => {
  it('covers the bounds with aligned tiles', () => {
    const { step, tiles } = tilesForBounds({ south: 47.5, north: 48.5, west: 7, east: 8.5 }, 8);
    expect(step).toBe(0.25);
    expect(tiles).toEqual([
      { step: 0.25, lat0: 46, lng0: 6 }, { step: 0.25, lat0: 46, lng0: 8 },
      { step: 0.25, lat0: 48, lng0: 6 }, { step: 0.25, lat0: 48, lng0: 8 },
    ]);
  });
  it('steps up to a coarser lattice when more than 16 tiles are needed', () => {
    const wide = { south: 40, north: 56, west: -5, east: 25 };
    const fine = tilesForBounds(wide, 8, 1000);
    expect(fine.tiles.length).toBeGreaterThan(16);
    const capped = tilesForBounds(wide, 8);
    expect(capped.tiles.length).toBeLessThanOrEqual(16);
    expect(capped.step).toBeGreaterThan(0.25);
  });
  it('clips to the supported area', () => {
    const { tiles } = tilesForBounds({ south: -10, north: 90, west: -170, east: 170 }, 2);
    expect(tiles.every((t) => t.lat0 + 8 > 30 && t.lat0 < 72 && t.lng0 + 8 > -25 && t.lng0 < 45)).toBe(true);
    expect(tilesForBounds({ south: -10, north: 10, west: 100, east: 120 }, 2).tiles).toEqual([]);
  });
});

describe('tilesAtStep coverage', () => {
  // Every lattice cell touching the view needs its tile: floor/ceil lattice points around each corner.
  it.each([0.25, 0.5, 1] as const)('covers all corners of a view incl. the strip beyond a tile\'s last point (step %s)', (step) => {
    const view: Bounds = { south: 48.9, north: 49.9, west: 11.0, east: 11.95 };
    const tiles = tilesAtStep(view, step);
    const edge = 8 * step;
    const covers = (lat: number, lng: number) => tiles.some((t) => lat >= t.lat0 && lat < t.lat0 + edge && lng >= t.lng0 && lng < t.lng0 + edge);
    for (const lat of [view.south, view.north]) for (const lng of [view.west, view.east]) {
      // the interpolation at (lat,lng) reads the lattice points floor and floor+step
      for (const dl of [0, step]) for (const dg of [0, step]) {
        expect(covers(Math.floor(lat / step) * step + dl, Math.floor(lng / step) * step + dg)).toBe(true);
      }
    }
  });
  it('requests the next tile at step 0.25 for the Bavaria repro (north 49.9 → lat0 50)', () => {
    const tiles = tilesAtStep({ south: 48.9, north: 49.9, west: 11.0, east: 11.95 }, 0.25);
    expect(tiles.map((t) => `${t.lat0}/${t.lng0}`).sort()).toEqual(['48/10', '48/12', '50/10', '50/12']);
  });
  it('never exceeds the served range', () => {
    const tiles = tilesAtStep({ south: 71, north: 72, west: 44, east: 45 }, 0.25);
    expect(tiles.every((t) => t.lat0 < 72 && t.lng0 < 45)).toBe(true);
  });
});

describe('cache freshness', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const mk = (startMs: number) => new Response(JSON.stringify({
    start: new Date(startMs).toISOString(), hours: 1, step: 1, lat0: 40, lng0: 0,
    values: btoa(String.fromCharCode(...new Uint8Array(64).fill(50))),
  }), { status: 200 });
  it('refetches after the TTL and when the tile starts before today (UTC)', async () => {
    resetCloudGridCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 22, 10));
    const f = vi.fn(async () => mk(Date.UTC(2026, 9, 22)));
    vi.stubGlobal('fetch', f);
    const ref = { step: 1 as const, lat0: 40, lng0: 0 };
    await loadTile(ref); await loadTile(ref);
    expect(f).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.UTC(2026, 9, 22, 10) + CACHE_TTL_MS + 1);
    expect(getCachedTile(ref)).toBeUndefined();
    await loadTile(ref);
    expect(f).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.UTC(2026, 9, 23, 0, 30)); // tab open overnight, within no TTL issue → still stale by date
    expect(getCachedTile(ref)).toBeUndefined();
  });
  it('tilesHorizon is the minimum end across tiles', () => {
    const t = (startMs: number, hours: number) => ({ startMs, hours } as CloudTile);
    expect(tilesHorizon([])).toBeNull();
    expect(tilesHorizon([t(0, 169), t(-24 * 3_600_000, 169)])).toBe(168 * 3_600_000 - 24 * 3_600_000);
  });
});

describe('parseTilePayload', () => {
  const ref = { step: 1 as const, lat0: 40, lng0: 0 };
  const b64 = (n: number) => btoa(String.fromCharCode(...new Uint8Array(n).fill(7)));
  it('decodes valid payloads and rejects mismatches', () => {
    expect(decodeBase64(btoa('\x01\x02'))).toEqual(new Uint8Array([1, 2]));
    const ok = parseTilePayload({ start: '2026-10-22T00:00:00.000Z', hours: 2, ...ref, values: b64(128) }, ref);
    expect(ok?.data.length).toBe(128);
    expect(parseTilePayload({ start: '2026-10-22T00:00:00.000Z', hours: 2, ...ref, values: b64(100) }, ref)).toBeNull();
    expect(parseTilePayload({ start: '2026-10-22T00:00:00.000Z', hours: 2, ...ref, lat0: 48, values: b64(128) }, ref)).toBeNull();
    expect(parseTilePayload(null, ref)).toBeNull();
  });
});

describe('loadTile', () => {
  beforeEach(() => resetCloudGridCache());
  afterEach(() => vi.unstubAllGlobals());

  const reply = (url: string) => {
    const u = new URL(url, 'http://x');
    return new Response(JSON.stringify({
      start: new Date(utcDayStart(Date.now())).toISOString(), hours: 1, step: Number(u.searchParams.get('step')),
      lat0: Number(u.searchParams.get('lat0')), lng0: Number(u.searchParams.get('lng0')),
      values: btoa(String.fromCharCode(...new Uint8Array(64).fill(50))),
    }), { status: 200 });
  };

  it('dedupes in-flight requests and caches the result', async () => {
    const f = vi.fn(async (url: string) => reply(url));
    vi.stubGlobal('fetch', f);
    const ref = { step: 1 as const, lat0: 40, lng0: 0 };
    const [a, b] = await Promise.all([loadTile(ref), loadTile(ref)]);
    expect(a).toBe(b);
    await loadTile(ref);
    expect(f).toHaveBeenCalledTimes(1);
    expect(cloudGridRequestCount()).toBe(1);
  });

  it('never runs more than 4 requests at once', async () => {
    let running = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return reply(url);
    }));
    await Promise.all(Array.from({ length: 10 }, (_, i) => loadTile({ step: 1, lat0: 40, lng0: -16 + 8 * (i % 8) + (i > 7 ? 0 : 0) + (i > 7 ? 64 : 0) })));
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT);
    expect(peak).toBeGreaterThan(1);
  });
});
