---
phase: 02-weather-finder-mode
plan: "06"
subsystem: ui
tags: [react, zustand, maplibre, weather-finder, routing, integration]

# Dependency graph
requires:
  - phase: 02-weather-finder-mode
    provides: "WeatherFinderPanel, FinderFilterBar, FinderMarkers, useFinder, finder.worker — all finder components built in plans 02-01 through 02-05"
provides:
  - "routes/index.tsx wired with selectedFinderIndex state, WeatherFinderPanel, and two-way map-list selection"
  - "Finder origin reads from searchAreas[0] (the existing Wo? location) — no separate location input"
  - "Finder radius reads from searchRadiusKm (the existing Wo? radius slider) — no duplicate slider in results panel"
  - "End-to-end Weather Finder Mode: enter Wo? location, click Bestes Wetter finden, get ranked list with map markers"
affects:
  - "03-map-tiles — map passes finderResults + selectedFinderIndex props (established in this plan)"
  - "future phases reading searchAreas[0] as universal app origin"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of truth for origin: searchAreas[0] used by both route planner and weather finder — no separate finderConfig.startLat/startLng needed"
    - "Single source of truth for radius: searchRadiusKm used for Wo? radius AND finder search radius"
    - "WeatherFinderStep shows read-only origin label derived from searchAreas[0].name, not an editable input"

key-files:
  created:
    - apps/web/src/routes/index.tsx  # already existed, but now wired with finder
  modified:
    - apps/web/src/routes/index.tsx
    - apps/web/src/hooks/useFinder.ts
    - apps/web/src/components/entry/WeatherFinderStep.tsx
    - apps/web/src/components/entry/WeatherFinderStep.css
    - apps/web/src/components/finder/FinderFilterBar.tsx
    - apps/web/src/components/finder/FinderFilterBar.css
    - apps/web/src/components/finder/WeatherFinderPanel.tsx

key-decisions:
  - "Finder origin unified with route planner origin: searchAreas[0].lat/lng is the single source — removes duplicate location entry UX friction"
  - "Finder radius unified with Wo? radius slider: searchRadiusKm drives both use cases — FinderFilterBar no longer has its own distance slider"
  - "WeatherFinderStep becomes a confirmation step, not an input step: it shows the already-entered location and a CTA button"
  - "WeatherFinderPanel.tsx useMemo updated to include searchAreas and searchRadiusKm as deps so results refilter when radius slider changes"

patterns-established:
  - "Origin/radius single source: all components that need a search origin read from searchAreas[0]; all that need a radius read from searchRadiusKm"

requirements-completed:
  - FIND-01
  - FIND-02
  - FIND-03
  - FIND-04
  - FIND-05
  - FIND-06

# Metrics
duration: 30min
completed: 2026-03-02
---

# Phase 02 Plan 06: Weather Finder Integration Summary

**Full Weather Finder Mode wired end-to-end: routes/index.tsx connects WeatherFinderPanel and MapContainer with two-way selection, origin unified with Wo? location, radius unified with Wo? radius slider**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 2 (Task 1 + fix-pass before Task 2)
- **Files modified:** 7

## Accomplishments

- routes/index.tsx now renders WeatherFinderPanel when `mode === 'weather-finder' && finderTowns !== null`, with two-way selectedFinderIndex sync between list and map
- Finder origin reads from `searchAreas[0]` in both `useFinder.ts` and `WeatherFinderPanel.tsx` — no more null startLat/startLng blocking the search
- Finder radius reads from `searchRadiusKm` — the same value the Wo? radius slider writes — so moving the radius slider instantly refilters results
- WeatherFinderStep simplified to a read-only origin label + CTA button; shows a "Bitte zuerst einen Ort eingeben" message when Wo? is empty
- FinderFilterBar trimmed to time-of-day toggle + preset selector only; distance slider removed
- TypeScript: zero errors (`npx tsc --noEmit` clean)

## Task Commits

1. **Task 1: Wire finder into routes/index.tsx** - `4288cfb` (feat)
2. **Task 2 fix-pass: use searchAreas origin and searchRadiusKm** - `da0a3c8` (fix)

