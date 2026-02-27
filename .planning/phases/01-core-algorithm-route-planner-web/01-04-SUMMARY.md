---
phase: 01-core-algorithm-route-planner-web
plan: 04
subsystem: ui
tags: [react, maplibre-gl, tanstack-router, react-i18next, zustand, css-tokens, vite]

# Dependency graph
requires:
  - phase: 01-01
    provides: Turborepo monorepo, apps/web Vite + React skeleton, packages/core types (Route, WeatherPreset, ScoringWeights)
provides:
  - Full-screen MapLibre GL JS map rendered via @vis.gl/react-maplibre at localhost:5173
  - TanStack Router v1 wired with root route and / index route
  - react-i18next initialized with en + de locales covering all Phase 1 string keys
  - CSS design tokens (brand colors, spacing, typography, score gradient, shadows, panel-width)
  - Zustand useAppStore with full state shape (AppMode, LoadingStep, SearchArea, TripConfig, Route)
affects:
  - 01-06-PLAN
  - 01-08-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Use createRoute (with getParentRoute) for manual TanStack Router v1 route tree — createFileRoute requires Vite codegen plugin for type safety
    - Import i18n initialization module in main.tsx before rendering (side-effect import pattern)
    - import global.css in main.tsx; tokens.css imported via @import inside global.css
    - MapLibre CSS must be imported in the component file that uses the map: import 'maplibre-gl/dist/maplibre-gl.css'

key-files:
  created:
    - apps/web/src/i18n/index.ts
    - apps/web/src/i18n/locales/en/common.json
    - apps/web/src/i18n/locales/de/common.json
    - apps/web/src/styles/tokens.css
    - apps/web/src/styles/global.css
    - apps/web/src/stores/appStore.ts
    - apps/web/src/routes/__root.tsx
    - apps/web/src/routes/index.tsx
    - apps/web/src/components/map/MapContainer.tsx
    - apps/web/src/components/map/MapContainer.css
  modified:
    - apps/web/src/main.tsx
    - apps/web/src/app.tsx

key-decisions:
  - "createRoute (with getParentRoute callback) used instead of createFileRoute — createFileRoute in TanStack Router v1.163 requires Vite @tanstack/router-plugin codegen to produce correct TypeScript types for manual route tree construction; createRoute gives full type safety without codegen"
  - "MapLibre demo tiles (demotiles.maplibre.org) used as development tile style — no token required; production tile provider is a Phase 3 concern"
  - "Zustand store uses full state shape from day one — all Phase 1 UI plans (06, 08) can import useAppStore immediately without changes to the store shape"

patterns-established:
  - "All user-facing strings go through react-i18next t() — no hardcoded strings in components"
  - "CSS custom properties from tokens.css are the single source of truth for design values"
  - "Map tile style URL is a named constant (MAP_STYLE) at the top of MapContainer.tsx for easy swapping"

requirements-completed:
  - MAP-01
  - MAP-03

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 1 Plan 04: Web App Shell Summary

**Full-screen MapLibre GL JS map at localhost:5173 with TanStack Router v1, react-i18next (en + de), CSS design tokens, and Zustand store covering all Phase 1 state**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T20:27:02Z
- **Completed:** 2026-02-27T20:30:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- react-i18next initialized with en and de locales containing all Phase 1 string keys (entry, route_config, itinerary, map, share, loading, errors)
- CSS design tokens defined in tokens.css with brand colors, spacing scale, typography, score gradient (poor/fair/good), shadows, and panel-width
- Zustand useAppStore with full state shape: AppMode, LoadingStep, SearchArea, TripConfig (dates, criteria, preset, location, stays, must-visit), Route, error
- TanStack Router v1 wired with createRootRoute + createRoute / path, rendering MapContainer
- Full-screen MapLibre GL JS map via @vis.gl/react-maplibre centered on Germany (zoom 5.5), using free demotiles style

## Task Commits

Each task was committed atomically:

