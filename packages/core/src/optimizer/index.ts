import type { OptimizerInput, Route } from '../types/index.js';
import { planRoute } from './planRoute.js';

export { nearestNeighborTour } from './nearestNeighbor.js';
export { twoOptImprove } from './twoOpt.js';
export { orOptImprove } from './orOpt.js';
export { assignStops } from './assignStops.js';
export { allocateNights } from './nightsDP.js';
export { planRoute } from './planRoute.js';
export { DEFAULT_PLANNER_PARAMS } from './params.js';
export type { PlannerParams } from './params.js';

/**
 * optimizeRoute
 *
 * Single public entry point for route optimization. Delegates to planRoute,
 * the utility-driven planner that jointly optimizes town selection, visit
 * order, and night allocation against
 *
 *   J = Σ_days dayScore[townAtDay][day] − Σ_legs legCost(driveHours)
 *
 * See planRoute.ts for the full pipeline. The previous geometric pipeline
 * (nearest-neighbor + 2-opt + truncation) only minimized distance and ignored
 * weather when choosing stops; its building blocks remain exported above.
 */
export function optimizeRoute(input: OptimizerInput): Route {
  return planRoute(input);
}
