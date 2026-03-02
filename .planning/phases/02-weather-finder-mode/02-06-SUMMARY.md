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
  - "Finder supports three modes: around (single place + radius), polygon (drawn area), multi-place (score entered places directly)"
  - "Finder radius reads from searchRadiusKm (the existing Wo? radius slider) — no duplicate slider in results panel"
  - "End-to-end Weather Finder Mode: enter Wo? location, click Bestes Wetter finden, get ranked list with map markers"
affects:
  - "03-map-tiles — map passes finderResults + selectedFinderIndex props (established in this plan)"
  - "future phases reading searchAreas as universal app search context"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three finder modes from searchAreas shape: 0=error, 1 polygon=polygon mode, 1 place=around mode, >1=multi-place (no Overpass)"
    - "Single source of truth for radius: searchRadiusKm used for Wo? radius AND finder search radius"
    - "WeatherFinderStep is a bare CTA step — no location display; helper text only when searchAreas empty"
    - "Continuous hsl score gradient (0=red, 120=green) used everywhere: FinderMarkers, FinderResultRow rank bubble, score value"
    - "Day picker in FinderFilterBar: Ø Alle Tage + one button per trip day; selectedDay drives sliceHoursByDays in panel"

key-files:
  created:
    - apps/web/src/routes/index.tsx  # already existed, but now wired with finder
  modified:
    - apps/web/src/routes/index.tsx
    - apps/web/src/stores/appStore.ts
    - apps/web/src/hooks/useFinder.ts
    - apps/web/src/workers/finder.worker.ts
    - apps/web/src/components/entry/WeatherFinderStep.tsx
    - apps/web/src/components/entry/WeatherFinderStep.css
    - apps/web/src/components/finder/FinderFilterBar.tsx
    - apps/web/src/components/finder/FinderFilterBar.css
    - apps/web/src/components/finder/FinderResultRow.tsx
    - apps/web/src/components/finder/WeatherFinderPanel.tsx
    - apps/web/src/components/map/FinderMarkers.tsx
    - apps/web/src/i18n/locales/de/common.json
    - apps/web/src/i18n/locales/en/common.json

key-decisions:
  - "Finder origin unified with route planner origin: searchAreas drives mode detection — 1 place = around, polygon = polygon, >1 = multi-place"
  - "Finder radius unified with Wo? radius slider: searchRadiusKm drives both use cases — FinderFilterBar no longer has its own distance slider"
  - "WeatherFinderStep reduced to pure CTA step with no location display — location is already visible in the Wo? section above"
  - "Continuous hsl gradient replaces 3-band color coding throughout finder — matches StopMarkers visual language"
  - "selectedDay: 'all' | ISOstring in FinderConfig drives per-day filtering without re-fetching weather data"
  - "Evening time window is 17:00–21:59 (not 12–17 afternoon); afternoon option removed"
  - "Multi-place mode skips Overpass entirely and skips distance filter in panel — all entered places scored directly"

patterns-established:
  - "Origin/radius single source: all components that need a search origin read from searchAreas; all that need a radius read from searchRadiusKm"
  - "Continuous score gradient: scoreColor(score) = hsl((score/100)*120, 65%, 45%) — zero hardcoded CSS vars for score bands"

requirements-completed:
  - FIND-01
  - FIND-02
  - FIND-03
  - FIND-04
  - FIND-05
  - FIND-06

# Metrics
duration: 30min + post-verification fix pass
completed: 2026-03-02
---

# Phase 02 Plan 06: Weather Finder Integration Summary

**Full Weather Finder Mode wired end-to-end: three input modes (around/polygon/multi-place), continuous score gradient, day picker, wind KPI, corrected sunshine hours**

## Performance

- **Duration:** ~30 min (original) + fix pass (post human verification)
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 2 original + 7-fix verification pass
- **Files modified:** 13

## Accomplishments

### Original plan (commits 4288cfb, da0a3c8)
- routes/index.tsx renders WeatherFinderPanel when `mode === 'weather-finder' && finderTowns !== null`, with two-way selectedFinderIndex sync between list and map
- Finder origin reads from `searchAreas[0]` in both `useFinder.ts` and `WeatherFinderPanel.tsx`
- Finder radius reads from `searchRadiusKm` — moves the radius slider instantly refilters results
- WeatherFinderStep simplified to CTA button only
- FinderFilterBar trimmed to time-of-day toggle + preset selector

