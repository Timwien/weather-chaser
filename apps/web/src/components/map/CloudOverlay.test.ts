import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { CloudTile, TileRef } from '../../services/cloudGrid.ts';

// In-memory stand-in for the /api/cloudgrid client: the test decides when a tile "arrives".
const cache = new Map<string, CloudTile>();
const pending: Array<{ ref: TileRef; resolve: () => void }> = [];
vi.mock('../../services/cloudGrid.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/cloudGrid.ts')>();
  return {
    ...real,
    getCachedTile: (ref: TileRef) => cache.get(real.tileKey(ref)),
    loadTile: (ref: TileRef) => new Promise<CloudTile>((resolve) => {
      pending.push({
        ref,
        resolve: () => {
          const tile: CloudTile = { ...ref, startMs: Date.now(), hours: 48, data: new Uint8Array(48 * 64) };
          cache.set(real.tileKey(ref), tile);
          resolve(tile);
        },
      });
    }),
  };
});

const { CloudOverlay } = await import('./CloudOverlay.ts');

/** Minimal MapLibre stand-in: a fixed viewport, no style (painting is not under test). */
function fakeMap(bounds: { west: number; south: number; east: number; north: number }, zoom = 6) {
  return {
    on: vi.fn(), off: vi.fn(), once: vi.fn(),
    getBounds: () => ({ getWest: () => bounds.west, getSouth: () => bounds.south, getEast: () => bounds.east, getNorth: () => bounds.north }),
    getZoom: () => zoom,
    getContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
    getStyle: () => ({ layers: [] }),
    getSource: () => undefined, getLayer: () => undefined,
    addSource: vi.fn(), addLayer: vi.fn(), setPaintProperty: vi.fn(), triggerRepaint: vi.fn(),
  } as unknown as MaplibreMap;
}

let frames: Array<() => void> = [];
const flushFrames = () => { const f = frames; frames = []; f.forEach((cb) => cb()); };
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('CloudOverlay status without a time (overlay attaches after the playback started)', () => {
  beforeEach(() => {
    cache.clear();
    pending.length = 0;
    frames = [];
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('fetches its tiles on attach and reports ready although nobody ever set a time', async () => {
    const statuses: string[] = [];
    const co = new CloudOverlay(fakeMap({ west: 6, south: 46, east: 10, north: 49 }), (s) => statuses.push(s));
    flushFrames();
    expect(pending.length).toBeGreaterThan(0); // the request is made without a setTime()
    expect(statuses.at(-1)).toBe('loading');
    pending.splice(0).forEach((p) => p.resolve());
    await settle();
    flushFrames(); // tile arrival schedules a redraw
    expect(statuses.at(-1)).toBe('ready');
    co.destroy();
  });

  it('a view outside the served lattice (nothing to fetch) counts as ready instead of loading forever', () => {
    const statuses: string[] = [];
    const co = new CloudOverlay(fakeMap({ west: -60, south: 0, east: -50, north: 10 }), (s) => statuses.push(s));
    flushFrames();
    expect(pending).toHaveLength(0);
    expect(statuses.at(-1)).toBe('ready');
    co.destroy();
  });
});
