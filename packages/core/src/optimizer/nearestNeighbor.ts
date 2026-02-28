/**
 * nearestNeighborTour
 *
 * Builds a greedy nearest-neighbor tour visiting every town exactly once.
 *
 * Must-visit preference (ALGO-07):
 *   When choosing the next stop, if the strictly nearest unvisited town is NOT a
 *   must-visit AND there is an unvisited must-visit town whose distance is within
 *   2× the nearest-neighbor distance, the must-visit town is preferred instead.
 *   This prevents must-visit towns from being "pushed to the end" of the tour,
 *   which would cause them to be dropped after truncation in optimizeRoute.
 */
export function nearestNeighborTour(
  startIndex: number,
  distanceMatrix: number[][],
  mustVisitIndices: number[],
): number[] {
  const n = distanceMatrix.length;

  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set<number>();
  const tour: number[] = [startIndex];
  visited.add(startIndex);

  const mustVisitSet = new Set<number>(mustVisitIndices);

  while (tour.length < n) {
    const current = tour[tour.length - 1];

    // Find the nearest unvisited town
    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distanceMatrix[current][j] < nearestDist) {
        nearestDist = distanceMatrix[current][j];
        nearestIdx = j;
      }
    }

    // Check if any unvisited must-visit town is within 2x the nearest-neighbor distance
    // and the nearest candidate is not itself a must-visit
    let nextIdx = nearestIdx;

    if (!mustVisitSet.has(nearestIdx)) {
      for (const mv of mustVisitSet) {
        if (!visited.has(mv) && distanceMatrix[current][mv] <= 2 * nearestDist) {
          nextIdx = mv;
          break;
        }
      }
    }

    tour.push(nextIdx);
    visited.add(nextIdx);
  }

  return tour;
}
