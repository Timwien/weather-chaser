import type { OptimizerInput, Route, Stop } from '../types/index.js';
import { DEFAULT_PLANNER_PARAMS, type PlannerParams } from './params.js';
import { allocateNights } from './nightsDP.js';
import { twoOptImprove } from './twoOpt.js';
import { orOptImprove } from './orOpt.js';
import { addDays } from './dateUtils.js';

/**
 * planRoute — utility-driven trip planner.
 *
 * Jointly optimizes WHICH towns to visit, in WHAT order, and HOW LONG to stay
 * at each, maximizing
 *
 *   J = Σ_days dayScore[townAtDay][day] − Σ_legs legCost(driveHours)
 *
 * Pipeline (deterministic, no randomness):
 *  1. Candidate pruning — top-N towns by mean day score (+ start + must-visits)
 *  2. For each feasible stop count K: greedy cheapest-insertion construction,
 *     2-opt + Or-opt on a penalized drive-cost matrix, then optimal night
 *     allocation via DP (allocateNights)
 *  3. The best few K get an improvement phase: position-move search with exact
 *     J evaluation (captures weather timing) interleaved with swap-out search
 *     (replace a chosen town with an unchosen candidate when J improves)
 *  4. Best (tour, nights) overall → Route
 */
export function planRoute(input: OptimizerInput): Route {
  const { towns, distanceMatrix, durationMatrix, weatherScores, config } = input;
  const { startIndex, mustVisitIndices, totalDays, maxStay } = config;
  const p: PlannerParams = { ...DEFAULT_PLANNER_PARAMS, ...(input.params ?? {}) };
  const n = towns.length;

  if (n === 0 || totalDays <= 0) {
    return { stops: [], totalDistanceKm: 0, totalDays: 0, avgScore: 0 };
  }

  // ── Day-score matrix (fallback: replicate static composite across all days) ──
  const dayScores: number[][] =
    input.dayScores ??
    weatherScores.map((s) => new Array<number>(totalDays).fill(s.composite));

  // ── Drive-hours + penalized leg-cost matrices ──────────────────────────────
  const hours: number[][] = buildHoursMatrix(distanceMatrix, durationMatrix, p);
  const legCost: number[][] = hours.map((row) =>
    row.map(
      (h) =>
        p.drivePenaltyPerHour * h +
        p.longLegExtraPerHour * Math.max(0, h - p.comfortLegHours),
    ),
  );

  // ── Candidate set: top-N by mean day score, always incl. start + must-visits ──
  const meanScore = (t: number) => {
    const row = dayScores[t];
    let s = 0;
    for (let d = 0; d < totalDays; d++) s += row[d] ?? 0;
    return s / totalDays;
  };
  const townValue = towns.map((_, t) => meanScore(t));

  const required = new Set<number>([startIndex, ...mustVisitIndices]);
  const byValue = towns
    .map((_, t) => t)
    .sort((a, b) => townValue[b] - townValue[a] || a - b);
  const candidates: number[] = [...required];
  for (const t of byValue) {
    if (candidates.length >= p.maxCandidates) break;
    if (!required.has(t)) candidates.push(t);
  }

  // ── Feasible K range ───────────────────────────────────────────────────────
  const minK = Math.min(
    totalDays,
    Math.max(1, Math.ceil(totalDays / maxStay), required.size),
  );
  const maxK = Math.max(minK, Math.min(totalDays, candidates.length, p.maxStops));

  interface Plan {
    tour: number[];
    nights: number[];
    j: number;
  }

  const evaluate = (tour: number[]): Plan => {
    const { nights, utility } = allocateNights(tour, dayScores, totalDays, maxStay);
    if (utility === -Infinity) return { tour, nights, j: -Infinity };
    let drive = 0;
    for (let i = 0; i < tour.length - 1; i++) drive += legCost[tour[i]][tour[i + 1]];
    return { tour, nights, j: utility - drive };
  };

  // ── Construction per K ─────────────────────────────────────────────────────
  const constructed: Plan[] = [];
  for (let k = minK; k <= maxK; k++) {
    const tour = constructTour(k, startIndex, mustVisitIndices, candidates, townValue, legCost, totalDays);
    const ordered = orOptImprove(twoOptImprove(tour, legCost), legCost);
    constructed.push(evaluate(ordered));
  }
  constructed.sort((a, b) => b.j - a.j || a.tour.length - b.tour.length);

  // ── Improvement phase on the best few K ────────────────────────────────────
  const mustSet = new Set(mustVisitIndices);
  let best: Plan = constructed[0] ?? { tour: [startIndex], nights: [totalDays], j: -Infinity };

  for (const seed of constructed.slice(0, p.improveTopK)) {
    if (seed.j === -Infinity) continue;
    let current = seed;
    for (let pass = 0; pass < p.maxSwapPasses; pass++) {
      let improved = false;

      // (a) Position-move with exact J — captures weather-timing gains 2-opt
      // can't see (it only knows drive cost, not arrival-day-dependent utility)
      const moved = bestPositionMove(current, evaluate);
      if (moved.j > current.j + 1e-9) {
        current = moved;
        improved = true;
      }

      // (b) Swap-out: replace a non-required stop with an unchosen candidate
      const inTour = new Set(current.tour);
      const pool = candidates
        .filter((c) => !inTour.has(c))
        .slice(0, p.swapCandidates);
      let bestSwap: Plan | null = null;
      for (let pos = 1; pos < current.tour.length; pos++) {
        const out = current.tour[pos];
        if (mustSet.has(out)) continue;
        for (const c of pool) {
          const candidate = [...current.tour];
          candidate[pos] = c;
          const reordered = orOptImprove(twoOptImprove(candidate, legCost), legCost);
          const plan = evaluate(reordered);
          if (plan.j > (bestSwap?.j ?? current.j) + 1e-9) bestSwap = plan;
        }
      }
      if (bestSwap) {
        current = bestSwap;
        improved = true;
      }

      if (!improved) break;
    }
    if (
      current.j > best.j + 1e-9 ||
      (Math.abs(current.j - best.j) <= 1e-9 && current.tour.length < best.tour.length)
    ) {
      best = current;
    }
  }

  if (best.j === -Infinity) {
    // Degenerate fallback: stay at the start town the whole trip
    best = { tour: [startIndex], nights: [totalDays], j: 0 };
  }

  return buildRoute(best.tour, best.nights, input, dayScores);
}

