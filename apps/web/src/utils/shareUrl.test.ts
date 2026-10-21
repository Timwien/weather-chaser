import { describe, it, expect, vi } from 'vitest';
import type { Route } from '@weatherchaser/core';
import { buildShareUrl, parseShareUrl } from './shareUrl.ts';

vi.stubGlobal('window', { location: { origin: 'https://example.test' } });

const route: Route = {
  stops: [
    {
      town: { id: 'a', name: 'Freiburg', lat: 48, lng: 7.85 },
      arrivalDate: new Date('2026-07-03T00:00:00Z'),
      nights: 2,
      score: { composite: 71.2, breakdown: { sunshine: 77, precipitation: 25, temperature: 100, wind: 61 } },
      weatherAvg: { sunshineHoursPerDay: 6.3456, tempMaxC: 14.4, precipitationMmPerDay: 2.66, windKmh: 19.2 },
    },
  ],
  totalDistanceKm: 10,
  totalDays: 2,
  avgScore: 71,
};
const cfg = { startDate: '2026-07-03', endDate: '2026-07-04', totalDays: 2, maxStay: 2, preset: 'beach' };
const search = (url: string) => new URL(url).search;

describe('share URL weather values', () => {
  it('round-trips rounded weather values', () => {
    const parsed = parseShareUrl(search(buildShareUrl(cfg, route)))!;
    expect(parsed.route.stops[0].weatherAvg).toEqual({
      sunshineHoursPerDay: 6.3, tempMaxC: 14, precipitationMmPerDay: 2.7, windKmh: 19,
    });
  });

  it('old links without values still parse (labelled sub-scores are shown instead)', () => {
    const old = {
      v: 1, ...cfg,
      route: {
        stops: [{ name: 'X', lat: 1, lng: 2, arrivalDate: '2026-07-03T00:00:00.000Z', nights: 1, composite: 50,
          breakdown: { sunshine: 77, precipitation: 25, temperature: 100, wind: 61 } }],
        totalDistanceKm: 1, totalDays: 1, avgScore: 50,
      },
    };
    const qs = '?data=' + btoa(encodeURIComponent(JSON.stringify(old)));
    const parsed = parseShareUrl(qs)!;
    expect(parsed.route.stops[0].weatherAvg).toBeUndefined();
    expect(parsed.route.stops[0].score.breakdown.sunshine).toBe(77);
  });

  it('ignores a malformed weather field', () => {
    const bad = JSON.parse(decodeURIComponent(atob(new URL(buildShareUrl(cfg, route)).searchParams.get('data')!)));
    bad.route.stops[0].w = [1, 'x'];
    const parsed = parseShareUrl('?data=' + btoa(encodeURIComponent(JSON.stringify(bad))))!;
    expect(parsed.route.stops[0].weatherAvg).toBeUndefined();
  });
});
