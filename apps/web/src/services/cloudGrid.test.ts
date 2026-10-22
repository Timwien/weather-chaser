import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cloudGridRequestCount, decodeBase64, loadTile, parseTilePayload, resetCloudGridCache, stepForZoom,
  tilesForBounds, MAX_CONCURRENT,
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
      start: '2026-10-22T00:00:00.000Z', hours: 1, step: Number(u.searchParams.get('step')),
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