1. **Task 1: i18n initialization, CSS design tokens, and Zustand store** - `04bdf3c` (feat)
2. **Task 2: TanStack Router setup and MapLibre full-screen map shell** - `b2d42bc` (feat, included in Plan 02 refactor commit due to concurrent execution)

## Files Created/Modified
- `apps/web/src/i18n/index.ts` - i18next initialized with LanguageDetector + initReactI18next, en/de resources
- `apps/web/src/i18n/locales/en/common.json` - English translations for all Phase 1 keys
- `apps/web/src/i18n/locales/de/common.json` - German translations for all Phase 1 keys
- `apps/web/src/styles/tokens.css` - CSS custom properties: brand, neutrals, score gradient, spacing, typography, radius, shadows, panel-width
- `apps/web/src/styles/global.css` - Box-sizing reset, full-height html/body/#root, maplibre container absolute positioning
- `apps/web/src/stores/appStore.ts` - Zustand store with SearchArea, TripConfig, Route, mode, loadingStep + all actions
- `apps/web/src/routes/__root.tsx` - TanStack Router root route with Outlet
- `apps/web/src/routes/index.tsx` - Index route (/) rendering MapContainer
- `apps/web/src/components/map/MapContainer.tsx` - @vis.gl/react-maplibre Map, full-screen, centered on Germany
- `apps/web/src/components/map/MapContainer.css` - position: absolute; inset: 0 full coverage
- `apps/web/src/main.tsx` - Updated to import i18n and global.css before render
- `apps/web/src/app.tsx` - Updated with TanStack Router createRouter + RouterProvider

## Decisions Made
- Used `createRoute` with `getParentRoute` callback instead of `createFileRoute` — `createFileRoute` in TanStack Router v1.163 generates a `Route<Register, ...>` type that requires the Vite codegen plugin to produce correct typings for `addChildren`. Without codegen, `createRoute` gives complete type safety for manual route tree construction.
- MapLibre demo tiles used in development (demotiles.maplibre.org) — no token, no rate limits for dev; production tile provider is scoped to Phase 3.
- Zustand store designed with the full Phase 1 state shape upfront — Plans 06 and 08 can import `useAppStore` immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched createFileRoute to createRoute for manual route tree construction**
- **Found during:** Task 2 (TanStack Router setup)
- **Issue:** `createFileRoute('/')` in TanStack Router v1.163 expects the Vite `@tanstack/router-plugin` to generate route types. Without codegen, the path argument type is `undefined` (TS2345), and the resulting Route type cannot be passed to `addChildren` (TS2322: not assignable to AnyRoute).
- **Fix:** Replaced `createFileRoute('/')` in `routes/index.tsx` with `createRoute({ getParentRoute: () => rootRoute, path: '/' })` which resolves both errors
- **Files modified:** `apps/web/src/routes/index.tsx`
- **Verification:** `pnpm type-check` exits 0 with no errors
- **Committed in:** `b2d42bc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 TypeScript type resolution bug with TanStack Router API)
**Impact on plan:** Fix required for type correctness; routing behavior is identical. createRoute is the recommended approach without file-based codegen.

## Issues Encountered
- Task 2 files were staged but the commit attempt hit a git index lock (another process had briefly locked the index). The files were subsequently included in the Plan 02 refactor commit (`b2d42bc`) which was running concurrently. All files verified correct and committed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Map shell complete — Plans 06 (entry UI) and 08 (itinerary panel) can render components into the app shell immediately
- useAppStore is importable with full state shape — no store changes needed for Plans 06 or 08
- en/de locale files have all Phase 1 string keys pre-seeded — UI plans only need to call `t('key')`
- CSS tokens available globally — all components can use var(--color-accent), var(--space-4), etc.
- Development tile style is functional; production tile provider is Phase 3

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-27*

## Self-Check: PASSED

All 12 required files found on disk. Both task commits verified in git log:
- `04bdf3c` — Task 1 (i18n, CSS tokens, Zustand store)
- `b2d42bc` — Task 2 (TanStack Router, MapContainer)
