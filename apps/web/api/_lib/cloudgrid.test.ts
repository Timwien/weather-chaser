import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../cloudgrid.js';
import { buildPayload, latticePoints, parseCloudGridQuery } from './cloudgrid.js';

const q = (qs: string) => parseCloudGridQuery(new URLSearchParams(qs));
const get = (qs: string) => handler.fetch(new Request(`http://x/api/cloudgrid?${qs}`));

afterEach(() => vi.unstubAllGlobals());

describe('parseCloudGridQuery', () => {
  it('accepts aligned tiles for every step', () => {
    expect(q('step=1&lat0=40&lng0=0')).toEqual({ ok: true, query: { step: 1, lat0: 40, lng0: 0 } });
    expect(q('step=0.5&lat0=48&lng0=4')).toMatchObject({ ok: true });
    expect(q('step=0.25&lat0=48&lng0=6')).toMatchObject({ ok: true });
    expect(q('step=1&lat0=32&lng0=-24')).toMatchObject({ ok: true });
  });

  it.each([
    ['step=2&lat0=40&lng0=0', 'step'],
    ['step=1.0&lat0=40&lng0=0', 'step'],
    ['lat0=40&lng0=0', 'step'],
    ['step=1&lat0=41&lng0=0', 'multiples'],
    ['step=0.25&lat0=47&lng0=6', 'multiples'],
    ['step=1&lat0=abc&lng0=0', 'required'],
    ['step=1&lat0=40', 'required'],
    ['step=1&lat0=72&lng0=0', 'outside'],
    ['step=1&lat0=16&lng0=0', 'outside'],
    ['step=1&lat0=40&lng0=48', 'outside'],
    ['step=1&lat0=40&lng0=-40', 'outside'],
    ['step=1&lat0=40&lng0=0&hourly=temperature_2m', 'unknown parameter'],
    ['step=1&lat0=40&lng0=0&lat0=48', 'duplicate parameter'],
  ])('rejects %s', (qs, msg) => {
    const r = q(qs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
});

describe('latticePoints', () => {
  it('builds 64 corner points, south-west first, row-major', () => {
    const { lat, lng } = latticePoints({ step: 0.5, lat0: 48, lng0: 4 });
    expect(lat).toHaveLength(64);
    expect([lat[0], lng[0]]).toEqual([48, 4]);
    expect([lat[1], lng[1]]).toEqual([48, 4.5]);
    expect([lat[8], lng[8]]).toEqual([48.5, 4]);
    expect([lat[63], lng[63]]).toEqual([51.5, 7.5]);
  });
});

function upstream(hours: number, valueOf: (p: number, h: number) => number | null) {
  return Array.from({ length: 64 }, (_, p) => ({
    hourly: {
      time: Array.from({ length: hours }, (_, h) => `2026-10-22T${String(h).padStart(2, '0')}:00`),
      cloud_cover: Array.from({ length: hours }, (_, h) => valueOf(p, h)),
    },
  }));
}

describe('buildPayload', () => {
  it('packs hour-major bytes with start instant', () => {
    const out = buildPayload({ step: 1, lat0: 40, lng0: 0 }, upstream(3, (p, h) => p + h))!;
    expect(out.start).toBe('2026-10-22T00:00:00.000Z');
    expect(out.hours).toBe(3);
    const bytes = Buffer.from(out.values, 'base64');
    expect(bytes.length).toBe(64 * 3);
    expect(bytes[1 * 64 + 5]).toBe(6); // hour 1, point 5
  });

  it('clamps, rounds and zeroes missing values', () => {
    const bytes = Buffer.from(buildPayload({ step: 1, lat0: 40, lng0: 0 },
      upstream(1, (p) => (p === 0 ? 140 : p === 1 ? null : p === 2 ? 49.6 : 10)))!.values, 'base64');
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([100, 0, 50]);
  });

  it('rejects malformed upstream bodies', () => {
    expect(buildPayload({ step: 1, lat0: 40, lng0: 0 }, { hourly: {} })).toBeNull();
    expect(buildPayload({ step: 1, lat0: 40, lng0: 0 }, upstream(2, () => 1).slice(0, 63))).toBeNull();
  });
});

describe('GET /api/cloudgrid', () => {
  it('returns 400 without caching for misaligned requests and never calls upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await get('step=1&lat0=41&lng0=0');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'lat0=48&lng0=0&step=1',
    'step=1&lat0=048.0000&lng0=000',
    'step=1&lat0=%34%38&lng0=0',
    'step=1&&&lat0=48&lng0=0&',
    'step=1&lat0=48&lng0=-0',
  ])('rejects the cache-busting variant %s without calling upstream', async (qs) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes a single upstream call and caches the success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(upstream(168, () => 42)), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await get('step=1&lat0=40&lng0=0');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=10800, stale-while-revalidate=3600');
    const body = await res.json() as { hours: number; values: string };
    expect(Buffer.from(body.values, 'base64').length).toBe(64 * body.hours);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('hourly')).toBe('cloud_cover');
    expect(url.searchParams.get('latitude')!.split(',')).toHaveLength(64);
  });

  it('does not cache upstream failures or malformed bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"nope":1}', { status: 200 })));
    const bad = await get('step=1&lat0=40&lng0=0');
    expect(bad.status).toBe(502);
    expect(bad.headers.get('Cache-Control')).toBe('no-store');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    const down = await get('step=1&lat0=40&lng0=0');
    expect(down.status).toBe(500);
    expect(down.headers.get('Cache-Control')).toBe('no-store');
  });
});
