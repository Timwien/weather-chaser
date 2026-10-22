import { inflateSync } from 'node:zlib';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearRadarMask, recolorDrizzle, DRIZZLE_RGBA, EMPTY_PNG, loadWmsTile, tileCache, hasWmsTile, wmsFetchCount } from './wmsProtocol.ts';
import { bboxOfTile } from '../../services/wmsTileCache.ts';

const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

describe('clearRadarMask', () => {
  it('removes the coverage veil and the magenta outline', () => {
    const data = px([126, 126, 126, 77], [255, 0, 255, 255], [230, 40, 230, 200]);
    clearRadarMask(data);
    expect([data[3], data[7], data[11]]).toEqual([0, 0, 0]);
  });

  it('keeps precipitation colours and transparent pixels', () => {
    const data = px([51, 255, 255, 255], [1, 153, 52, 255], [204, 230, 1, 255], [255, 255, 255, 0]);
    const before = Array.from(data);
    clearRadarMask(data);
    expect(Array.from(data)).toEqual(before);
  });
});

describe('recolorDrizzle', () => {
  it('turns the grey lightest rain class pale blue and leaves other classes alone', () => {
    const data = px([192, 192, 192, 255], [254, 254, 192, 255], [96, 96, 96, 255], [255, 255, 255, 0]);
    recolorDrizzle(data);
    expect(Array.from(data.slice(0, 4))).toEqual([...DRIZZLE_RGBA]);
    expect(Array.from(data.slice(4))).toEqual([254, 254, 192, 255, 96, 96, 96, 255, 255, 255, 255, 0]);
  });
});

describe('loadWmsTile (shared cache + dedupe)', () => {
  const url = (x: number, extra = '') =>
    `https://maps.dwd.de/geoserver/dwd/wms?service=WMS&layers=Niederschlagsradar&styles=&bbox=${bboxOfTile(6, x, 20).join(',')}&time=2026-10-22T10%3A00%3A00.000Z${extra}`;
  const okImage = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
  afterEach(() => { vi.unstubAllGlobals(); tileCache.clear(); });

  it('fetches once; the second load (different bbox spelling) is served from the cache', async () => {
    const fetchMock = vi.fn(async () => okImage());
    vi.stubGlobal('fetch', fetchMock);
    await loadWmsTile(url(33));
    expect(hasWmsTile(url(33).replace(/bbox=[^&]+/, (m) => m + '0001'))).toBe(true);
    await loadWmsTile(url(33));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('concurrent requests share one fetch; each gets its own copy of the buffer', async () => {
    const fetchMock = vi.fn(async () => okImage());
    vi.stubGlobal('fetch', fetchMock);
    const before = wmsFetchCount();
    const [a, b] = await Promise.all([loadWmsTile(url(34)), loadWmsTile(url(34))]);
    expect(wmsFetchCount() - before).toBe(1);
    expect(a).not.toBe(b);
    expect(new Uint8Array(a)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('a gap (200 + XML exception) yields a transparent tile and is cached', async () => {
    const fetchMock = vi.fn(async () => new Response('<ServiceException/>', { status: 200, headers: { 'content-type': 'text/xml' } }));
    vi.stubGlobal('fetch', fetchMock);
    const tile = await loadWmsTile(url(35));
    expect(tile.byteLength).toBeGreaterThan(0);
    await loadWmsTile(url(35));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an aborted caller rejects with AbortError, the fetch is cancelled only when no one else waits', async () => {
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => {
      fetchSignal = init?.signal ?? undefined;
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))));
    }));
    const c1 = new AbortController();
    const c2 = new AbortController();
    const p1 = loadWmsTile(url(36), c1.signal);
    const p2 = loadWmsTile(url(36), c2.signal);
    c1.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSignal?.aborted).toBe(false);
    c2.abort();
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSignal?.aborted).toBe(true);
  });
});

describe('loadWmsTile abort then immediate re-request', () => {
  afterEach(() => { vi.unstubAllGlobals(); tileCache.clear(); });
  it('a new caller in the same tick does not join the cancelled fetch', async () => {
    const u = `https://maps.dwd.de/geoserver/dwd/wms?service=WMS&layers=Niederschlagsradar&styles=&bbox=${bboxOfTile(6, 40, 20).join(',')}&time=2026-10-22T10%3A00%3A00.000Z`;
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => {
      calls++;
      if (calls === 1) return new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))));
      return Promise.resolve(new Response(new Uint8Array([9]), { status: 200, headers: { 'content-type': 'image/png' } }));
    }));
    const c = new AbortController();
    const first = loadWmsTile(u, c.signal);
    c.abort();
    const second = loadWmsTile(u); // same tick, e.g. the preloader restarting on moveend
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(new Uint8Array(await second)).toEqual(new Uint8Array([9]));
    expect(calls).toBe(2);
  });
});

describe('EMPTY_PNG', () => {
  it('is a valid 1×1 RGBA PNG whose only pixel is fully transparent', () => {
    const b = Buffer.from(EMPTY_PNG);
    expect(b.subarray(1, 4).toString()).toBe('PNG');
    expect([b.readUInt32BE(16), b.readUInt32BE(20), b[24], b[25]]).toEqual([1, 1, 8, 6]); // 1×1, 8-bit, RGBA
    const idatLen = b.readUInt32BE(33);
    expect(b.subarray(37, 41).toString()).toBe('IDAT');
    const raw = inflateSync(b.subarray(41, 41 + idatLen));
    expect(Array.from(raw)).toEqual([0, 0, 0, 0, 0]); // filter byte + R,G,B,A = 0
  });
});
