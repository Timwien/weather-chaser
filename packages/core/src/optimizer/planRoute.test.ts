import { describe, it, expect } from 'vitest';
import { planRoute } from './planRoute.js';
import type { OptimizerInput, Town, WeatherScore } from '../types/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTowns(coords: Array<[number, number]>): Town[] {
  return coords.map(([lat, lng], i) => ({ id: `t${i}`, name: `Town${i}`, lat, lng }));
}

/** Symmetric km matrix from planar coordinates (1 unit = 100 km for clarity). */
function kmMatrix(coords: Array<[number, number]>, unitKm = 100): number[][] {
  return coords.map(([ax, ay]) =>
    coords.map(([bx, by]) => Math.hypot(ax - bx, ay - by) * unitKm),
  );
}

function staticScores(values: number[]): WeatherScore[] {
  return values.map((v) => ({
    composite: v,
    breakdown: { sunshine: v, precipitation: v, temperature: v, wind: v },
  }));
}

function makeInput(overrides: Partial<OptimizerInput> & {
  coords: Array<[number, number]>;
  scores: number[];
  totalDays: number;
  maxStay?: number;
  mustVisitIndices?: number[];
  dayScores?: number[][];
}): OptimizerInput {
  const { coords, scores, totalDays, maxStay = 3, mustVisitIndices = [], dayScores } = overrides;
  const distanceMatrix = kmMatrix(coords);
  return {
    towns: makeTowns(coords),
    distanceMatrix,
    durationMatrix: distanceMatrix.map((row) => row.map((km) => (km / 70) * 3600)),
    weatherScores: staticScores(scores),
    dayScores,
    config: {
      startIndex: 0,
      totalDays,
      maxStay,
      mustVisitIndices,
      startDate: new Date('2026-06-11T00:00:00Z'),
      weights: { sunshine: 0.25, precipitation: 0.25, temperature: 0.25, wind: 0.25 },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('planRoute', () => {
  it('returns an empty route for zero towns', () => {
    const route = planRoute(makeInput({ coords: [], scores: [], totalDays: 4 }));
    expect(route.stops).toEqual([]);
    expect(route.totalDistanceKm).toBe(0);
  });

  it('single town gets all days', () => {
    const route = planRoute(makeInput({ coords: [[0, 0]], scores: [70], totalDays: 5, maxStay: 5 }));
    expect(route.stops).toHaveLength(1);
    expect(route.stops[0].nights).toBe(5);
    expect(route.totalDays).toBe(5);
  });

  it('starts at the configured start town', () => {
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.5, 0], [1, 0], [1.5, 0]],
        scores: [50, 60, 70, 80],
        totalDays: 4,
      }),
    );
    expect(route.stops[0].town.id).toBe('t0');
  });

  it('nights sum to totalDays and stops are unique', () => {
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.4, 0.2], [0.8, 0.1], [1.2, 0.3], [1.6, 0]],
        scores: [60, 70, 55, 80, 65],
        totalDays: 7,
        maxStay: 3,
      }),
    );
    const totalNights = route.stops.reduce((s, st) => s + st.nights, 0);
    expect(totalNights).toBe(7);
    const ids = route.stops.map((s) => s.town.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of route.stops) {
      expect(s.nights).toBeGreaterThanOrEqual(1);
      expect(s.nights).toBeLessThanOrEqual(3);
    }
  });

  it('skips a nearby bad-weather town in favor of a slightly farther good one', () => {
    // t1 is very close to start but has terrible weather (15);
    // t2 is a bit farther with great weather (85). Three days, two stops max useful.
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.3, 0], [0.9, 0]],
        scores: [60, 15, 85],
        totalDays: 4,
        maxStay: 3,
      }),
    );
    const ids = route.stops.map((s) => s.town.id);
    expect(ids).toContain('t2');
    expect(ids).not.toContain('t1');
  });

  it('does not chase a distant town when the drive outweighs the weather gain', () => {
    // t3 is marginally better (62 vs 60) but 800 km away — never worth ~11 h driving.
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.3, 0.1], [0.5, 0.2], [8, 0]],
        scores: [60, 58, 59, 62],
        totalDays: 4,
        maxStay: 2,
      }),
    );
    const ids = route.stops.map((s) => s.town.id);
    expect(ids).not.toContain('t3');
  });

  it('includes must-visit towns even with poor weather', () => {
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.5, 0.1], [1, 0], [1.5, 0.1]],
        scores: [70, 20, 75, 72],
        totalDays: 4,
        mustVisitIndices: [1],
      }),
    );
    expect(route.stops.map((s) => s.town.id)).toContain('t1');
  });

  it('uses dayScores to time arrival at a town whose weather peaks late', () => {
    // t1's weather peaks on days 2–3; t0 is decent early. The planner should
    // hold at t0 and arrive at t1 on day 2 (arrivalDate offset 2).
    const dayScores = [
      [70, 70, 40, 40], // t0: good early
      [20, 20, 90, 90], // t1: peaks late
    ];
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.5, 0]],
        scores: [55, 55],
        totalDays: 4,
        maxStay: 3,
        dayScores,
      }),
    );
    expect(route.stops).toHaveLength(2);
    expect(route.stops[0].town.id).toBe('t0');
    expect(route.stops[0].nights).toBe(2);
    expect(route.stops[1].town.id).toBe('t1');
    expect(route.stops[1].nights).toBe(2);
    // Arrival at t1 = startDate + 2 days
    expect(route.stops[1].arrivalDate.getUTCDate()).toBe(13);
  });

  it('avoids monster single legs when a comparable nearer option exists', () => {
    // Chain of towns; t4 equals t2 in weather but is much farther.
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.4, 0], [0.8, 0], [1.2, 0], [5, 0]],
        scores: [65, 70, 75, 70, 75],
        totalDays: 4,
        maxStay: 2,
      }),
    );
    // No leg should exceed ~450 km when good nearby options exist
    for (const s of route.stops) {
      if (s.distanceToNextKm !== undefined) {
        expect(s.distanceToNextKm).toBeLessThan(450);
      }
    }
  });

  it('is deterministic — same input twice gives identical routes', () => {
    const input = () =>
      makeInput({
        coords: [[0, 0], [0.3, 0.4], [0.7, 0.1], [1.1, 0.5], [1.4, 0.2], [0.9, 0.8]],
        scores: [60, 72, 68, 80, 55, 75],
        totalDays: 6,
        maxStay: 2,
      });
    const a = planRoute(input());
    const b = planRoute(input());
    expect(a.stops.map((s) => [s.town.id, s.nights])).toEqual(
      b.stops.map((s) => [s.town.id, s.nights]),
    );
    expect(a.totalDistanceKm).toBe(b.totalDistanceKm);
  });

  it('avgScore is the day-weighted mean of stop composites', () => {
    const dayScores = [
      [80, 80, 80, 80],
      [40, 40, 40, 40],
    ];
    const route = planRoute(
      makeInput({
        coords: [[0, 0], [0.4, 0]],
        scores: [80, 40],
        totalDays: 4,
        maxStay: 3,
        dayScores,
      }),
    );
    const totalNights = route.stops.reduce((s, st) => s + st.nights, 0);
    const expected =
      route.stops.reduce((s, st) => s + st.score.composite * st.nights, 0) / totalNights;
    expect(route.avgScore).toBeCloseTo(expected, 10);
  });

  it('falls back gracefully when durationMatrix is all zeros (Haversine-less)', () => {
    const coords: Array<[number, number]> = [[0, 0], [0.5, 0], [1, 0]];
    const input = makeInput({ coords, scores: [60, 70, 80], totalDays: 3 });
    input.durationMatrix = coords.map(() => coords.map(() => 0));
    const route = planRoute(input);
    expect(route.stops.length).toBeGreaterThan(0);
    expect(route.totalDays).toBe(3);
  });

  it('handles a large candidate pool quickly (120 towns, 14 days)', () => {
    const coords: Array<[number, number]> = [];
    for (let i = 0; i < 120; i++) {
      // Deterministic pseudo-grid scatter
      coords.push([(i % 12) * 0.3, Math.floor(i / 12) * 0.3]);
    }
    const scores = coords.map((_, i) => 30 + ((i * 7919) % 60)); // deterministic 30–89
    const start = Date.now();
    const route = planRoute(makeInput({ coords, scores, totalDays: 14, maxStay: 3 }));
    const elapsed = Date.now() - start;
    expect(route.totalDays).toBe(14);
    expect(route.stops.length).toBeGreaterThanOrEqual(5);
    expect(elapsed).toBeLessThan(2000); // keep it client-side friendly
  });
});