### Post-verification fixes (commits be6b365, aaee047, 05d2bde)
- **Three finder modes:** around (single place + radius via Overpass), polygon (drawn polygon via fetchTownsInPolygon), multi-place (>1 searchAreas — scores entered places directly, skips Overpass)
- **WeatherFinderStep:** removed Startpunkt label and location display entirely; shows helper text only when searchAreas is empty
- **Continuous score gradient:** all score color displays (FinderMarkers circle background, FinderResultRow rank bubble + score value) now use `hsl((score/100)*120, 65%, 45%)` matching StopMarkers — no more discrete red/amber/green bands
- **Marker centering:** rank (#N) and score number vertically centered inside marker circle with flex column layout; rank 9px above, score 13px bold below
- **Time-of-day:** order changed to Ganzer Tag | Morgen | Abend; 'afternoon' replaced with 'evening' (17:00–21:59); default is 'full'
- **Day picker:** new row in FinderFilterBar with "Ø Alle Tage" + one button per trip day; selectedDay state in FinderConfig drives sliceHoursByDays in panel
- **Wind KPI:** windAvgKmh added to FinderResultData and displayed as 4th chip (☀/🌡/💧/💨)
- **Sunshine fix:** was averaging seconds/3600 per hour; now sums all seconds then divides by 3600 and by dayCount for true per-day hours
- **i18n:** all new keys added to de/en (finder.time.{full,morning,evening}, finder.day.{all,...}, finder.kpi.{sun,temp,precip,wind})
- TypeScript: zero errors (`npx tsc --noEmit` clean)

## Task Commits

1. **Task 1: Wire finder into routes/index.tsx** - `4288cfb` (feat)
2. **Task 2 fix-pass: use searchAreas origin and searchRadiusKm** - `da0a3c8` (fix)
3. **Fix pass: finder location modes (around/polygon/multi-place)** - `be6b365` (fix)
4. **Fix pass: continuous score gradient + marker centering** - `aaee047` (fix)
5. **Fix pass: time options, day picker, wind KPI, formatting** - `05d2bde` (fix)

## Files Created/Modified

- `apps/web/src/stores/appStore.ts` - FinderTimeOfDay: 'afternoon' → 'evening'; selectedDay added to FinderConfig
- `apps/web/src/workers/finder.worker.ts` - Three modes (around/polygon/multi-place); polygon uses fetchTownsInPolygon; multi-place skips Overpass
- `apps/web/src/hooks/useFinder.ts` - Mode detection from searchAreas; 0=error, 1 polygon, 1 place=around, >1=multi-place
- `apps/web/src/components/entry/WeatherFinderStep.tsx` - Removed Startpunkt label and location display; bare CTA with helper text
- `apps/web/src/components/entry/WeatherFinderStep.css` - Removed .finder-step-label and .finder-step-location-display
- `apps/web/src/components/map/FinderMarkers.tsx` - Continuous hsl gradient; flex column centering for rank+score
- `apps/web/src/components/finder/FinderResultRow.tsx` - Continuous gradient for rank bubble + score; windAvgKmh field + 4 KPI chips
- `apps/web/src/components/finder/FinderFilterBar.tsx` - Time order fixed; 'evening' option; day picker row with scrollable buttons
- `apps/web/src/components/finder/FinderFilterBar.css` - .finder-filter-toggle--scroll for horizontal day picker
- `apps/web/src/components/finder/WeatherFinderPanel.tsx` - filterHoursByTimeOfDay uses 'evening'; selectedDay slicing; windAvgKmh; sunshine fix; multi-place skip distance filter
- `apps/web/src/i18n/locales/de/common.json` - finder.time.*, finder.day.*, finder.kpi.*, finder.no_location
- `apps/web/src/i18n/locales/en/common.json` - same keys in English

## Decisions Made

- Three finder modes derived from searchAreas shape: avoids separate "mode" UI control — the shape of what the user entered naturally encodes the correct search strategy.
- Multi-place mode skips Overpass and the distance filter: the user explicitly listed the places they want compared, so no radius constraint makes sense and no new town discovery is needed.
- Continuous hsl gradient everywhere: eliminates the arbitrary 70/40 band thresholds and makes the score visual consistent with StopMarkers (route results panel).
- selectedDay stored as ISO string or 'all' in finderConfig: no re-fetch needed — sliceHoursByDays filters from the already-cached hourly data in memory.
- Evening = 17:00–21:59, not 12:00–17:00: "afternoon" was confusing; "evening" better describes the post-sunset-heat window for beach/sightseeing users.

## Deviations from Plan

### Auto-fixed Issues (original plan)

**1. [Rule 1 - Bug] Finder search was broken because finderConfig.startLat/startLng is always null**
- **Found during:** User testing after Task 1 commit
- **Fix:** `useFinder.ts` derives `startLat/startLng` from `searchAreas[0]`
- **Committed in:** `da0a3c8`

**2. [Rule 1 - Bug] FinderFilterBar distance slider was redundant and conflicting with Wo? radius**
- **Found during:** User review of WeatherFinderStep + FinderFilterBar UX
- **Fix:** Removed distance slider from FinderFilterBar; WeatherFinderPanel filters by searchRadiusKm
- **Committed in:** `da0a3c8`

### Post-verification fixes (requested after human verification)

**3. [Requested] Finder location modes — around/polygon/multi-place**
- Implemented full three-mode detection + worker dispatch
- Committed in: `be6b365`

**4. [Requested] Continuous score gradient + marker vertical centering**
- Replaced discrete 3-band color logic with hsl gradient matching StopMarkers
- Committed in: `aaee047`

**5. [Requested] Time options order/labels, day picker, wind KPI, sunshine formula fix**
- Evening 17–21h; day picker with per-day buttons; windAvgKmh; sunshine total/3600/dayCount
- Committed in: `05d2bde`

---

**Total deviations:** 2 auto-fixed + 3 post-verification (all correctness/UX fixes, no scope creep)

## Issues Encountered

None beyond documented deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 FIND requirements (FIND-01 through FIND-06) are implemented and wired
- Phase 2 is complete
- Phase 3 (Map Tiles / Production Polish) can begin
- Three finder modes are fully operational; polygon draw via TerraDraw is the existing draw tool in index.tsx
- Day picker and time filter work without any re-fetch — pure in-memory filtering on cached hourly data

---
*Phase: 02-weather-finder-mode*
*Completed: 2026-03-02*
