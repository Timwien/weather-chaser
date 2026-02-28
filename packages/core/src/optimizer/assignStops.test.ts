import { describe, it, expect } from 'vitest';
import { assignStops } from './assignStops.js';
import type { OptimizerInput, Town, WeatherScore } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTown(id: number): Town {
  return { id: String(id), name: `Town${id}`, lat: 0, lng: 0 };
}

function makeScore(composite = 75): WeatherScore {
  return {
    composite,
    breakdown: { sunshine: 80, precipitation: 70, temperature: 75, wind: 70 },
  };
}

function makeInput(
  townCount: number,
  totalDays: number,
  maxStay: number,
  distancesKm?: number[][],
): OptimizerInput {
  const towns = Array.from({ length: townCount }, (_, i) => makeTown(i));
  const weatherScores = towns.map((_, i) => makeScore(60 + i * 5));

  // Default distance matrix: 10 km between every pair
  const distanceMatrix: number[][] =
    distancesKm ??
    Array.from({ length: townCount }, (_, i) =>
      Array.from({ length: townCount }, (_, j) => (i === j ? 0 : 10)),
    );

  const durationMatrix: number[][] = Array.from({ length: townCount }, (_, i) =>
    Array.from({ length: townCount }, (_, j) => (i === j ? 0 : 3600)),
  );

  return {
    towns,
    distanceMatrix,
    durationMatrix,
    weatherScores,
    config: {
      startIndex: 0,
      totalDays,
      maxStay,
      mustVisitIndices: [],
      startDate: new Date('2026-07-01T00:00:00Z'),
      weights: { sunshine: 0.4, precipitation: 0.3, temperature: 0.2, wind: 0.1 },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assignStops', () => {
  it('3 towns, totalDays=6, maxStay=2 → 3 stops of 2 nights each', () => {
    const input = makeInput(3, 6, 2);
    const tour = [0, 1, 2];

    const route = assignStops(tour, input);

    expect(route.stops).toHaveLength(3);
    expect(route.stops[0].nights).toBe(2);
    expect(route.stops[1].nights).toBe(2);
    expect(route.stops[2].nights).toBe(2);
    expect(route.totalDays).toBe(6);
  });

  it('arrival dates advance correctly — each stop starts after prior nights', () => {
    const input = makeInput(3, 6, 2);
    const tour = [0, 1, 2];
    const route = assignStops(tour, input);

    const startDate = input.config.startDate;

    // Stop 0: arrives on startDate
    expect(route.stops[0].arrivalDate.toISOString().slice(0, 10)).toBe('2026-07-01');

    // Stop 1: arrives after 2 nights (2026-07-03)
    expect(route.stops[1].arrivalDate.toISOString().slice(0, 10)).toBe('2026-07-03');

    // Stop 2: arrives after 2+2=4 nights (2026-07-05)
    expect(route.stops[2].arrivalDate.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  it('3 towns, totalDays=5, maxStay=2 → stops of 2, 2, 1 nights', () => {
    const input = makeInput(3, 5, 2);
    const tour = [0, 1, 2];

    const route = assignStops(tour, input);

    expect(route.stops).toHaveLength(3);
    expect(route.stops[0].nights).toBe(2);
    expect(route.stops[1].nights).toBe(2);
    expect(route.stops[2].nights).toBe(1);
    expect(route.totalDays).toBe(5);
  });

  it('2 towns, totalDays=3, maxStay=3 → stops of 2 nights and 1 night (minimum 1 per stop)', () => {
    const input = makeInput(2, 3, 3);
    const tour = [0, 1];

    const route = assignStops(tour, input);

    expect(route.stops).toHaveLength(2);
    // First stop gets up to maxStay but leaves at least 1 night for stop 2
    // With 3 days and 2 stops: stop 0 gets 2, stop 1 gets 1
    expect(route.stops[0].nights).toBe(2);
    expect(route.stops[1].nights).toBe(1);
    expect(route.totalDays).toBe(3);
  });

  it('1 town, totalDays=4, maxStay=3 → single stop, 4 nights (all days on last stop)', () => {
    const input = makeInput(1, 4, 3);
    const tour = [0];

    const route = assignStops(tour, input);

    expect(route.stops).toHaveLength(1);
    expect(route.stops[0].nights).toBe(4);
    expect(route.totalDays).toBe(4);
  });

  it('distanceToNextKm uses distanceMatrix directly (km), undefined for last stop', () => {
    const distances = [
      [0, 42],
      [42, 0],
    ];
    const input = makeInput(2, 2, 2, distances);
    const tour = [0, 1];

    const route = assignStops(tour, input);

    expect(route.stops[0].distanceToNextKm).toBe(42);
    expect(route.stops[1].distanceToNextKm).toBeUndefined();
  });

  it('totalDistanceKm is the sum of all distanceToNextKm values', () => {
    const distances = [
      [0, 10, 20],
      [10, 0, 15],
      [20, 15, 0],
    ];
    const input = makeInput(3, 3, 1, distances);
    const tour = [0, 1, 2];

    const route = assignStops(tour, input);

    // tour: 0->1 (10km) + 1->2 (15km) = 25km
    expect(route.totalDistanceKm).toBe(25);
  });

  it('avgScore is the mean of all stop composite scores', () => {
    const input = makeInput(3, 6, 2);
    const tour = [0, 1, 2];

    // weatherScores composites: 60, 65, 70 → avg = 65
    const route = assignStops(tour, input);

    const expectedAvg = (60 + 65 + 70) / 3;
    expect(route.avgScore).toBeCloseTo(expectedAvg, 5);
  });

  it('each stop has the correct town reference from the input towns array', () => {
    const input = makeInput(3, 6, 2);
    const tour = [2, 0, 1];

    const route = assignStops(tour, input);

    expect(route.stops[0].town.id).toBe('2');
    expect(route.stops[1].town.id).toBe('0');
    expect(route.stops[2].town.id).toBe('1');
  });

  it('score at each stop comes from pre-filled weatherScores (no re-scoring)', () => {
    const input = makeInput(3, 6, 2);
    const tour = [1, 0, 2];

    const route = assignStops(tour, input);

    // weatherScores[1].composite = 65, weatherScores[0].composite = 60, weatherScores[2].composite = 70
    expect(route.stops[0].score.composite).toBe(65);
    expect(route.stops[1].score.composite).toBe(60);
    expect(route.stops[2].score.composite).toBe(70);
  });
});
