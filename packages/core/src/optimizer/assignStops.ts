import type { OptimizerInput, Route, Stop } from '../types/index.js';

/**
 * assignStops
 *
 * Given an ordered tour (array of town indices) and the full OptimizerInput,
 * assigns arrival dates, nights per stop, scores, and distances to produce a Route.
 *
 * Night distribution algorithm:
 *  1. Each stop is assigned at least 1 night.
 *  2. Nights are distributed greedily up to maxStay per stop, moving to the next
 *     stop when maxStay is reached or when only enough days remain for 1 night
 *     per remaining stop.
 *  3. If days remain after all stops have received their allocation (e.g. a single
 *     stop with totalDays > maxStay), the remaining days are added to the last stop.
 *  4. Scores come from the pre-computed weatherScores array — no re-scoring.
 *  5. distanceToNextKm: distanceMatrix[i][j] (already in km per types).
 *     Last stop has distanceToNextKm = undefined.
 */
export function assignStops(tour: number[], input: OptimizerInput): Route {
  const { towns, distanceMatrix, weatherScores, config } = input;
  const { startDate, totalDays, maxStay } = config;
  const n = tour.length;

  // -------------------------------------------------------------------------
  // Distribute nights across stops
  // -------------------------------------------------------------------------
  const nightsPerStop: number[] = new Array(n).fill(0);
  let daysRemaining = totalDays;

  for (let i = 0; i < n; i++) {
    const stopsLeft = n - i; // including current
    // Must leave at least 1 night for each remaining stop after current
    const stopsAfter = stopsLeft - 1;
    const maxForThisStop = Math.min(maxStay, daysRemaining - stopsAfter);

    // At least 1 night per stop (unless we are the last stop and have overflow)
    const nights = i === n - 1 ? daysRemaining : Math.max(1, maxForThisStop);

    nightsPerStop[i] = nights;
    daysRemaining -= nights;

    if (daysRemaining <= 0) {
      // Remaining stops get 0 — shouldn't happen given proper clamping above
      break;
    }
  }

  // -------------------------------------------------------------------------
  // Build Stop objects
  // -------------------------------------------------------------------------
  const stops: Stop[] = [];
  let dayOffset = 0; // cumulative nights before this stop

  for (let i = 0; i < n; i++) {
    const townIndex = tour[i];
    const nights = nightsPerStop[i];

    if (nights === 0) {
      // Skip stops that received no nights (can occur only if daysRemaining ran out early)
      break;
    }

    // Arrival date: startDate + dayOffset calendar days
    const arrivalDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Score from pre-computed weatherScores
    const score = weatherScores[townIndex];

    // Distance to next stop (undefined for last included stop)
    let distanceToNextKm: number | undefined;
    const nextStopIndex = findNextValidStopIndex(i + 1, nightsPerStop, n);
    if (nextStopIndex !== -1) {
      const nextTownIndex = tour[nextStopIndex];
      distanceToNextKm = distanceMatrix[townIndex][nextTownIndex];
    }

    stops.push({
      town: towns[townIndex],
      arrivalDate,
      nights,
      score,
      distanceToNextKm,
    });

    dayOffset += nights;
  }

  // -------------------------------------------------------------------------
  // Route-level aggregates
  // -------------------------------------------------------------------------
  const totalDistanceKm = stops.reduce(
    (sum, stop) => sum + (stop.distanceToNextKm ?? 0),
    0,
  );

  const avgScore =
    stops.length > 0
      ? stops.reduce((sum, stop) => sum + stop.score.composite, 0) / stops.length
      : 0;

  const actualTotalDays = stops.reduce((sum, stop) => sum + stop.nights, 0);

  return {
    stops,
    totalDistanceKm,
    totalDays: actualTotalDays,
    avgScore,
  };
}

/**
 * Finds the next stop index (>= fromIndex) that has nights > 0.
 * Returns -1 if none found.
 */
function findNextValidStopIndex(
  fromIndex: number,
  nightsPerStop: number[],
  length: number,
): number {
  for (let k = fromIndex; k < length; k++) {
    if (nightsPerStop[k] > 0) return k;
  }
  return -1;
}
