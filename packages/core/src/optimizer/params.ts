/**
 * Tunable parameters for the route planner objective.
 *
 * The objective trades weather utility (0–100 points per trip day) against
 * drive cost in the same unit:
 *
 *   J = Σ_days dayScore[townAtDay][day] − Σ_legs legCost(hours)
 *   legCost(h) = drivePenaltyPerHour·h + longLegExtraPerHour·max(0, h − comfortLegHours)
 *
 * drivePenaltyPerHour = 12 means: one hour of driving is worth 12 score
 * points — moving is justified when the destination is ~12 points/day better
 * for at least one day per drive-hour. The long-leg surcharge makes monster
 * single-day hops (e.g. 400 km) expensive without forbidding them outright.
 */
export interface PlannerParams {
  /** Weather-score points one drive hour costs. */
  drivePenaltyPerHour: number;
  /** Legs up to this many hours are "comfortable" — no surcharge. */
  comfortLegHours: number;
  /** Extra points per hour beyond comfortLegHours. */
  longLegExtraPerHour: number;
  /** Candidate towns considered by the planner (top-N by mean day score). */
  maxCandidates: number;
  /** Hard cap on number of stops tried. */
  maxStops: number;
  /** How many stop-counts (K values) get the full improvement phase. */
  improveTopK: number;
  /** Unchosen candidates considered per swap-out evaluation. */
  swapCandidates: number;
  /** Maximum swap-out improvement passes per K. */
  maxSwapPasses: number;
  /** Average speed (km/h) used when no duration matrix is available. */
  fallbackSpeedKmh: number;
}

export const DEFAULT_PLANNER_PARAMS: PlannerParams = {
  drivePenaltyPerHour: 12,
  comfortLegHours: 3,
  longLegExtraPerHour: 18,
  maxCandidates: 40,
  maxStops: 12,
  improveTopK: 3,
  swapCandidates: 20,
  maxSwapPasses: 6,
  fallbackSpeedKmh: 70,
};