// ─────────────────────────────────────────────────────────────────────────────

function buildHoursMatrix(
  distanceKm: number[][],
  durationSec: number[][] | undefined,
  p: PlannerParams,
): number[][] {
  const n = distanceKm.length;
  const hasDurations =
    durationSec &&
    durationSec.length === n &&
    durationSec.some((row) => row.some((v) => v > 0));
  if (hasDurations) return durationSec.map((row) => row.map((s) => s / 3600));
  return distanceKm.map((row) => row.map((km) => km / p.fallbackSpeedKmh));
}

/**
 * Greedy cheapest-insertion construction: start + must-visits first, then the
 * candidate with the best (value·expectedDaysPerStop − insertion drive cost)
 * until K stops. Ties broken by town index for determinism.
 */
function constructTour(
  k: number,
  startIndex: number,
  mustVisitIndices: number[],
  candidates: number[],
  townValue: number[],
  legCost: number[][],
  totalDays: number,
): number[] {
  const tour: number[] = [startIndex];
  const used = new Set<number>([startIndex]);

  const insertCheapest = (t: number) => {
    let bestPos = tour.length;
    let bestDelta = Infinity;
    for (let pos = 1; pos <= tour.length; pos++) {
      const prev = tour[pos - 1];
      const next = pos < tour.length ? tour[pos] : null;
      const delta =
        next === null
          ? legCost[prev][t]
          : legCost[prev][t] + legCost[t][next] - legCost[prev][next];
      if (delta < bestDelta - 1e-12) {
        bestDelta = delta;
        bestPos = pos;
      }
    }
    tour.splice(bestPos, 0, t);
    used.add(t);
    return bestDelta;
  };

  for (const mv of mustVisitIndices) {
    if (!used.has(mv) && tour.length < k) insertCheapest(mv);
  }

  const expectedDays = totalDays / Math.max(1, k);
  while (tour.length < k) {
    let bestTown = -1;
    let bestGain = -Infinity;
    let bestPos = -1;
    for (const c of candidates) {
      if (used.has(c)) continue;
      // Cheapest insertion delta for c
      let delta = Infinity;
      let posFor = tour.length;
      for (let pos = 1; pos <= tour.length; pos++) {
        const prev = tour[pos - 1];
        const next = pos < tour.length ? tour[pos] : null;
        const d =
          next === null
            ? legCost[prev][c]
            : legCost[prev][c] + legCost[c][next] - legCost[prev][next];
        if (d < delta - 1e-12) {
          delta = d;
          posFor = pos;
        }
      }
      const gain = townValue[c] * expectedDays - delta;
      if (gain > bestGain + 1e-12 || (gain > bestGain - 1e-12 && c < bestTown)) {
        bestGain = gain;
        bestTown = c;
        bestPos = posFor;
      }
    }
    if (bestTown === -1) break;
    tour.splice(bestPos, 0, bestTown);
    used.add(bestTown);
  }

  return tour;
}

