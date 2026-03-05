---
phase: 03-backend-auth-production-hosting
plan: "03"
subsystem: infra
tags: [proxy, open-meteo, nominatim, overpass, osrm, vite, import.meta.env]

# Dependency graph
requires:
  - phase: 03-01
    provides: Vercel proxy endpoints for Nominatim, Overpass, and Open-Meteo at /api/proxy/*

provides:
  - Nominatim service uses /api/proxy/nominatim in production (dev: direct API)
  - Overpass service uses /api/proxy/overpass in production (dev: multi-endpoint fallback)
  - Daily weather service (weather.ts) uses /api/proxy/weather in production (dev: direct API)
  - Hourly weather service (weatherHourly.ts) uses /api/proxy/weather in production (dev: direct API)
  - OSRM public demo server guarded behind !import.meta.env.PROD
  - Weather proxy updated to forward start_date, end_date, daily params (batch mode support)

affects:
  - 03-04
  - 03-05
  - 03-06
  - 03-07

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import.meta.env.PROD ternary to switch service base URL between proxy and direct"
    - "Constant pair pattern: PROXY = '/api/proxy/...' + DIRECT = 'https://...'; base = PROD ? PROXY : DIRECT"
    - "Dev-only Referer/User-Agent headers on Nominatim direct fetch"
    - "!import.meta.env.PROD guard for third-party demo servers prohibited in production"

key-files:
  created: []
  modified:
    - apps/web/src/services/nominatim.ts
    - apps/web/src/services/overpass.ts
    - apps/web/src/services/weather.ts
    - apps/web/src/services/weatherHourly.ts
    - apps/web/src/services/osrm.ts
    - apps/web/api/proxy/weather.ts

key-decisions:
  - "weather.ts and weatherHourly.ts both updated (not combined) — they serve distinct data models: DailyWeather vs HourlyWeather; batch signatures identical"
  - "Weather proxy extended to forward start_date, end_date, daily params — original proxy only supported forecast_days+hourly (single-location finder mode); batch route-optimizer calls need date-range params"
  - "WEATHER_DIRECT constant retained in both services; URL only reachable in dev (import.meta.env.PROD ternary)"
  - "Nominatim Referer header sent only in dev — in production the proxy sets server-side headers; cross-origin Referer header is ignored anyway"

patterns-established:
  - "Production proxy pattern: const BASE = import.meta.env.PROD ? '/api/proxy/X' : 'https://direct.api'; const url = new URL(BASE, window.location.origin)"
  - "Dev-only third-party access pattern: if (!import.meta.env.PROD) { try { ... } catch { } } around demo server calls"

requirements-completed:
  - INFRA-03
  - WTHR-02

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 03 Plan 03: API Service Proxy Migration Summary

**All three client-side API services (Nominatim, Overpass, Open-Meteo) route through /api/proxy/* in production using import.meta.env.PROD ternaries; OSRM demo server guarded behind dev-only flag**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T15:10:11Z
- **Completed:** 2026-03-05T15:13:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `nominatim.ts` routes to `/api/proxy/nominatim` in production; direct Nominatim in dev
- `overpass.ts` routes all Overpass queries through `/api/proxy/overpass` in production; multi-endpoint fallback in dev
- `weather.ts` (daily batch) and `weatherHourly.ts` (hourly batch) both route through `/api/proxy/weather` in production
- `osrm.ts` public demo server calls wrapped in `!import.meta.env.PROD` guard — production goes straight from configured OSRM URL to Haversine fallback
- Weather proxy updated to forward `start_date`, `end_date`, `daily` params needed by batch services

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Nominatim and Overpass services to proxy** - `5b483e4` (feat)
2. **Task 2: Migrate weather services to proxy; guard OSRM demo behind !PROD** - `1dfe63e` (feat)

**Plan metadata:** (docs commit — see state updates)

## Files Created/Modified
- `apps/web/src/services/nominatim.ts` - NOMINATIM_BASE ternary; Referer header moved to dev-only
- `apps/web/src/services/overpass.ts` - OVERPASS_PROXY constant; runOverpassQuery production branch
- `apps/web/src/services/weather.ts` - WEATHER_PROXY/WEATHER_DIRECT constants; fetchBatch uses base ternary
- `apps/web/src/services/weatherHourly.ts` - Same pattern as weather.ts for hourly data
- `apps/web/src/services/osrm.ts` - !PROD guard around public demo server block
- `apps/web/api/proxy/weather.ts` - Forwarding extended to include start_date, end_date, daily params

## Decisions Made
- `weather.ts` and `weatherHourly.ts` kept as separate services (not merged) — they return different types (`DailyWeather` vs `HourlyWeather`), have different callers (optimizer.worker vs finder.worker), and merging would complicate the API
- Weather proxy generalized to forward all relevant Open-Meteo params — original only handled `forecast_days`+`hourly` for a finder-style single-location fetch; batch services use `start_date`/`end_date`/`daily`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended weather proxy to forward batch-mode params**
- **Found during:** Task 2 (weather service proxy migration)
- **Issue:** The existing `api/proxy/weather.ts` only forwarded `forecast_days`, `hourly`, and `timezone` — the batch services (`weather.ts` and `weatherHourly.ts`) send `start_date`, `end_date`, `daily` params which the proxy would silently drop, causing incorrect Open-Meteo responses in production
- **Fix:** Updated proxy to iterate a `forwardParams` list that includes `daily`, `hourly`, `start_date`, `end_date`, `forecast_days`, `timezone` — all forwarded if present
- **Files modified:** `apps/web/api/proxy/weather.ts`
- **Verification:** Type-check passes; proxy now forwards all params batch services need
- **Committed in:** `1dfe63e` (Task 2 commit)

**2. [Rule 1 - Structural] Plan asked to "create" weather.ts but two weather services already existed**
- **Found during:** Task 2 pre-analysis
- **Issue:** The plan assumed weather.ts did not exist and planned to create it from scratch. In reality, `weather.ts` (daily batch) and `weatherHourly.ts` (hourly batch) already existed from Phase 2 work
- **Fix:** Updated both existing files with proxy routing instead of creating a new standalone weather.ts; the existing two-file structure with separate daily/hourly types is correct
- **Files modified:** `apps/web/src/services/weather.ts`, `apps/web/src/services/weatherHourly.ts`
- **Verification:** Type-check passes; both services correctly use proxy in PROD, direct in dev
- **Committed in:** `1dfe63e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking proxy param gap, 1 structural correction for pre-existing services)
**Impact on plan:** Both fixes necessary for production correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required for this plan. (Proxy endpoints were set up in Plan 03-01.)

## Next Phase Readiness
- All public API services now INFRA-03 compliant — no production browser-to-public-API calls
- Dev experience unchanged — all services work without Vercel CLI (direct API calls in dev)
- Ready for Plan 03-04 (next wave in phase)

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-05*
