import { describe, it, expect } from 'vitest';
import {
  bboxOfTile, TileCache, tileFromBbox, tilesForViewport, wmsTileKey, wmsTileZoom,
} from './wmsTileCache.ts';

const url = (bbox: string, extra = '') =>
  `https://maps.dwd.de/geoserver/dwd/wms?service=WMS&layers=Niederschlagsradar&bbox=${bbox}&width=256&time=2026-10-22T18%3A00%3A00.000Z${extra}`;

describe('tile maths', () => {
  it('bbox ↔ tile round trip, also for MapLibre-style float spellings', () => {
    for (const [z, x, y] of [[0, 0, 0], [5, 16, 10], [7, 66, 42], [10, 540, 340]]) {
      const bb = bboxOfTile(z, x, y);
      expect(tileFromBbox(bb)).toEqual({ z, x, y });
      const jittered = bb.map((v) => v + 1e-6) as typeof bb;
      expect(tileFromBbox(jittered)).toEqual({ z, x, y });
    }
  });

  it('tile 5/16/10 is the known EPSG:3857 box', () => {
    const [minx, miny, maxx, maxy] = bboxOfTile(5, 16, 10);
    expect(minx).toBeCloseTo(0, 3);
    expect(maxx).toBeCloseTo(1252344.271424327, 3);
    expect(miny).toBeCloseTo(6261721.357121639, 3);
    expect(maxy).toBeCloseTo(7514065.628545966, 3);
  });

  it('tilesForViewport covers Germany at z6 and respects the bounds', () => {
    const tiles = tilesForViewport({ west: 6, south: 47.3, east: 15, north: 55 }, 6);
    expect(tiles.every((t) => t.z === 6)).toBe(true);
    expect(tiles.map((t) => `${t.x}/${t.y}`).sort()).toEqual(['33/20', '33/21', '33/22', '34/20', '34/21', '34/22']);
  });

  it('wmsTileZoom follows MapLibre for 512-px tiles (rounded, capped at maxzoom)', () => {
    expect(wmsTileZoom(5.5)).toBe(6);
    expect(wmsTileZoom(5.4)).toBe(5);
    expect(wmsTileZoom(9.9)).toBe(9);
    expect(wmsTileZoom(0)).toBe(0);
  });
});

describe('wmsTileKey', () => {
  const bb = bboxOfTile(7, 66, 42);
  it('is independent of the bbox spelling and other params', () => {
    const a = wmsTileKey(url(bb.join(',')));
    const b = wmsTileKey(url(bb.map((v) => v.toFixed(3)).join(',')) + '&styles=');
    expect(a).toBe(b);
  });
  it('differs by layer, time, tile and colour variant', () => {
    const base = wmsTileKey(url(bb.join(',')));
    expect(wmsTileKey(url(bb.join(',')).replace('radar', 'x'))).not.toBe(base);
    expect(wmsTileKey(url(bb.join(',')).replace('18%3A', '19%3A'))).not.toBe(base);
    expect(wmsTileKey(url(bboxOfTile(7, 67, 42).join(',')))).not.toBe(base);
    expect(wmsTileKey(url(bb.join(','), '#dark'))).not.toBe(wmsTileKey(url(bb.join(','), '#light')));
  });
});

describe('TileCache', () => {
  const buf = (n: number) => new ArrayBuffer(n);

  it('evicts the least recently used entry beyond maxEntries', () => {
    const c = new TileCache(2, 1e9);
    c.set('a', buf(1), 1000); c.set('b', buf(1), 1000);
    c.get('a'); // a is now most recent
    c.set('c', buf(1), 1000);
    expect([c.has('a'), c.has('b'), c.has('c')]).toEqual([true, false, true]);
  });

  it('evicts by total bytes and keeps the byte count exact', () => {
    const c = new TileCache(100, 10);
    c.set('a', buf(6), 1000); c.set('b', buf(6), 1000);
    expect([c.has('a'), c.has('b'), c.bytes]).toEqual([false, true, 6]);
    c.set('b', buf(3), 1000); // replace
    expect(c.bytes).toBe(3);
  });

  it('expires entries', () => {
    let now = 0;
    const c = new TileCache(10, 100, () => now);
    c.set('a', buf(1), 50);
    now = 49; expect(c.has('a')).toBe(true);
    now = 50; expect(c.has('a')).toBe(false);
    expect(c.size).toBe(0);
  });
});
