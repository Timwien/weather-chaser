import type { OptimizerInput, Route } from '../types/index.js';
import { nearestNeighborTour } from './nearestNeighbor.js';
import { twoOptImprove } from './twoOpt.js';
import { assignStops } from './assignStops.js';

export { nearestNeighborTour } from './nearestNeighbor.js';
export { twoOptImprove } from './twoOpt.js';
export { assignStops } from './assignStops.js';

/**
 * optimizeRoute
 *
 * Single public entry point for the route optimization algorithm.
 *
 * Pipeline:
 *  1. nearestNeighborTour  — builds a greedy initial tour visiting all towns
 *  2. twoOptImprove        — applies 2-opt local search (never worsens tour)
 *  3. must-visit anchoring — ensures mustVisitIndices appear before truncation point
 *  4. assignStops          — assigns nights, dates, scores, distances → Route
 */
export function optimizeRoute(input: OptimizerInput): Route {
  const { towns, distanceMatrix, config } = input;
  const { startIndex, mustVisitIndices, totalDays, maxStay } = config;
  const n = towns.length;

  if (n === 0) {
    return { stops: [], totalDistanceKm: 0, totalDays: 0, avgScore: 0 };
  }

  // Step 1: Build nearest-neighbor tour (all towns, must-visit preference)
  let tour = nearestNeighborTour(startIndex, distanceMatrix, mustVisitIndices);

  // Step 2: 2-opt improvement
  tour = twoOptImprove(tour, distanceMatrix);

  // Step 3: Must-visit anchoring
  // Determine how many stops will actually be visited given totalDays and maxStay.
  // Any must-visit town that falls beyond the truncation point is moved earlier.
  const truncationPoint = computeTruncationPoint(tour, totalDays, maxStay);
  tour = anchorMustVisits(tour, mustVisitIndices, truncationPoint);

  // Step 4: Assign stops (dates, nights, scores, distances)
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
