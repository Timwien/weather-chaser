import { describe, it, expect } from 'vitest';
import { allocateNights } from './nightsDP.js';

describe('allocateNights', () => {
  it('returns -Infinity utility when infeasible (more stops than days)', () => {
    const dayScores = [[50, 50], [50, 50], [50, 50]];
    const result = allocateNights([0, 1, 2], dayScores, 2, 3);
    expect(result.utility).toBe(-Infinity);
    expect(result.nights).toEqual([]);
  });

  it('returns -Infinity utility when maxStay cannot cover all days', () => {
    // 2 stops × maxStay 2 = 4 < 5 days
    const dayScores = [Array(5).fill(50), Array(5).fill(50)];
    const result = allocateNights([0, 1], dayScores, 5, 2);
    expect(result.utility).toBe(-Infinity);
  });

  it('gives all days to a single stop', () => {
    const dayScores = [[10, 20, 30]];
    const result = allocateNights([0], dayScores, 3, 3);
    expect(result.nights).toEqual([3]);
    expect(result.utility).toBe(60);
  });

  it('nights sum to totalDays and respect maxStay', () => {
    const dayScores = [
      [80, 80, 80, 80, 80, 80],
      [60, 60, 60, 60, 60, 60],
      [40, 40, 40, 40, 40, 40],
    ];
    const { nights } = allocateNights([0, 1, 2], dayScores, 6, 3);
    expect(nights.reduce((a, b) => a + b, 0)).toBe(6);
    for (const n of nights) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('allocates more nights to the stop with better weather (uniform days)', () => {
    const dayScores = [
      [90, 90, 90, 90, 90],
      [20, 20, 20, 20, 20],
    ];
    const { nights, utility } = allocateNights([0, 1], dayScores, 5, 4);
    expect(nights).toEqual([4, 1]); // max out the good stop
    expect(utility).toBe(90 * 4 + 20);
  });

  it('shifts arrival to catch a late weather peak (temporal awareness)', () => {
    // Stop B's weather peaks on days 3–4; stop A is mediocre throughout.
    // Best plan: stay at A for 3 nights (days 0–2), arrive at B for days 3–4.
    const A = [50, 50, 50, 50, 50];
    const B = [10, 10, 10, 95, 95];
    const { nights, utility } = allocateNights([0, 1], [A, B], 5, 3);
    expect(nights).toEqual([3, 2]);
    expect(utility).toBe(50 * 3 + 95 * 2);
  });

  it('is deterministic', () => {
    const dayScores = [
      [55, 60, 65, 70],
      [70, 65, 60, 55],
      [50, 50, 50, 50],
    ];
    const a = allocateNights([0, 1, 2], dayScores, 4, 2);
    const b = allocateNights([0, 1, 2], dayScores, 4, 2);
    expect(a).toEqual(b);
  });
});
