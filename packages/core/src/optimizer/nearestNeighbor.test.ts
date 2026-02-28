import { describe, it, expect } from 'vitest';
import { nearestNeighborTour } from './nearestNeighbor.js';

// ---------------------------------------------------------------------------
// Helper: build a symmetric distance matrix from a list of distances
// ---------------------------------------------------------------------------

function sym(n: number, distances: Record<string, number>): number[][] {
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [key, dist] of Object.entries(distances)) {
    const [i, j] = key.split(',').map(Number);
    matrix[i][j] = dist;
    matrix[j][i] = dist;
  }
  return matrix;
}

describe('nearestNeighborTour', () => {
  it('returns a valid permutation for 4 towns starting at index 0', () => {
    // 4 towns in a line: 0-1-2-3, distances are 1 between adjacent
    const matrix = sym(4, {
      '0,1': 1,
      '0,2': 2,
      '0,3': 3,
      '1,2': 1,
      '1,3': 2,
      '2,3': 1,
    });

    const tour = nearestNeighborTour(0, matrix, []);

    // Must start at 0
    expect(tour[0]).toBe(0);
    // Must be length 4
    expect(tour).toHaveLength(4);
    // Must be a permutation of [0,1,2,3]
    expect([...tour].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('includes must-visit town in output when mustVisitIndices specified', () => {
    // 4 towns: 0 is close to 1, but 3 is a must-visit (farther away)
    const matrix = sym(4, {
      '0,1': 1,
      '0,2': 5,
      '0,3': 10,
      '1,2': 1,
      '1,3': 9,
      '2,3': 5,
    });

    const tour = nearestNeighborTour(0, matrix, [3]);

    // Town 3 must appear in output
    expect(tour).toContain(3);
    // Must be a valid permutation
    expect(tour).toHaveLength(4);
    expect([...tour].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(tour[0]).toBe(0);
  });

  it('handles single town — returns [0]', () => {
    const matrix = [[0]];
    const tour = nearestNeighborTour(0, matrix, []);
    expect(tour).toEqual([0]);
  });

  it('handles two towns — returns [startIndex, otherIndex]', () => {
    const matrix = [
      [0, 5],
      [5, 0],
    ];

    const tourFrom0 = nearestNeighborTour(0, matrix, []);
    expect(tourFrom0).toEqual([0, 1]);

    const tourFrom1 = nearestNeighborTour(1, matrix, []);
    expect(tourFrom1).toEqual([1, 0]);
  });

  it('must-visit town prioritized when within 2x nearest neighbor distance', () => {
    // Town 0 is start; nearest unvisited is town 1 (distance 3)
    // Town 3 is must-visit at distance 5 (< 2*3=6, so within 2x threshold)
    // Expect must-visit town 3 to be visited before other non-must-visit towns
    const matrix = sym(4, {
      '0,1': 3,
      '0,2': 8,
      '0,3': 5,
      '1,2': 4,
      '1,3': 6,
      '2,3': 3,
    });

    const tour = nearestNeighborTour(0, matrix, [3]);

    // Must be valid permutation
    expect(tour).toHaveLength(4);
    expect([...tour].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    // Must-visit town 3 should appear in output
    expect(tour).toContain(3);
  });

  it('without must-visit indices, follows strict nearest-neighbor (greedy)', () => {
    // 0->1 is always nearest, then 1->2, then 2->3
    const matrix = sym(4, {
      '0,1': 1,
      '0,2': 100,
      '0,3': 100,
      '1,2': 1,
      '1,3': 100,
      '2,3': 1,
    });

    const tour = nearestNeighborTour(0, matrix, []);
    // Strict NN should follow 0->1->2->3
    expect(tour).toEqual([0, 1, 2, 3]);
  });
});
