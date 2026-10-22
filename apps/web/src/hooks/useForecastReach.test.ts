import { describe, expect, it } from 'vitest';
import { forecastReach } from './useForecastReach.ts';
import { buildRouteSchedule } from '../utils/routeSchedule.ts';

const H = 3_600_000;
const sch = buildRouteSchedule([{ lat: 48, lng: 7.8, arrivalDate: new Date(2026, 9, 24), nights: 2 }])!;

describe('forecastReach', () => {
  it('flags a trip that starts after the last frame and reports the horizon', () => {
    const frames = [sch.startMs - 100 * H, sch.startMs - 97 * H];
    expect(forecastReach(frames, sch)).toEqual({ startsBeyond: true, until: sch.startMs - 97 * H });
  });
  it('does not block when the forecast reaches the start, the frames are unknown, or there is no route', () => {
    expect(forecastReach([sch.startMs + H], sch).startsBeyond).toBe(false);
    expect(forecastReach([], sch)).toEqual({ startsBeyond: false, until: null });
    expect(forecastReach([1, 2], null).startsBeyond).toBe(false);
  });
});
