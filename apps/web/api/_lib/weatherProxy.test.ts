import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../proxy/weather.js';

const base = 'http://x/api/proxy/weather?latitude=48.0,47.9&longitude=7.8,7.9';
const daily = 'daily=temperature_2m_max,precipitation_sum';
const get = (qs: string) => handler.fetch(new Request(`${base}&${qs}`));

afterEach(() => vi.unstubAllGlobals());

describe('weather proxy validation', () => {
  it.each([
    [`${daily}&start_date=2026-10-21&end_date=2026-10-28&cache=1`, 'unknown parameter'],
    ['daily=temperature_2m_max,evil_var&start_date=2026-10-21&end_date=2026-10-22', 'invalid daily'],
    ['hourly=temperature_2m,sunshine_duration,wind_speed_10m,precipitation,uv&start_date=2026-10-21&end_date=2026-10-22', 'invalid hourly'],
    [`${daily}&start_date=2026-10-01&end_date=2026-10-30`, 'span'],
    [`${daily}&start_date=2026-10-21&end_date=2026-10-20`, 'span'],
    [`${daily}&start_date=21.10.2026&end_date=22.10.2026`, 'YYYY-MM-DD'],
    [`${daily}&start_date=2026-10-21`, 'together'],
    [`${daily}&forecast_days=17`, 'forecast_days'],
    ['start_date=2026-10-21&end_date=2026-10-22', 'daily or hourly'],
    [`${daily}&forecast_days=3&latitude=1,2,3`, 'duplicate parameter'],
    [`${daily}&forecast_days=3&daily=uv_index_max`, 'duplicate parameter'],
  ])('rejects %s', async (qs, msg) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(msg);
  });

  it('rejects more than 50 coordinates and mismatched lists', async () => {
    const many = Array.from({ length: 51 }, () => '48').join(',');
    const res = await handler.fetch(
      new Request(`http://x/p?latitude=${many}&longitude=${many}&${daily}&forecast_days=3`),
    );
    expect(res.status).toBe(400);
    expect((await get(`${daily}&forecast_days=3`).then(() => handler.fetch(
      new Request(`http://x/p?latitude=48,47&longitude=7&${daily}&forecast_days=3`),
    ))).status).toBe(400);
  });

  it('forwards a valid request upstream and caches the success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await get(`${daily}&start_date=2026-10-21&end_date=2026-10-28&timezone=auto`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes a long Retry-After on to the client without caching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '7' } })));
    const res = await get(`${daily}&forecast_days=3`);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
