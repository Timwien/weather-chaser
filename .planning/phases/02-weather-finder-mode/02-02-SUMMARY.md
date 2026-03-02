---
phase: 02-weather-finder-mode
plan: "02"
subsystem: ui
tags: [react, zustand, web-worker, vite, overpass, open-meteo, typescript]

# Dependency graph
requires:
  - phase: 02-01
    provides: finder state slice (finderConfig, finderTowns, finderHourlyCache, setFinderData), fetchTownsInRadius Overpass service, fetchHourlyWeatherBatch Open-Meteo service
  - phase: 01-core-algorithm-route-planner-web
    provides: Town type, HourlyWeather type from @weatherchaser/core
provides:
  - finder.worker.ts — Vite module worker that fetches towns in radius, deduplicates, sorts by population, caps at 120, fetches hourly weather batch, posts complete{towns, hourlyData}
  - useFinder.ts — React hook that starts the finder worker on run(), converts hourlyData array to Record<townId, HourlyWeather>, writes to store via setFinderData
affects:
  - 02-03
  - 02-04
  - 02-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite module worker pattern: new Worker(new URL('../workers/finder.worker.ts', import.meta.url), { type: 'module' })"
    - "Worker terminate on complete/error to prevent leaks — same pattern as optimizer.worker.ts / useOptimizer.ts"
    - "hourlyData array → Record<townId, HourlyWeather> conversion in hook for O(1) store lookup"

key-files:
  created:
    - apps/web/src/workers/finder.worker.ts
    - apps/web/src/hooks/useFinder.ts
  modified: []

key-decisions:
  - "finder.worker.ts is intentionally simpler than optimizer.worker.ts — no distance matrix, no scoring, no optimization step; raw data posted for in-memory re-scoring on filter changes"
  - "useFinder hook does NOT auto-trigger on mount — run() must be called explicitly by WeatherFinderStep (Plan 03)"
  - "HourlyWeatherData['hourly'] cache Record built in hook, not in worker — keeps worker free of store type knowledge"

patterns-established:
  - "Worker pipeline pattern: progress('finding_towns') → fetchTownsInRadius → dedup+sort+cap → progress('fetching_weather') → fetchHourlyWeatherBatch → complete"
  - "Hook worker lifecycle: terminate existing → create new → clearFinderData → setFinderLoading(true) → onmessage handler → terminate on complete/error"

requirements-completed: [FIND-01, FIND-02]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 2 Plan 02: Finder Worker and Hook Summary

**Vite module worker + React hook pipeline that fetches towns within radius and hourly weather batch, posts raw data to store for in-memory re-scoring on filter changes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T07:25:50Z
- **Completed:** 2026-03-02T07:32:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- finder.worker.ts posts progress steps finding_towns and fetching_weather before complete{towns, hourlyData} — mirrors optimizer.worker.ts pattern
- MAX_TOWNS=120 cap applied after dedup by id + sort by population desc — same approach as Phase 1
- useFinder.ts run() reads finderConfig/tripConfig from store, starts worker, converts hourlyData array to Record<townId, HourlyWeather> for setFinderData
- Worker terminates on both complete and error paths — no leaked workers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create finder.worker.ts** - `c63b259` (feat)
2. **Task 2: Create useFinder.ts hook** - `993f0f9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/src/workers/finder.worker.ts` - Web worker: Overpass radius query + hourly weather batch, posts progress/complete/error
- `apps/web/src/hooks/useFinder.ts` - React hook: starts finder worker on run(), writes results to Zustand store

## Decisions Made
- finder.worker.ts intentionally has no scoring step — all filter/preset/sort changes are re-applied in memory in the main thread (Plans 03-05), so the worker only runs on initial search
- useFinder does not auto-run on mount — explicit run() call required (WeatherFinderStep in Plan 03 triggers it)
- HourlyWeatherData-to-Record conversion done in the hook rather than the worker, keeping the worker focused on data fetching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- finder.worker.ts and useFinder.ts ready for Plan 03 (WeatherFinderStep UI component that calls useFinder().run())
- Store already has finderTowns and finderHourlyCache for Plans 04-05 to read for scoring and display

---
*Phase: 02-weather-finder-mode*
*Completed: 2026-03-02*
