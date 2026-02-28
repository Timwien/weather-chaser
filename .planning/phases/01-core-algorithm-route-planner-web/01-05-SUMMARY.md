---
phase: 01-core-algorithm-route-planner-web
plan: 05
subsystem: ui
tags: [nominatim, overpass-api, osm, maplibre-gl, terradraw, drawing, geocoding, react-hooks, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Turborepo monorepo, apps/web Vite + React skeleton, packages/core types (Town)
  - phase: 01-04
    provides: MapLibre GL JS map shell, @vis.gl/react-maplibre, CSS design tokens, i18n locale files
provides:
  - Nominatim geocoding service (searchPlace, geocodeAddress, parseBbox) in apps/web/src/services/nominatim.ts
  - Overpass API town fetching (fetchTownsInArea, fetchTownsInPolygon) returning typed Town[] in apps/web/src/services/overpass.ts
  - useLocationSearch React hook — debounced 500ms search with in-memory cache in apps/web/src/hooks/useLocationSearch.ts
  - DrawingControls React component — MapLibre polygon drawing via MaplibreTerradrawControl in apps/web/src/components/map/DrawingControls.tsx
  - i18n keys for draw_area and clear_area in en and de locales
affects:
  - 01-06-PLAN
  - 01-07-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Nominatim must be called at 1 req/s max; debounce 500ms at call site (useLocationSearch enforces this)
    - Overpass queries use bbox or poly filter — city/town/village only, filter unnamed nodes before returning
    - MaplibreTerradrawControl is an IControl added via map.addControl(); use getTerraDrawInstance() to access TerraDraw for programmatic control
    - DrawingControls must be rendered inside <Map> (child element) so useMap() can resolve the MapContext via MapProvider

key-files:
  created:
    - apps/web/src/services/nominatim.ts
    - apps/web/src/services/overpass.ts
    - apps/web/src/hooks/useLocationSearch.ts
    - apps/web/src/components/map/DrawingControls.tsx
  modified:
    - apps/web/src/i18n/locales/en/common.json
    - apps/web/src/i18n/locales/de/common.json

key-decisions:
  - "MaplibreTerradrawControl (IControl) used instead of fictional MaplibreGlTerradraw — the package exports MaplibreTerradrawControl which implements the MapLibre IControl interface; drawing is activated programmatically via getTerraDrawInstance().setMode('polygon') on the TerraDraw instance"
  - "useMap() returns { current?: MapRef } not { map: MapRef } — destructure as const { current: map } = useMap() to get the enclosing Map component's MapRef"
  - "TerraDraw finish event fires with (id: FeatureId, context: { action: Actions; mode: string }) — filter by context.action === 'draw' to distinguish new polygon completion from edits"
  - "Phase 1 uses public overpass-api.de and nominatim.openstreetmap.org directly — Phase 3 adds server-side proxy for production rate limiting and User-Agent compliance"

patterns-established:
  - "Service modules in apps/web/src/services/ are pure async functions with no React dependencies — usable from Web Workers (Plan 07)"
  - "Hooks in apps/web/src/hooks/ wrap services with React state and side effects (debouncing, caching)"

requirements-completed:
  - LOC-01
  - LOC-02
  - LOC-03
  - ENTRY-01

# Metrics
duration: 15min
completed: 2026-02-28
---

# Phase 1 Plan 05: Location Services and Map Drawing Summary

**Nominatim geocoding, Overpass API town fetching (bbox + polygon), and MapLibre polygon drawing via MaplibreTerradrawControl — all typed and ready for Plans 06 and 07**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-28T07:13:21Z
- **Completed:** 2026-02-28T07:28:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Nominatim geocoding service with `searchPlace`, `geocodeAddress`, `parseBbox` — typed `NominatimResult` and `BoundingBox` interfaces
- Overpass API service fetching city/town/village nodes by bbox or polygon, returning typed `Town[]` with unnamed nodes filtered out
- `useLocationSearch` hook with 500ms debounce, in-memory module-level cache, and loading/error state
- `DrawingControls` component using the actual `MaplibreTerradrawControl` IControl API — "Draw area" / "Clear area" buttons, polygon completion callback, cleanup on unmount
- i18n keys `entry.draw_area` and `entry.clear_area` added to en and de locale files

## Task Commits

Each task was committed atomically:

1. **Task 1: Nominatim service (nominatim.ts)** - `40a13d2` (feat)
2. **Task 1: Overpass service + useLocationSearch hook** - `64f8c89` (feat)
3. **Task 2: DrawingControls component + i18n keys** - `2bc9a93` (feat)

## Files Created/Modified
- `apps/web/src/services/nominatim.ts` - `searchPlace`, `geocodeAddress`, `parseBbox`; `NominatimResult` and `BoundingBox` types
- `apps/web/src/services/overpass.ts` - `fetchTownsInArea(bbox)` and `fetchTownsInPolygon(polygon)` returning `Town[]`; filters unnamed nodes
- `apps/web/src/hooks/useLocationSearch.ts` - debounced Nominatim search hook with in-memory cache, loading state, error state
- `apps/web/src/components/map/DrawingControls.tsx` - polygon drawing via `MaplibreTerradrawControl`; activates drawing on button click; fires `onPolygonComplete` callback; cleans up via `map.removeControl` on unmount
- `apps/web/src/i18n/locales/en/common.json` - added `entry.draw_area: "Draw area"` and `entry.clear_area: "Clear area"`
- `apps/web/src/i18n/locales/de/common.json` - added `entry.draw_area: "Gebiet zeichnen"` and `entry.clear_area: "Gebiet löschen"`

## Decisions Made
- `MaplibreTerradrawControl` used instead of the plan's fictional `MaplibreGlTerradraw` class — the actual package `@watergis/maplibre-gl-terradraw@1.12.1` exports `MaplibreTerradrawControl` (implementing MapLibre's `IControl` interface). Drawing is activated programmatically via `getTerraDrawInstance().setMode('polygon')` rather than a `.start()` + `.changeMode()` API.
- `useMap()` destructured as `const { current: map } = useMap()` — the hook returns `{ current?: MapRef, [id: string]: MapRef }` not `{ map: MapRef }`.
- TerraDraw `finish` event uses `context.action === 'draw'` guard to differentiate new polygon completion from coordinate edits (drag, insert midpoint, etc.).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected fictional terradraw API to actual MaplibreTerradrawControl IControl API**
- **Found during:** Task 2 (DrawingControls component)
- **Issue:** Plan referenced `MaplibreGlTerradraw` class with `.start()`, `.changeMode()`, `.getFeaturesAsGeoJSON()`, and `on('finish', ...)` — none of these exist. The package exports `MaplibreTerradrawControl` which is an `IControl` added via `map.addControl()`. The underlying `TerraDraw` instance is accessed via `getTerraDrawInstance()`.
- **Fix:** Implemented `DrawingControls` using `MaplibreTerradrawControl`, `map.addControl(control)`, `control.getTerraDrawInstance()`, `draw.setMode('polygon')`, `draw.on('finish', ...)`, `draw.getSnapshot()`, and `draw.removeFeatures(ids)`.
- **Files modified:** `apps/web/src/components/map/DrawingControls.tsx`
- **Verification:** TypeScript types verified against dist/types/controls/MaplibreTerradrawControl.d.ts and terra-draw terra-draw.d.ts
- **Committed in:** `2bc9a93` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed useMap() destructuring to { current: map } instead of { map }**
- **Found during:** Task 2 (DrawingControls component)
- **Issue:** `const { map } = useMap()` returns `undefined` — the hook returns `{ current?: MapRef }` not `{ map: MapRef }`. Component would silently fail to initialize.
- **Fix:** Changed to `const { current: map } = useMap()`
- **Files modified:** `apps/web/src/components/map/DrawingControls.tsx`
- **Verification:** Matches use-map.js source: `return { ...maps, current: currentMap?.map }`
- **Committed in:** `2bc9a93` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — API mismatch between plan pseudocode and actual library)
**Impact on plan:** Both fixes required for functionality. Contract is preserved: button activates drawing, polygon coordinates returned via callback, cleanup on unmount.

