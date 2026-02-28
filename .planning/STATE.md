# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Show travelers where the best weather is — and for campervan trips, the optimal multi-day route to chase it — through real towns, not dots on a grid
**Current focus:** Phase 1 — Core Algorithm + Route Planner Web

## Current Position

Phase: 1 of 5 (Core Algorithm + Route Planner Web)
Plan: 7 of 10 in current phase
Status: In progress
Last activity: 2026-02-28 — Plan 01-06 complete (entry panel redesign, petrol teal design system, date picker popover, multi-location, CartoDB tiles)

Progress: [██████░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 33 min
- Total execution time: 181 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-algorithm-route-planner-web | 6 | 181 min | 30.2 min |

**Recent Trend:**
- Last 6 plans: 01-01 (10 min), 01-02 (3 min), 01-04 (3 min), 01-05 (15 min), 01-03 (30 min), 01-06 (120 min)
- Trend: 01-06 longer due to human-verify checkpoint + full design feedback round

*Updated after each plan completion*

| Phase/Plan | Duration | Tasks | Files |
|-----------|---------|-------|-------|
| Phase 01 P06 | 120 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Full rebuild — not incremental patching. Static HTML/JS MVP is proof-of-concept only.
- [Init]: Turborepo monorepo with packages/core (pure TS algorithm), apps/web, apps/mobile, apps/api
- [Init]: MapLibre GL JS on web, @rnmapbox/maps on native — two distinct map implementations, not shared
- [Init]: Route optimizer runs client-side (fast, deterministic, no server round-trip)
- [Init]: Supabase (Frankfurt region) for auth + Postgres + GDPR compliance
- [01-01]: allowImportingTsExtensions: true added to apps/web tsconfig — required for .tsx imports with Bundler moduleResolution + noEmit; Vite handles bundling
- [01-01]: packages/core exports map pre-declares ./scoring and ./optimizer sub-paths for Plans 02 and 03
- [01-02]: vitest@4.0.18 chosen for packages/core test framework — native ESM, zero-config
- [01-02]: Precipitation uses totalPrecipMm (sum over stay window) not average — better reflects multi-day accumulation
- [01-02]: Date matching by UTC YYYY-MM-DD prefix on ISO timestamps — aligns with Open-Meteo API format
- [01-02]: sliceHoursByDays extracted to own file when weatherScore.ts exceeded 80 lines (per plan REFACTOR rule)
- [01-04]: createRoute (with getParentRoute) used instead of createFileRoute in TanStack Router v1 — createFileRoute requires Vite codegen plugin for correct types in manual route tree construction
- [01-04]: MapLibre demotiles.maplibre.org used as dev tile style — no token required; production tile provider is Phase 3
- [01-04]: Zustand store fully shaped from day one — all Phase 1 UI plans can use useAppStore without store changes
- [01-05]: MaplibreTerradrawControl (IControl) used — plan referenced fictional MaplibreGlTerradraw class; drawing activated via getTerraDrawInstance().setMode('polygon')
- [01-05]: useMap() destructured as { current: map } — hook returns { current?: MapRef } not { map: MapRef }
- [01-05]: Phase 1 uses public Nominatim and Overpass endpoints directly — Phase 3 adds server-side proxy
- [01-03]: distanceMatrix is km (per type definition // km distances NxN) — no /1000 conversion in assignStops
- [01-03]: addDays extracted to optimizer/dateUtils.ts when assignStops.ts exceeded 100 lines
- [01-03]: Must-visit anchoring is two-stage: NN 2x-threshold preference + post-2-opt explicit swap to boundary
- [Phase 01]: Petrol teal #0E7490 chosen as primary accent — Cyan-700 reads premium without being turquoise-bright
- [Phase 01]: Calendar popover built custom (no library) — 2-month grid in ~150 lines avoids dependency for Phase 1
- [Phase 01]: CartoDB Positron GL replaces demotiles.maplibre.org — free, no API key, clean Google Maps aesthetic
- [Phase 01]: searchAreas[] array added alongside legacy searchArea in store — polygon draw callbacks use legacy; Plan 07 migrates

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: @rnmapbox/maps + current Expo SDK compatibility must be verified before committing to map stack (research flag from SUMMARY.md)
- [Phase 1]: Open-Meteo free tier commercial use policy must be verified — may require commercial plan from launch
- [Phase 1]: Nominatim/OSRM demo server production policies must be confirmed; self-hosting/proxying is the answer regardless
- [Phase 3]: OSRM self-hosting requirements (memory, disk, EU OSM extract update cadence) need verification

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 01-06-PLAN.md — entry panel redesign, petrol teal design system, date picker popover, multi-location tags, CartoDB tiles
Resume file: None
