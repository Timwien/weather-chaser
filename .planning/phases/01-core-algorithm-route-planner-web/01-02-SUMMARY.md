---
phase: 01-core-algorithm-route-planner-web
plan: 02
subsystem: algorithm
tags: [vitest, typescript, scoring, tdd, pure-functions, weights, presets]

# Dependency graph
requires:
  - phase: 01-01
    provides: packages/core skeleton with shared domain types (HourlyWeather, WeatherScore, ScoringWeights)
provides:
  - scoreLocation function (temporal slice + 4-dimension normalized composite score 0-100)
  - normalize helper (linear clamped normalization)
  - sliceHoursByDays helper (filters HourlyWeather to UTC calendar-day stay window)
  - PRESETS map (beach/hiking/sightseeing ScoringWeights constants)
  - packages/core/src/scoring/* module with barrel index
  - packages/core/src/index.ts updated to re-export scoring module
  - Vitest test suite (17 tests, 100% passing)
affects:
  - 01-03-PLAN
  - 01-05-PLAN
  - 01-06-PLAN
  - 01-07-PLAN

# Tech tracking
tech-stack:
  added:
    - vitest@4.0.18
  patterns:
    - TDD RED-GREEN-REFACTOR: failing tests committed first, then implementation, then refactor
    - Temporal slicing by UTC date string prefix (YYYY-MM-DD) for Open-Meteo ISO timestamp format
    - Precipitation uses total over stay (sum), temperature/wind/sunshine use averages
    - Inverted normalization for precipitation and wind (lower = better)
    - scoreLocation returns composite (0-100) + per-dimension breakdown
    - sliceHoursByDays extracted to own file when parent exceeds 80 lines

key-files:
  created:
    - packages/core/src/scoring/weatherScore.ts
    - packages/core/src/scoring/sliceHoursByDays.ts
    - packages/core/src/scoring/presets.ts
    - packages/core/src/scoring/index.ts
    - packages/core/src/scoring/weatherScore.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/package.json

key-decisions:
  - "vitest@4.0.18 chosen for test framework — native ESM support, zero-config, compatible with packages/core ESM-first setup"
  - "Precipitation uses totalPrecipMm (sum over stay) not avg, to capture multi-day accumulation better"
  - "sliceHoursByDays extracts dates as UTC YYYY-MM-DD to match Open-Meteo ISO timestamp format"
  - "sliceHoursByDays extracted to sliceHoursByDays.ts when weatherScore.ts exceeded 80 lines (per plan REFACTOR rule)"

patterns-established:
  - "Scoring normalization: normalize(v, min, max) clamps to [0,1]; invert with (1 - normalize(...)) for lower-is-better dimensions"
  - "Temporal slicing: ISO timestamp first 10 chars = YYYY-MM-DD; build Set<string> of stay-window dates then filter"
  - "TDD in packages/core: pnpm --filter @weatherchaser/core test runs vitest run"

requirements-completed:
  - WTHR-01
  - ALGO-02
  - TRIP-04

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 1 Plan 02: Temporal Weather Scoring Summary

**vitest-tested scoreLocation function with temporal slicing, 4-dimension weighted normalization (0-100), and beach/hiking/sightseeing PRESETS — the foundational scoring contract for the route optimizer**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-27T20:26:54Z
- **Completed:** 2026-02-27T20:29:53Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 7

## Accomplishments
- Vitest test suite with 17 tests covering normalize, sliceHoursByDays, scoreLocation, and PRESETS — all passing
- scoreLocation correctly uses only hours within the temporal stay window (arrival date + nights), excluding out-of-window hours
- All three presets (beach/hiking/sightseeing) produce different composite scores for identical weather data
- normalize clamps strictly to [0, 1] — no out-of-range output regardless of input extremes
- packages/core/src/index.ts now exports scoreLocation and PRESETS for downstream consumers

## Task Commits

Each TDD phase was committed atomically:

1. **RED: Failing tests for temporal weather scoring** - `9713cb9` (test)
2. **GREEN: Implement temporal weather scoring module** - `4be87e1` (feat)
3. **REFACTOR: Extract sliceHoursByDays to dedicated helper module** - `b2d42bc` (refactor)

_Note: TDD plan — three commits per RED-GREEN-REFACTOR cycle_

## Files Created/Modified
- `packages/core/src/scoring/weatherScore.ts` - normalize() and scoreLocation() functions; re-exports sliceHoursByDays
- `packages/core/src/scoring/sliceHoursByDays.ts` - Extracted helper: filters HourlyWeather to stay-window calendar days
- `packages/core/src/scoring/presets.ts` - PRESETS constant with beach/hiking/sightseeing ScoringWeights
- `packages/core/src/scoring/index.ts` - Barrel: re-exports normalize, sliceHoursByDays, scoreLocation, PRESETS
- `packages/core/src/scoring/weatherScore.test.ts` - 17 vitest tests covering all scoring contracts
- `packages/core/src/index.ts` - Added `export * from './scoring/index.js'`
- `packages/core/package.json` - Added vitest@4.0.18 devDependency and "test": "vitest run" script

## Decisions Made
- Used `vitest@4.0.18` — native ESM, zero-config, works directly with packages/core's TypeScript ESM setup
- Precipitation scoring uses `totalPrecipMm` (sum over stay window) rather than average — better reflects multi-day accumulation impact on trips
- Date matching by UTC YYYY-MM-DD prefix on ISO timestamps — aligns with Open-Meteo API output format
- Extracted `sliceHoursByDays` to its own file after weatherScore.ts exceeded 80 lines (per plan's REFACTOR rule)

## Deviations from Plan

None - plan executed exactly as written. REFACTOR extraction triggered by the plan's own 80-line threshold rule.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scoreLocation and PRESETS are ready for Plan 03 (route optimizer) to consume
- packages/core exports scoring via `@weatherchaser/core/scoring` sub-path (pre-declared in exports map from Plan 01)
- Test pattern established: `pnpm --filter @weatherchaser/core test`
- Plan 03 (optimizer) can import `{ scoreLocation, PRESETS }` from `@weatherchaser/core/scoring`

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: packages/core/src/scoring/weatherScore.ts
- FOUND: packages/core/src/scoring/sliceHoursByDays.ts
- FOUND: packages/core/src/scoring/presets.ts
- FOUND: packages/core/src/scoring/index.ts
- FOUND: packages/core/src/scoring/weatherScore.test.ts
- FOUND: packages/core/dist/scoring/index.js
- FOUND: commit 9713cb9 (RED — failing tests)
- FOUND: commit 4be87e1 (GREEN — implementation)
- FOUND: commit b2d42bc (REFACTOR — extract helper)
- All 17 tests pass (pnpm test exits 0)