## Issues Encountered
- Task 1 was committed as two separate git commits (40a13d2 and 64f8c89) due to gsd-tools commit being called with nominatim.ts first. Both commits are part of Task 1 and contain the complete Task 1 implementation.

## User Setup Required
None - no external service configuration required. Phase 1 uses public Nominatim and Overpass API endpoints directly.

## Next Phase Readiness
- `searchPlace`, `geocodeAddress`, `parseBbox` ready for Plan 06 (entry panel location search)
- `useLocationSearch` hook ready for Plan 06 (autocomplete input)
- `fetchTownsInArea`, `fetchTownsInPolygon` ready for Plan 07 (Web Worker town fetching)
- `DrawingControls` ready to be rendered inside `<Map>` in MapContainer for Plan 06 polygon area selection
- All service modules are pure async functions with no React deps — importable from Web Worker context in Plan 07

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-28*

## Self-Check: PASSED

All 4 required files found on disk:
- FOUND: apps/web/src/services/nominatim.ts
- FOUND: apps/web/src/services/overpass.ts
- FOUND: apps/web/src/hooks/useLocationSearch.ts
- FOUND: apps/web/src/components/map/DrawingControls.tsx

All task commits verified in git log:
- `40a13d2` — Task 1 nominatim.ts (feat(01-05): test)
- `64f8c89` — Task 1 overpass.ts + useLocationSearch.ts
- `2bc9a93` — Task 2 DrawingControls.tsx + i18n keys
