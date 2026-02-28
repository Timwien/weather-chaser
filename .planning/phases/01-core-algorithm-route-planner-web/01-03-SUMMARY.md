---
phase: 01-core-algorithm-route-planner-web
plan: 03
subsystem: algorithm
tags: [vitest, typescript, optimizer, tdd, nearest-neighbor, two-opt, route, must-visit]

# Dependency graph
requires:
  - phase: 01-01
    provides: packages/core skeleton with shared domain types (Town, Route, OptimizerInput, etc.)
  - phase: 01-02
    provides: WeatherScore type and scoring module (used by assignStops via pre-computed scores)
provides:
  - nearestNeighborTour(startIndex, distanceMatrix, mustVisitIndices) → number[]
  - twoOptImprove(tour, distanceMatrix) → number[] (local-optimal, never worse)
  - assignStops(tour, input) → Route (dates, nights, scores, distances assigned from pre-computed weatherScores)
  - addDays(date, days) → Date (extracted date arithmetic helper)
  - optimizeRoute(input) → Route (single public entry point: NN → 2-opt → must-visit anchoring → assignStops)
  - packages/core/src/optimizer/* module with barrel index
  - packages/core/src/index.ts updated to re-export optimizer module
  - Vitest test suite (38 tests across 3 test files, all passing)
affects:
  - 01-07-PLAN
  - 01-10-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED-GREEN-REFACTOR committed atomically (3 commits)
    - Nearest-neighbor greedy tour with must-visit 2x-threshold priority (ALGO-07)
    - 2-opt improvement loop with floating-point epsilon (1e-10) for stability
    - Night distribution algorithm: greedy up to maxStay, always leaving 1 night per remaining stop
    - Must-visit anchoring: post-2-opt swap to bring must-visits inside truncation boundary
    - distanceMatrix uses km (per types/index.ts) — no unit conversion needed
    - Pre-computed weatherScores passed in OptimizerInput; assignStops does not re-score

key-files:
  created:
    - packages/core/src/optimizer/nearestNeighbor.ts
    - packages/core/src/optimizer/nearestNeighbor.test.ts
    - packages/core/src/optimizer/twoOpt.ts
    - packages/core/src/optimizer/twoOpt.test.ts
    - packages/core/src/optimizer/assignStops.ts
    - packages/core/src/optimizer/assignStops.test.ts
    - packages/core/src/optimizer/dateUtils.ts
    - packages/core/src/optimizer/index.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "distanceMatrix type comment says 'km distances NxN' — used km directly in assignStops (no /1000 conversion); plan note about meters was inconsistent with the type definition"
  - "addDays extracted to dateUtils.ts when assignStops.ts exceeded 100 lines (per plan REFACTOR rule)"
  - "Must-visit priority in NN: prefer must-visit over nearest non-must-visit when within 2x nearest distance — prevents must-visits from landing at end of tour past truncation point"
  - "Must-visit anchoring step added in optimizeRoute: after 2-opt, any must-visit beyond truncationPoint is swapped to boundary — explicit ALGO-07 guarantee"
  - "2-opt uses open-path distance (no return edge) — consistent with route-planning use case (not TSP circuit)"

patterns-established:
  - "Optimizer pipeline: nearestNeighborTour → twoOptImprove → anchorMustVisits → assignStops"
  - "TDD: test files committed RED (failing), then implementation GREEN (passing), then REFACTOR (cleanup)"
  - "Night distribution: greedy per-stop with reserve (daysRemaining - stopsAfter ensures minimum 1 night per remaining stop)"

requirements-completed:
  - ALGO-01
  - ALGO-04
  - ALGO-05
  - ALGO-06
  - ALGO-07

# Metrics
duration: 30min
completed: 2026-02-28
---

# Phase 1 Plan 03: Route Optimizer (Nearest-Neighbor + 2-Opt + Stop Assignment) Summary

**TDD-implemented route optimizer: nearest-neighbor tour with must-visit priority, 2-opt local search improvement, and stop assignment producing a complete Route with dates, nights, pre-computed scores, and distances**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-28T07:59:38Z
- **Completed:** 2026-02-28T08:29:37Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 9

## Accomplishments

- 38 optimizer tests across 3 test files — all passing (76 total in packages/core including 17 scoring + 21 dist duplicates)
- `nearestNeighborTour`: greedy NN tour visiting all n towns exactly once, must-visit towns prioritized when within 2x nearest-neighbor distance
- `twoOptImprove`: 2-opt local search that provably never increases total tour distance, with floating-point epsilon guard
- `assignStops`: distributes nights across stops (maxStay cap, minimum 1 per stop, excess on last stop), computes arrival dates, reads pre-scored weatherScores, totals distance and average composite score
- `optimizeRoute`: full pipeline NN → 2-opt → must-visit anchoring → assignStops, with post-2-opt guarantee that all must-visit towns appear before the truncation point
- `addDays` date helper extracted to `dateUtils.ts` per 100-line threshold rule
- packages/core build succeeds; `dist/optimizer/index.js` emitted; TypeScript strict mode satisfied

## Task Commits

Each TDD phase committed atomically:

1. **RED: Failing tests for nearest-neighbor, 2-opt, assignStops** - `2147c98` (test)
2. **GREEN: Implement nearest-neighbor, 2-opt, assignStops, optimizeRoute** - `421f8c5` (feat)
3. **REFACTOR: Extract addDays date helper from assignStops** - `7e67533` (refactor)

## Files Created/Modified

- `packages/core/src/optimizer/nearestNeighbor.ts` — greedy NN tour builder with must-visit 2x-threshold preference
- `packages/core/src/optimizer/nearestNeighbor.test.ts` — 6 tests: permutation correctness, must-visit inclusion, edge cases (1/2 towns), greedy order without must-visits
- `packages/core/src/optimizer/twoOpt.ts` — standard 2-opt improvement loop (never worsens, identity if already optimal)
- `packages/core/src/optimizer/twoOpt.test.ts` — 5 tests: known crossover improvement, no-worsen for optimal, single/two-element tours, permutation validity
- `packages/core/src/optimizer/assignStops.ts` — night distribution, arrival dates, pre-scored stops, totalDistanceKm, avgScore
- `packages/core/src/optimizer/assignStops.test.ts` — 10 tests: 3 night-distribution scenarios, arrival date arithmetic, distance km passthrough, totalDistanceKm sum, avgScore mean, correct town references, pre-computed score passthrough
- `packages/core/src/optimizer/dateUtils.ts` — addDays(date, days): Date helper (extracted from assignStops)
- `packages/core/src/optimizer/index.ts` — barrel re-exporting all optimizer functions + optimizeRoute entry point with anchorMustVisits
- `packages/core/src/index.ts` — added `export * from './optimizer/index.js'`

## Decisions Made

- **distanceMatrix is km, not meters:** The types/index.ts type definition includes the comment `// km distances NxN`. The plan mentioned `/1000` conversion for meters, but the authoritative type definition was followed. No unit conversion in assignStops.
- **addDays extraction:** assignStops.ts reached 125 lines; per plan REFACTOR rule (>100 lines), date arithmetic extracted to dateUtils.ts
- **Must-visit anchoring is a two-stage guarantee:** Stage 1 — NN tour builds with 2x-threshold preference (must-visits appear early in greedy order); Stage 2 — optimizeRoute explicitly swaps any must-visit that fell past the truncation boundary after 2-opt reordering
- **2-opt uses open-path distance:** No return-to-start edge. Route planning, not TSP circuit — consistent with Stop-based Route output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] distanceMatrix unit discrepancy: followed type definition (km) over plan comment (meters)**
- **Found during:** GREEN — assignStops implementation
- **Issue:** Plan said "distanceMatrix stores meters, divide by 1000 for km". Type definition `packages/core/src/types/index.ts` has `distanceMatrix: number[][] // km distances NxN`. Using /1000 would have produced incorrect (100x smaller) distances.
- **Fix:** Used distanceMatrix values directly as km in assignStops and tests. The test `distanceToNextKm uses distanceMatrix directly (km)` explicitly validates this.
- **Files modified:** `packages/core/src/optimizer/assignStops.ts`, `packages/core/src/optimizer/assignStops.test.ts`
- **Commit:** `421f8c5` (GREEN commit)

---

**Total deviations:** 1 auto-fixed (unit inconsistency resolved by following type definition over plan prose)
**Impact on plan:** No scope change; assignStops contract unchanged; tests document the km-direct behavior.

## Issues Encountered

None beyond the unit discrepancy above.

## User Setup Required

None.

## Next Phase Readiness

- `optimizeRoute(input: OptimizerInput): Route` is the public API consumed by Plan 07 (Web Worker)
- Pre-computed `weatherScores` must be populated before calling `optimizeRoute` — Plan 07's worker does this by calling `scoreLocation` per town before passing `OptimizerInput`
- All exports available via `@weatherchaser/core` (root) or `@weatherchaser/core/optimizer` sub-path
- `PRESETS` from Plan 02 provides default `ScoringWeights` for `OptimizerConfig.weights`

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-28*