## Files Created/Modified

- `apps/web/src/routes/index.tsx` - Added selectedFinderIndex state, computedFinderResults, WeatherFinderPanel render logic, MapContainer finder props
- `apps/web/src/hooks/useFinder.ts` - Changed origin source from finderConfig.startLat/startLng to searchAreas[0].lat/lng; radius from searchRadiusKm
- `apps/web/src/components/entry/WeatherFinderStep.tsx` - Removed location input + GPS button; shows searchAreas[0].name as read-only label; shows "no location" message when Wo? empty
- `apps/web/src/components/entry/WeatherFinderStep.css` - Removed input/GPS/suggestions/location-row CSS; added .finder-step-location-display and .finder-step-no-location
- `apps/web/src/components/finder/FinderFilterBar.tsx` - Removed distance slider group entirely
- `apps/web/src/components/finder/FinderFilterBar.css` - Removed .finder-filter-slider and .finder-filter-slider-labels
- `apps/web/src/components/finder/WeatherFinderPanel.tsx` - Origin + radius read from searchAreas/searchRadiusKm; useMemo deps updated

## Decisions Made

- Unified the finder origin with the route planner "Wo?" location: `searchAreas[0]` is the single entry point for where the user is searching from. This removes a confusing duplicate location input step in the finder flow and means the user sets location once at the top of the app.
- Unified finder radius with the Wo? radius slider: `searchRadiusKm` is written by the existing radius slider and is now read by both the finder worker and the results panel filter. This eliminates two separate radius concepts.
- WeatherFinderStep became a "confirmation step": it reads the already-entered location and shows it as a read-only label, then provides a single CTA. If no location is set, it shows a clear instruction message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Finder search was broken because finderConfig.startLat/startLng is always null**
- **Found during:** User testing after Task 1 commit
- **Issue:** `useFinder.ts` read origin from `finderConfig.startLat/startLng` which defaults to null. The new flow never sets these values because WeatherFinderStep no longer has a separate location input. Worker received null coordinates and silently produced no results.
- **Fix:** Changed `useFinder.ts` to derive `startLat/startLng` from `searchAreas[0]` (the place set by the Wo? input). Changed `WeatherFinderPanel.tsx` to do the same for distance-filter computation.
- **Files modified:** `apps/web/src/hooks/useFinder.ts`, `apps/web/src/components/finder/WeatherFinderPanel.tsx`
- **Verification:** `npx tsc --noEmit` clean; finder worker now receives valid coordinates
- **Committed in:** `da0a3c8`

**2. [Rule 1 - Bug] FinderFilterBar distance slider was redundant and conflicting with Wo? radius**
- **Found during:** User review of WeatherFinderStep + FinderFilterBar UX
- **Issue:** `FinderFilterBar` had its own distance slider writing to `finderConfig.radiusKm`. This was disconnected from `searchRadiusKm` (the Wo? radius slider value), creating two separate radius concepts that both affected results independently and confusingly.
- **Fix:** Removed the distance slider from `FinderFilterBar`. Updated `WeatherFinderPanel.tsx` to filter by `searchRadiusKm` (the shared store value) instead of `finderConfig.radiusKm`.
- **Files modified:** `apps/web/src/components/finder/FinderFilterBar.tsx`, `apps/web/src/components/finder/FinderFilterBar.css`, `apps/web/src/components/finder/WeatherFinderPanel.tsx`
- **Verification:** `npx tsc --noEmit` clean; single radius slider at Wo? drives both the worker search and the results filter
- **Committed in:** `da0a3c8`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs; root cause: plan assumed separate finderConfig location input would be used, but user UX decision unified this with Wo?)
**Impact on plan:** Both auto-fixes essential for correct operation. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 FIND requirements (FIND-01 through FIND-06) are implemented and wired
- Phase 2 is complete
- Phase 3 (Map Tiles / Production Polish) can begin: the MapContainer already accepts finderResults + selectedFinderIndex props
- The Wo? radius slider now drives both the route planner search area and the finder search radius — any future UI polish should be aware of this dual role

---
*Phase: 02-weather-finder-mode*
*Completed: 2026-03-02*
