---
phase: 01-core-algorithm-route-planner-web
plan: 07
subsystem: ui
tags: [web-worker, open-meteo, osrm, haversine, zustand, vite]

requires:
  - phase: 01-03
    provides: optimizeRoute, assignStops — core algorithm
  - phase: 01-05
    provides: fetchTownsInArea, fetchTownsInPolygon — Overpass town fetching
  - phase: 01-06
    provides: appStore with searchAreas[], tripConfig, setRoute, setMode, loadingStep

provides:
  - Web Worker pipeline orchestrating: town fetch → weather batch → OSRM matrix → optimizeRoute
  - fetchWeatherBatch(towns, startDate, endDate) — Open-Meteo multi-location batch
  - fetchDistanceMatrix(towns) — OSRM /table with Haversine fallback at 70 km/h
  - useOptimizer hook — creates/manages Web Worker, posts input, handles progress+result
  - LoadingOverlay — frosted glass card with 3 animated progress steps
  - Dev search area defaults (6 Bavaria/Austria/Switzerland places) behind import.meta.env.DEV

affects:
  - 01-08-results-display (reads route from store)
  - 01-09-share-export (route must be in store)

tech-stack:
  added: []
  patterns: [vite-module-worker, web-worker-lifecycle, haversine-fallback, abort-signal-timeout]

key-files:
  created:
    - apps/web/src/workers/optimizer.worker.ts
    - apps/web/src/services/weather.ts
    - apps/web/src/services/osrm.ts
    - apps/web/src/hooks/useOptimizer.ts
    - apps/web/src/components/loading/LoadingOverlay.tsx
    - apps/web/src/components/loading/LoadingOverlay.css
    - apps/web/src/vite-env.d.ts
  modified:
    - apps/web/src/components/entry/EntryPanel.tsx
    - apps/web/src/components/entry/RouteConfigStep.tsx
    - apps/web/src/stores/appStore.ts
    - apps/web/src/routes/index.tsx

key-decisions:
  - "useOptimizer hoisted to EntryPanel (not RouteConfigStep) so worker ref survives mode change to 'loading'"
  - "Worker accepts searchAreas[] (multi-area) with per-area parallel Overpass queries; merges, deduplicates, caps at MAX_TOWNS=120 by population"
  - "OSRM /table fetch has AbortSignal.timeout(8000); falls back to Haversine matrix at 70 km/h when unavailable"
  - "Overpass fetch has AbortSignal.timeout(35000) to prevent indefinite hang"
  - "Dev defaults (6 places) gated behind import.meta.env.DEV — requires vite-env.d.ts triple-slash reference"
  - "Weather batch sequential in groups of 50 (Open-Meteo practical limit)"

patterns-established:
  - "Vite module worker: new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' })"
  - "Worker lifecycle: terminate on parent hook unmount, recreate on each run() call"
  - "Progress events posted before each async step; 'complete' or 'error' terminates the sequence"
  - "AbortSignal.timeout() on all external fetches (Overpass 35s, OSRM 8s)"

requirements-completed:
  - WTHR-01
  - ALGO-01
  - ALGO-02
  - ALGO-06

duration: 40min
completed: 2026-02-28
---

# Plan 01-07: Optimizer Pipeline Integration Summary

**Web Worker pipeline wiring town-fetch → Open-Meteo weather batch → OSRM distance matrix (Haversine fallback) → optimizeRoute, with progress loading overlay**

## Performance

- **Duration:** ~40 min (executed manually across two sessions with bug fixes)
- **Completed:** 2026-02-28
- **Tasks:** 2 (+ 3 bug-fix commits)
- **Files modified:** 11

## Accomplishments
- Full optimizer pipeline runs off the main thread via a Vite module Web Worker
- Three-step loading overlay (Finding towns / Fetching weather / Optimizing route) appears during generation
- OSRM /table endpoint used for distance matrix with graceful Haversine fallback when unavailable
- 6 dev-only search area defaults pre-loaded behind `import.meta.env.DEV` to speed up testing

## Task Commits

1. **Task 1: Weather service, OSRM service, Web Worker** — `b7db098` (feat)
2. **Task 2: useOptimizer hook, LoadingOverlay, wiring** — `b7db098` (feat)
3. **Bug fix: map handler crash** — `4925845` (fix — getMap() for MapLibre handler objects)
4. **Bug fix: worker killed on mode change** — `86756d4` (fix — hoist useOptimizer to EntryPanel)

## Files Created/Modified
- `apps/web/src/workers/optimizer.worker.ts` — Pipeline orchestrator (town fetch → weather → matrix → optimize)
- `apps/web/src/services/weather.ts` — fetchWeatherBatch via Open-Meteo multi-location API
- `apps/web/src/services/osrm.ts` — fetchDistanceMatrix with Haversine fallback
- `apps/web/src/hooks/useOptimizer.ts` — Web Worker lifecycle management hook
- `apps/web/src/components/loading/LoadingOverlay.tsx` — Frosted glass progress card
- `apps/web/src/components/loading/LoadingOverlay.css` — Overlay styles with spin animation
- `apps/web/src/vite-env.d.ts` — Triple-slash Vite client types reference
- `apps/web/src/components/entry/EntryPanel.tsx` — Hoisted useOptimizer; loading state UI
- `apps/web/src/components/entry/RouteConfigStep.tsx` — Accepts onGenerate prop; removed own useOptimizer
- `apps/web/src/stores/appStore.ts` — DEV_SEARCH_AREAS defaults
- `apps/web/src/routes/index.tsx` — Mounts LoadingOverlay

## Decisions Made
- `useOptimizer` must live in `EntryPanel` (always mounted), not `RouteConfigStep` (unmounts when mode changes to `'loading'`) — otherwise the worker is terminated the instant it starts
- Worker accepts `searchAreas[]` (multi-area) rather than the plan's single `searchArea` — the store had already been extended for multi-location in Plan 06
- Overpass timeout added defensively (35 s) since public API can hang on concurrent requests

## Deviations from Plan

### Auto-fixed Issues

**1. Worker killed immediately on run**
- **Issue:** `useOptimizer` was inside `RouteConfigStep` which unmounts when mode → `'loading'`, triggering cleanup that terminated the worker
- **Fix:** Hoisted `useOptimizer` to `EntryPanel` and passed `onGenerate` prop down
- **Committed in:** `86756d4`

**2. MapRef does not proxy handler objects**
- **Issue:** `map.dragPan.disable()` threw "Cannot read properties of undefined" — `@vis.gl/react-maplibre` createRef only wraps functions, not handler objects
- **Fix:** `map.getMap()` to access native maplibre-gl Map instance before calling handlers
- **Committed in:** `4925845`

**3. Worker uses searchAreas[] not searchArea**
- **Issue:** Plan spec had single `searchArea` but store already had `searchAreas[]` from Plan 06
- **Fix:** Worker accepts `SearchAreaSpec[]`; each area queried in parallel via `Promise.all`
- No additional commit — implemented correctly from the start

---

**Total deviations:** 2 critical bugs auto-fixed (worker lifecycle, MapRef proxy gap)
**Impact on plan:** Both fixes necessary for the pipeline to function at all. No scope creep.

## Issues Encountered
- Overpass public API can be slow for concurrent requests — 35 s timeout added as safety net; Haversine fallback on OSRM ensures route calculation completes even without local OSRM Docker

## Next Phase Readiness
- Route object is written to Zustand store on success; `mode === 'results'` triggers results display (Plan 08)
- Error messages written to store on failure for display in Plan 08
- Worker correctly terminated on component unmount; no zombie workers

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-28*