/**
 * Tries moving each stop (except the fixed start) to every other position,
 * evaluating the FULL objective (DP nights + drive cost). Returns the best
 * resulting plan (may be the input if nothing improves).
 */
function bestPositionMove(
  current: { tour: number[]; nights: number[]; j: number },
  evaluate: (tour: number[]) => { tour: number[]; nights: number[]; j: number },
): { tour: number[]; nights: number[]; j: number } {
  const k = current.tour.length;
  let best = current;
  for (let from = 1; from < k; from++) {
    for (let to = 1; to < k; to++) {
      if (to === from) continue;
      const tour = [...current.tour];
      const [node] = tour.splice(from, 1);
      tour.splice(to, 0, node);
      const plan = evaluate(tour);
      if (plan.j > best.j + 1e-9) best = plan;
    }
  }
  return best;
}

/** Builds the final Route: dates, per-stop temporal scores, leg distances. */
function buildRoute(
  tour: number[],
  nights: number[],
  input: OptimizerInput,
  dayScores: number[][],
): Route {
  const { towns, distanceMatrix, weatherScores, config } = input;
  const stops: Stop[] = [];
  let dayOffset = 0;

  for (let i = 0; i < tour.length; i++) {
    const t = tour[i];
    const stayNights = nights[i];
    // Temporal composite: mean day score over the actual stay window
    let sum = 0;
    for (let d = dayOffset; d < dayOffset + stayNights; d++) sum += dayScores[t][d] ?? 0;
    const composite = stayNights > 0 ? sum / stayNights : 0;

    stops.push({
      town: towns[t],
      arrivalDate: addDays(config.startDate, dayOffset),
      nights: stayNights,
      score: { composite, breakdown: weatherScores[t]?.breakdown ?? { sunshine: 0, precipitation: 0, temperature: 0, wind: 0 } },
      distanceToNextKm: i < tour.length - 1 ? distanceMatrix[t][tour[i + 1]] : undefined,
    });
    dayOffset += stayNights;
  }

  const totalDistanceKm = stops.reduce((s, st) => s + (st.distanceToNextKm ?? 0), 0);
  const totalNights = stops.reduce((s, st) => s + st.nights, 0);
  // Day-weighted average — a 3-night stop counts 3× a 1-night stop
  const avgScore =
    totalNights > 0
      ? stops.reduce((s, st) => s + st.score.composite * st.nights, 0) / totalNights
      : 0;

  return { stops, totalDistanceKm, totalDays: totalNights, avgScore };
}
