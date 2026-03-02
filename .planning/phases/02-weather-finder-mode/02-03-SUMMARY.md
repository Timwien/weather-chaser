---
phase: 02-weather-finder-mode
plan: "03"
subsystem: ui
tags: [react, zustand, nominatim, geolocation, i18n, css-variables]

# Dependency graph
requires:
  - phase: 02-weather-finder-mode
    plan: "01"
    provides: finder data fetching service (fetchTownsInRadius, weatherHourly)
  - phase: 02-weather-finder-mode
    plan: "02"
    provides: finder.worker.ts, useFinder hook (run(), finderLoading, setFinderData)
provides:
  - WeatherFinderStep component — location input + GPS + search trigger
  - FinderFilterBar component — sticky filter row (distance slider, time-of-day toggle, preset selector)
  - FinderEmptyState component — empty state with expand-radius CTA
  - EntryPanel.tsx patched to render WeatherFinderStep when mode='weather-finder'
  - i18n 'finder' namespace in de and en common.json (21 keys each)
affects: [02-04-PLAN.md, 02-05-PLAN.md, WeatherFinderPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Nominatim autocomplete via debounced searchPlace() with onMouseDown to prevent blur-before-click race
    - GPS via navigator.geolocation.getCurrentPosition writing directly to finderConfig (no intermediate state)
    - Filter bar uses sticky positioning so it stays pinned as results list scrolls
    - setFinderConfig partial updates on every control change — no search re-trigger (re-filtering in memory)
    - Expand-radius CTA in empty state writes to store, re-filters existing in-memory towns

key-files:
  created:
    - apps/web/src/components/entry/WeatherFinderStep.tsx
    - apps/web/src/components/entry/WeatherFinderStep.css
    - apps/web/src/components/finder/FinderFilterBar.tsx
    - apps/web/src/components/finder/FinderFilterBar.css
    - apps/web/src/components/finder/FinderEmptyState.tsx
  modified:
    - apps/web/src/components/entry/EntryPanel.tsx
    - apps/web/src/i18n/locales/de/common.json
    - apps/web/src/i18n/locales/en/common.json

key-decisions:
  - "searchPlace() used instead of searchNominatim() — plan referenced a non-existent export; nominatim.ts exports searchPlace() returning NominatimResult[]"
  - "onMouseDown used for suggestion selection instead of onClick — prevents input blur from closing dropdown before click fires"
  - "GPS button renders ⌖ (U+2316) via String.fromCodePoint to avoid literal special char in source"

patterns-established:
  - "Finder components directory: apps/web/src/components/finder/ — all results/filter UI lives here"
  - "Filter controls call setFinderConfig instantly (no re-fetch) — radius re-filters in-memory towns via useMemo in WeatherFinderPanel"

requirements-completed: [FIND-01, FIND-02, FIND-05, FIND-06]

# Metrics
duration: 12min
completed: 2026-03-02
---

# Phase 2 Plan 03: Weather Finder Entry UI Summary

**WeatherFinderStep (location input + GPS + search trigger), FinderFilterBar (sticky filter row), and FinderEmptyState wired to useFinder hook and appStore, replacing the EntryPanel placeholder in 2 surgical lines**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-02T07:42:15Z
- **Completed:** 2026-03-02T07:54:00Z
- **Tasks:** 2 of 2
- **Files modified:** 8

## Accomplishments

- WeatherFinderStep: Nominatim autocomplete (debounced 300ms), GPS geolocation button, search CTA calling useFinder().run() disabled until startLat set, back button resetting mode to idle
- FinderFilterBar: sticky filter row with distance slider (50–500 km, step 25), three-state time-of-day toggle (morning/full/afternoon), three-state preset selector (beach/hiking/sightseeing) — all controls call setFinderConfig instantly
- FinderEmptyState: conditional empty state with one-tap expand-radius CTA (+100 km), hidden when already at 500 km max
- EntryPanel patched with exactly 2 lines changed (import + JSX replacement) — all other lines byte-identical
- 21 i18n keys added to both de and en common.json under "finder" namespace

## Task Commits

Each task was committed atomically:

1. **Task 1: WeatherFinderStep.tsx and WeatherFinderStep.css** - `8c83ca4` (feat)
2. **Task 2: FinderFilterBar, FinderEmptyState, EntryPanel patch, i18n keys** - `20a7c37` (feat)

## Files Created/Modified

- `apps/web/src/components/entry/WeatherFinderStep.tsx` — Location input with Nominatim autocomplete, GPS button, search CTA, loading spinner, back button
- `apps/web/src/components/entry/WeatherFinderStep.css` — Styles matching EntryPanel visual language (tokens, radius-md, spacing variables)
- `apps/web/src/components/finder/FinderFilterBar.tsx` — Sticky filter bar: distance slider + time-of-day toggle + preset selector
- `apps/web/src/components/finder/FinderFilterBar.css` — Sticky positioning, toggle button active states using color-accent
- `apps/web/src/components/finder/FinderEmptyState.tsx` — Empty state with expand-radius CTA
- `apps/web/src/components/entry/EntryPanel.tsx` — 2-line patch: import WeatherFinderStep + replace placeholder div
- `apps/web/src/i18n/locales/de/common.json` — Added "finder" namespace (21 keys, German)
- `apps/web/src/i18n/locales/en/common.json` — Added "finder" namespace (21 keys, English)

## Decisions Made

- **searchPlace() not searchNominatim()**: The plan referenced `searchNominatim` from nominatim.ts but the actual export is `searchPlace()` returning `NominatimResult[]`. Used `searchPlace()` and adapted the mapping (display_name, lat, lon) — same end result. (Rule 1 auto-fix)
- **onMouseDown for suggestion selection**: Used `onMouseDown` instead of `onClick` to prevent the input blur event from firing before the click is registered, which would collapse the dropdown without triggering selection.
- **GPS icon via String.fromCodePoint**: Used `String.fromCodePoint(0x2316)` for the ⌖ crosshair symbol to avoid encoding issues with literal special characters in source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted import from searchNominatim to searchPlace**
- **Found during:** Task 1 (WeatherFinderStep.tsx creation)
- **Issue:** Plan specified `import { searchNominatim } from '../../services/nominatim.ts'` but nominatim.ts exports `searchPlace`, not `searchNominatim`
- **Fix:** Imported `searchPlace` and mapped `NominatimResult` shape (display_name, lat, lon) — same behavior, correct import
- **Files modified:** apps/web/src/components/entry/WeatherFinderStep.tsx
- **Verification:** `npx tsc --noEmit` passes zero errors
- **Committed in:** `8c83ca4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/wrong export name in plan)
**Impact on plan:** Fix required for compilation. No scope change.

## Issues Encountered

None beyond the nominatim import name mismatch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WeatherFinderStep, FinderFilterBar, FinderEmptyState all exported and ready to be composed into WeatherFinderPanel (Plan 04)
- finderConfig store slice fully wired — all filter controls writing to store, ready for results ranking/display
- i18n keys (finder namespace) complete for both locales — Plans 04/05/06 can use them immediately
- `apps/web/src/components/finder/` directory established as home for all finder results UI

## Self-Check: PASSED

All 5 created files verified present on disk. Both task commits (8c83ca4, 20a7c37) confirmed in git log.

---
*Phase: 02-weather-finder-mode*
*Completed: 2026-03-02*
