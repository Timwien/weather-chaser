---
phase: 02-weather-finder-mode
plan: "01"
subsystem: ui
tags: [zustand, overpass, open-meteo, typescript, hourly-weather, finder]

# Dependency graph
requires:
  - phase: 01-core-algorithm-route-planner-web
    provides: Town, HourlyWeather, WeatherPreset types from @weatherchaser/core; runOverpassQuery infra in overpass.ts
provides:
  - Finder state slice in Zustand store (finderConfig, finderLoading, finderError, finderTowns, finderHourlyCache + 5 actions)
  - fetchTownsInRadius Overpass around-radius query
  - fetchHourlyWeatherBatch hourly weather batch service (batching at 50 towns)
affects:
  - 02-02 (finder UI uses store slice)
  - 02-03 (scoring uses finderTowns + finderHourlyCache)
  - 02-04 (results display reads from finderTowns)
  - 02-05 (map integration reads finderTowns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Finder state slice co-located with trip state in single Zustand store
    - Overpass around-filter reuses existing runOverpassQuery endpoint-fallback infra
    - Open-Meteo hourly= param (not daily=) with same 50-town batch pattern as weather.ts

key-files:
  created:
    - apps/web/src/services/weatherHourly.ts
  modified:
    - apps/web/src/stores/appStore.ts
    - apps/web/src/services/overpass.ts

key-decisions:
  - "HourlyWeather imported from @weatherchaser/core instead of redefined locally — core type matches Open-Meteo hourly response shape exactly (time, temperature_2m, precipitation, sunshine_duration, wind_speed_10m)"
  - "fetchTownsInRadius reuses runOverpassQuery with endpoint fallback — no code duplication, same retry/timeout behavior as existing fetchTownsInArea"
  - "FinderConfig kept as module-internal interface; FinderTimeOfDay and FinderSortBy exported as union types for use in UI components"

patterns-established:
  - "Finder state slice pattern: config object + loading/error/data fields + typed setter actions in single Zustand create call"
  - "Around-query pattern: buildAroundQuery(lat, lng, radiusM) → runOverpassQuery — mirrors existing bbox and polygon query builders"

requirements-completed: [FIND-01, FIND-02, FIND-05, FIND-06]

# Metrics
duration: 15min
completed: 2026-03-01
---

# Phase 2 Plan 01: Weather Finder Data Foundation Summary

**Zustand finder slice with radiusKm/preset/timeOfDay/sortBy config, Overpass around-radius query, and hourly Open-Meteo batch service — the data layer unblocking all Wave 2 finder plans**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-01T00:00:00Z
- **Completed:** 2026-03-01T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Extended appStore.ts with a complete finder state slice: FinderConfig interface, defaultFinderConfig (radiusKm=200, preset='sightseeing', timeOfDay='full', sortBy='score'), five state fields, five action implementations, and reset() updated to clear finder state
- Added fetchTownsInRadius to overpass.ts using Overpass `around:` filter syntax, reusing the existing runOverpassQuery endpoint-fallback mechanism
- Created weatherHourly.ts with fetchHourlyWeatherBatch using `hourly=` param (not `daily=`), batching at 50 towns per Open-Meteo request

## Task Commits

Each task was committed atomically:

1. **Task 1: Add finder state slice to appStore.ts** - `f13104f` (feat)
2. **Task 2: Add fetchTownsInRadius and create weatherHourly.ts** - `b10738c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/src/stores/appStore.ts` - Added FinderConfig interface, exported FinderTimeOfDay/FinderSortBy types, finder fields in AppState, defaultFinderConfig, initial state values, and five finder action implementations; updated reset()
- `apps/web/src/services/overpass.ts` - Added buildAroundQuery and fetchTownsInRadius functions
- `apps/web/src/services/weatherHourly.ts` - New file: HourlyWeatherData interface, fetchHourlyBatch, fetchHourlyWeatherBatch with 50-town batching

## Decisions Made

- `HourlyWeather` imported from `@weatherchaser/core` instead of redefined locally — the core type already has the exact shape Open-Meteo returns for the `hourly` param (time, temperature_2m, precipitation, sunshine_duration, wind_speed_10m). Importing avoids duplication and type drift.
- `fetchTownsInRadius` reuses `runOverpassQuery` with its built-in endpoint fallback (overpass-api.de → overpass.private.coffee) — consistent retry/timeout behavior with existing town fetch functions.
- `FinderTimeOfDay` and `FinderSortBy` are exported as union types so future UI components can use them without reaching into the store internals.

## Deviations from Plan

None — plan executed exactly as written, with one beneficial adaptation: the plan noted to check if `@weatherchaser/core` exports `HourlyWeather` (it does), and to import from there instead of defining locally. This was followed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Finder state slice is fully shaped and typed — Plans 02-02 through 02-05 can use `useAppStore` for all finder state without further store changes
- `fetchTownsInRadius` ready for use in the finder search orchestration (Plan 02-02)
- `fetchHourlyWeatherBatch` ready for the weather fetch step in the finder pipeline
- TypeScript compiles with zero errors after all changes

---
*Phase: 02-weather-finder-mode*
*Completed: 2026-03-01*

## Self-Check: PASSED

- FOUND: apps/web/src/stores/appStore.ts
- FOUND: apps/web/src/services/overpass.ts
- FOUND: apps/web/src/services/weatherHourly.ts
- FOUND: .planning/phases/02-weather-finder-mode/02-01-SUMMARY.md
- FOUND commit: f13104f (feat(02-01): add finder state slice to appStore.ts)
- FOUND commit: b10738c (feat(02-01): add fetchTownsInRadius and weatherHourly batch service)
