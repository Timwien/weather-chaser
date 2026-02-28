/**
 * twoOptImprove
 *
 * Applies the 2-opt local search improvement to a tour.
 * Iteratively reverses sub-segments of the tour when doing so reduces total distance.
 * Terminates when no improving 2-opt swap can be found (local optimum).
 *
 * Invariants:
 *  - Output is a permutation of the input tour indices
 *  - Total tour distance of output ≤ total tour distance of input (never worse)
 *  - If no improvement is possible, returns the input tour unchanged (identity)
 */
export function twoOptImprove(tour: number[], distanceMatrix: number[][]): number[] {
  if (tour.length <= 2) return [...tour];

  // Work on a mutable copy
  let current = [...tour];
  const n = current.length;
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        // Current edges: current[i]->current[i+1] and current[j]->current[j+1 (if exists)]
        // Proposed swap: reverse the segment [i+1..j]
        // New edges: current[i]->current[j] and current[i+1]->current[j+1 (if exists)]
        const a = current[i];
        const b = current[i + 1];
        const c = current[j];
        const d = j + 1 < n ? current[j + 1] : -1;

        const currentDist =
          distanceMatrix[a][b] + (d >= 0 ? distanceMatrix[c][d] : 0);
        const newDist =
          distanceMatrix[a][c] + (d >= 0 ? distanceMatrix[b][d] : 0);

        if (newDist < currentDist - 1e-10) {
          // Reverse the segment from i+1 to j (inclusive)
          current.splice(i + 1, j - i, ...current.slice(i + 1, j + 1).reverse());
          improved = true;
        }
      }
    }
  }

  return current;
}
