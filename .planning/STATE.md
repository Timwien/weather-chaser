# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Show travelers where the best weather is — and for campervan trips, the optimal multi-day route to chase it — through real towns, not dots on a grid
**Current focus:** Phase 1 — Core Algorithm + Route Planner Web

## Current Position

Phase: 1 of 5 (Core Algorithm + Route Planner Web)
Plan: 5 of 10 in current phase
Status: In progress
Last activity: 2026-02-27 — Plan 01-04 complete (web app shell: map, i18n, store, CSS tokens)

Progress: [███░░░░░░░] 6%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 min
- Total execution time: 16 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-algorithm-route-planner-web | 3 | 16 min | 5.3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (10 min), 01-02 (3 min), 01-04 (3 min)
- Trend: Stable at ~3 min for focused plans

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: @rnmapbox/maps + current Expo SDK compatibility must be verified before committing to map stack (research flag from SUMMARY.md)
- [Phase 1]: Open-Meteo free tier commercial use policy must be verified — may require commercial plan from launch
- [Phase 1]: Nominatim/OSRM demo server production policies must be confirmed; self-hosting/proxying is the answer regardless
- [Phase 3]: OSRM self-hosting requirements (memory, disk, EU OSM extract update cadence) need verification

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 01-04-PLAN.md — web app shell (MapLibre map, TanStack Router, i18n, CSS tokens, Zustand store)
Resume file: None
