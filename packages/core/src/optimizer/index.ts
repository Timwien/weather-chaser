import type { OptimizerInput, Route } from '../types/index.js';
import { nearestNeighborTour } from './nearestNeighbor.js';
import { twoOptImprove } from './twoOpt.js';
import { orOptImprove } from './orOpt.js';
import { assignStops } from './assignStops.js';

export { nearestNeighborTour } from './nearestNeighbor.js';
export { twoOptImprove } from './twoOpt.js';
export { orOptImprove } from './orOpt.js';
export { assignStops } from './assignStops.js';

/**
 * optimizeRoute
 *
 * Single public entry point for the route optimization algorithm.
 *
 * Pipeline:
 *  1. nearestNeighborTour  — greedy initial tour through all candidate towns
 *  2. twoOptImprove        — global 2-opt on the full candidate pool
 *  3. must-visit anchoring — ensures must-visits appear before the truncation point
 *  4. post-truncation 2-opt + or-opt — re-optimizes only the final N active stops.
 *     Eliminates zig-zags introduced by must-visit swaps and truncation.
 *     (Fast: N is typically 5–14, so O(N²) is <1 ms)
 *  5. assignStops          — assigns nights, dates, scores, distances → Route
 */
export function optimizeRoute(input: OptimizerInput): Route {
  const { towns, distanceMatrix, config } = input;
  const { startIndex, mustVisitIndices, totalDays, maxStay } = config;
  const n = towns.length;

  if (n === 0) {
    return { stops: [], totalDistanceKm: 0, totalDays: 0, avgScore: 0 };
  }

  // Step 1: Nearest-neighbor tour through all candidate towns
  let tour = nearestNeighborTour(startIndex, distanceMatrix, mustVisitIndices);

  // Step 2: 2-opt on the full candidate pool (removes edge crossings globally)
  tour = twoOptImprove(tour, distanceMatrix);

  // Step 3: Anchor must-visits within the active window before truncation
  const truncationPoint = computeTruncationPoint(tour, totalDays, maxStay);
  tour = anchorMustVisits(tour, mustVisitIndices, truncationPoint);

  // Step 4: Re-optimize only the stops that will actually be in the route.
  // anchorMustVisits uses raw swaps that can break the 2-opt ordering.
  // Running 2-opt + or-opt on the small final slice fixes zig-zags cheaply.
  const activeSlice = tour.slice(0, truncationPoint);
  const optimizedSlice = orOptImprove(twoOptImprove(activeSlice, distanceMatrix), distanceMatrix);
  // Reconstruct: optimized active stops + unvisited tail (assignStops ignores the tail)
  tour = [...optimizedSlice, ...tour.slice(truncationPoint)];

  // Step 5: Assign stops (dates, nights, scores, distances)
  return assignStops(tour, input);
}

/**
 * Computes the number of stops that will be visited given totalDays and maxStay.
 * Stops are visited greedily (up to maxStay per stop, minimum 1).
 */
function computeTruncationPoint(
  tour: number[],
  totalDays: number,
  maxStay: number,
): number {
  let daysRemaining = totalDays;
  let stopCount = 0;

  for (let i = 0; i < tour.length; i++) {
    if (daysRemaining <= 0) break;
    const stopsAfter = tour.length - 1 - i;
    const nights = i === tour.length - 1
      ? daysRemaining
      : Math.min(maxStay, Math.max(1, daysRemaining - stopsAfter));
    daysRemaining -= nights;
    stopCount++;
  }

  return stopCount;
}

/**
 * Ensures all must-visit towns appear within the first `truncationPoint` positions.
 * If a must-visit is at position >= truncationPoint, swaps it with the town at
 * (truncationPoint - 1) to bring it into the active range.
 */
function anchorMustVisits(
  tour: number[],
  mustVisitIndices: number[],
  truncationPoint: number,
): number[] {
  const result = [...tour];
  let boundary = truncationPoint - 1;

  for (const mv of mustVisitIndices) {
    const pos = result.indexOf(mv);
    if (pos >= truncationPoint && boundary >= 0) {
      // Swap must-visit with the boundary stop
      [result[pos], result[boundary]] = [result[boundary], result[pos]];
      boundary--;
    }
  }

  return result;
}
