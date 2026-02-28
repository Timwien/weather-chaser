import { describe, it, expect } from 'vitest';
import { twoOptImprove } from './twoOpt.js';

// ---------------------------------------------------------------------------
// Helper: compute total tour distance (open path — no return to start)
// ---------------------------------------------------------------------------

function tourDistance(tour: number[], matrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    total += matrix[tour[i]][tour[i + 1]];
  }
  return total;
}

describe('twoOptImprove', () => {
  it('improves a known crossed tour — [0,2,1,3] where un-crossing reduces distance', () => {
    // Matrix where 0<->1 + 2<->3 < 0<->2 + 1<->3
    // i.e. direct order [0,1,2,3] is shorter than crossed [0,2,1,3]
    const matrix = [
      [0, 1, 10, 5],
      [1, 0, 4,  6],
      [10, 4, 0, 2],
      [5,  6, 2, 0],
    ];

    const crossed = [0, 2, 1, 3];
    const improved = twoOptImprove(crossed, matrix);

    const originalDist = tourDistance(crossed, matrix);
    const improvedDist = tourDistance(improved, matrix);

    // Distance must not increase
    expect(improvedDist).toBeLessThanOrEqual(originalDist);
    // All towns must still appear exactly once
    expect([...improved].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(improved).toHaveLength(4);
  });

  it('does not worsen an already optimal tour', () => {
    // Simple 3-town optimal tour [0,1,2] where matrix has short 0->1->2 path
    const matrix = [
      [0, 1, 100],
      [1, 0, 1],
      [100, 1, 0],
    ];

    const optimal = [0, 1, 2];
    const result = twoOptImprove(optimal, matrix);

    const originalDist = tourDistance(optimal, matrix);
    const resultDist = tourDistance(result, matrix);

    expect(resultDist).toBeLessThanOrEqual(originalDist);
    expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('returns input tour unchanged for single element [0]', () => {
    const matrix = [[0]];
    const result = twoOptImprove([0], matrix);
    expect(result).toEqual([0]);
  });

  it('returns input tour unchanged for two-element tour [0,1]', () => {
    const matrix = [
      [0, 5],
      [5, 0],
    ];
    const result = twoOptImprove([0, 1], matrix);
    expect(result).toEqual([0, 1]);
  });

  it('output is a valid permutation of the input tour', () => {
    const matrix = [
      [0, 2, 9, 10],
      [2, 0, 6, 4],
      [9, 6, 0, 3],
      [10, 4, 3, 0],
    ];

    const tour = [0, 3, 2, 1];
    const result = twoOptImprove(tour, matrix);

    // Same indices, possibly reordered
    expect(result).toHaveLength(4);
    expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);

    // Distance must not be worse
    const originalDist = tourDistance(tour, matrix);
    const resultDist = tourDistance(result, matrix);
    expect(resultDist).toBeLessThanOrEqual(originalDist);
  });
});
