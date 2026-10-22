import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildRouteSchedule, captionAt, positionAt, routePlayFrames, stayFocusMs, type ScheduleStopInput,
} from './routeSchedule.ts';

const H = 3_600_000;
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

beforeAll(() => { process.env.TZ = 'Europe/Berlin'; });

// Freiburg → Colmar (west) → Basel (south-east): 2 / 1 / 2 nights, starting Sat 24 Oct 2026 (DST ends 25 Oct 03:00)
function stops(startDay = 24): ScheduleStopInput[] {
  const day = (n: number) => new Date(new Date(2026, 9, startDay).getTime() + n * 24 * H); // same drift as the optimizer (+24 h)
  return [
    { lat: 48.0, lng: 7.85, arrivalDate: day(0), nights: 2, distanceToNextKm: 70 },
    { lat: 48.08, lng: 7.36, arrivalDate: day(2), nights: 1, distanceToNextKm: 140 },
    { lat: 47.56, lng: 7.59, arrivalDate: day(3), nights: 2 },
  ];
}

describe('buildRouteSchedule', () => {
  it('returns null for an empty route', () => {
    expect(buildRouteSchedule([])).toBeNull();
  });

  it('starts at 12:00 on the first day and departs at 10:00 after the last night', () => {
    const s = buildRouteSchedule(stops())!;
    expect(s.startMs).toBe(local(2026, 10, 24, 12));
    expect(s.stops[0].departureMs).toBe(local(2026, 10, 26, 10));
    expect(s.endMs).toBe(local(2026, 10, 29, 10));
  });

  it('keeps clock times across the DST change although arrival dates drift by an hour', () => {
    const s = buildRouteSchedule(stops())!;
    // stop 0 stay spans the DST switch: 24 Oct 12:00 CEST → 26 Oct 10:00 CET = 46 h + 1 h = 47 h
    expect((s.stops[0].departureMs - s.stops[0].arrivalMs) / H).toBe(47);
    // the second leg starts on 26 Oct 10:00 sharp
    const drive0 = s.segments.find((x) => x.kind === 'drive')!;
    expect(drive0.start).toBe(local(2026, 10, 26, 10));
    // 70 km at 70 km/h = 1 h
    expect(drive0.end - drive0.start).toBe(H);
    expect(s.stops[1].arrivalMs).toBe(local(2026, 10, 26, 11));
  });

  it('uses given driving durations instead of the speed assumption', () => {
    const s = buildRouteSchedule(stops().map((x, i) => (i === 0 ? { ...x, durationToNextSec: 5400 } : x)))!;
    expect(s.stops[1].arrivalMs - s.stops[0].departureMs).toBe(1.5 * H);
  });

  it('falls back to straight-line distance when the distance is missing', () => {
    const s = buildRouteSchedule([
      { lat: 48, lng: 8, arrivalDate: new Date(2026, 5, 1), nights: 1 },
      { lat: 49, lng: 8, arrivalDate: new Date(2026, 5, 2), nights: 1 },
    ])!;
    const d = s.segments.find((x) => x.kind === 'drive')!;
    expect(d.kind === 'drive' && d.km).toBeGreaterThan(111);
    expect(d.kind === 'drive' && d.km).toBeLessThan(150);
  });

  it('segments are contiguous and ordered', () => {
    const s = buildRouteSchedule(stops())!;
    for (let i = 1; i < s.segments.length; i++) expect(s.segments[i].start).toBe(s.segments[i - 1].end);
    expect(s.segments.map((x) => x.kind)).toEqual(['stay', 'drive', 'stay', 'drive', 'stay']);
  });
});

describe('positionAt', () => {
  const s = buildRouteSchedule(stops())!;

  it('stands at the first stop before the start and at the last after the end', () => {
    expect(positionAt(s, s.startMs - 5 * H)).toMatchObject({ stopIndex: 0, lat: 48.0, lng: 7.85 });
    expect(positionAt(s, s.endMs + 5 * H)).toMatchObject({ stopIndex: 2, lat: 47.56, lng: 7.59 });
  });

  it('stands still overnight at a stop', () => {
    const a = positionAt(s, local(2026, 10, 25, 2));
    const b = positionAt(s, local(2026, 10, 25, 22));
    expect(a).toMatchObject({ stopIndex: 0, legIndex: null, lat: 48.0, lng: 7.85 });
    expect(b).toMatchObject({ stopIndex: 0, lat: 48.0, lng: 7.85 });
  });

  it('interpolates along the leg and faces its direction', () => {
    const d = s.segments[1];
    if (d.kind !== 'drive') throw new Error('segment');
    const mid = positionAt(s, (d.start + d.end) / 2);
    expect(mid.stopIndex).toBeNull();
    expect(mid.legIndex).toBe(0);
    expect(mid.focusStopIndex).toBe(1);
    expect(mid.progress).toBeCloseTo(0.5, 5);
    expect(mid.lng).toBeCloseTo((7.85 + 7.36) / 2, 5);
    expect(mid.lat).toBeGreaterThan(48.0);
    expect(mid.lat).toBeLessThan(48.08);
    expect(mid.heading).toBe(-1); // Freiburg → Colmar goes west
    expect(positionAt(s, s.stops[1].departureMs + 3 * H).heading).toBe(1); // Colmar → Basel goes east
  });

  it('is continuous at segment borders', () => {
    for (const seg of s.segments) {
      const a = positionAt(s, seg.end - 1);
      const b = positionAt(s, seg.end + 1);
      expect(Math.abs(a.lat - b.lat)).toBeLessThan(0.01);
      expect(Math.abs(a.lng - b.lng)).toBeLessThan(0.01);
    }
  });
});

describe('stayFocusMs / routePlayFrames / captionAt', () => {
  const s = buildRouteSchedule(stops())!;

  it('focus instant lies inside the stay of its stop', () => {
    s.stops.forEach((st, i) => {
      const t = stayFocusMs(s, i);
      expect(t).toBeGreaterThanOrEqual(st.arrivalMs);
      expect(t).toBeLessThanOrEqual(st.departureMs);
    });
  });

  it('play frames cover the trip with one frame on each side', () => {
    const frames: number[] = [];
    for (let t = local(2026, 10, 23); t < local(2026, 11, 3); t += 3 * H) frames.push(t);
    const r = routePlayFrames(frames, s);
    expect(r[0]).toBeLessThanOrEqual(s.startMs);
    expect(r[r.length - 1]).toBeGreaterThanOrEqual(s.endMs);
    expect(r.length).toBeGreaterThan(20);
    expect(positionAt(s, r[r.length - 1]).stopIndex).toBe(2);
  });

  it('captions the night at a stop and the destination while driving', () => {
    expect(captionAt(s, local(2026, 10, 24, 23))).toMatchObject({ stopIndex: 0, kind: 'night', night: 1 });
    expect(captionAt(s, local(2026, 10, 25, 3))).toMatchObject({ stopIndex: 0, kind: 'night', night: 1 });
    expect(captionAt(s, local(2026, 10, 25, 23))).toMatchObject({ stopIndex: 0, kind: 'night', night: 2 });
    expect(captionAt(s, local(2026, 10, 25, 14))).toMatchObject({ stopIndex: 0, kind: 'at' });
    expect(captionAt(s, local(2026, 10, 26, 10, 30))).toMatchObject({ stopIndex: 1, kind: 'to' });
  });
});
