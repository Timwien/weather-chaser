---
phase: 01-core-algorithm-route-planner-web
plan: 09
subsystem: ui
tags: [share, export, google-maps, apple-maps, clipboard, tanstack-router, i18n, zustand]

requires:
  - phase: 01-07
    provides: route in Zustand store (setRoute, route), tripConfig, mode === 'results'
  - phase: 01-03
    provides: Route type with stops, totalDistanceKm, totalDays, avgScore
  - phase: 01-04
    provides: TanStack Router createRoute pattern (not createFileRoute)
  - phase: 01-06
    provides: appStore with searchArea (legacy), tripConfig, setMode

provides:
  - buildGoogleMapsUrl(stops) → { url, truncated } — Google Maps deep link, max 9 waypoints
  - buildAppleMapsUrl(stops) → string — Apple Maps deep link (start→end)
  - buildShareUrl(config, route) → URL string — base64-encoded trip+route into /trip?data=
  - parseShareUrl(search) → ParsedShareData | null — decodes share URL back to config+route
  - ShareBar component — three-action share panel (Google Maps, Apple Maps, copy link)
  - ItineraryPanel component — stop list with ShareBar at bottom (stub for Plan 08 to expand)
  - /trip route — restores full results view from ?data= URL param without login

affects:
  - 01-08-results-display (may expand ItineraryPanel created here)
  - future: viral sharing mechanism

tech-stack:
  added: []
  patterns: [base64-url-encoding, tanstack-router-createRoute, clipboard-api, deep-link-construction]

key-files:
  created:
    - apps/web/src/utils/exportMaps.ts
    - apps/web/src/utils/shareUrl.ts
    - apps/web/src/components/share/ShareBar.tsx
    - apps/web/src/components/share/ShareBar.css
    - apps/web/src/components/itinerary/ItineraryPanel.tsx
    - apps/web/src/components/itinerary/ItineraryPanel.css
    - apps/web/src/routes/trip.tsx
  modified:
    - apps/web/src/app.tsx
    - apps/web/src/i18n/locales/en/common.json
    - apps/web/src/i18n/locales/de/common.json

key-decisions:
  - "createRoute (with getParentRoute) used for /trip route — consistent with index.tsx pattern; createFileRoute requires Vite codegen plugin"
  - "ItineraryPanel created as stub with ShareBar included — Plan 08 can expand it without conflict (no duplicate ShareBar import)"
  - "MapContainer used without selectedStopIndex/onStopClick in /trip — those props don't exist yet; Plan 08 will add map marker interaction"
  - "btoa(encodeURIComponent(JSON.stringify(payload))) encoding chosen — handles Unicode chars in town names correctly"
  - "Google Maps max stops = GOOGLE_MAX_WAYPOINTS + 2 = 11 total (origin + 9 waypoints + destination) — truncated flag shown in ShareBar"
  - "Apple Maps start→end only URL scheme — known limitation documented in code comment, consistent with RESEARCH.md"
  - "SharePayload v:1 versioning field ensures forward compatibility if schema evolves"

patterns-established:
  - "URL-safe share encoding: btoa(encodeURIComponent(JSON.stringify(payload))) / decodeURIComponent(atob(data))"
  - "Share route restores state via useEffect on mount — setTripConfig + setRoute + setMode('results') then UI renders"
  - "Truncation notice pattern: buildGoogleMapsUrl returns {url, truncated} — component conditionally renders notice"

requirements-completed:
  - SHARE-01
  - SHARE-02

duration: 15min
completed: 2026-02-28
---

# Phase 01 Plan 09: Share and Export Summary

**Google Maps and Apple Maps deep links, clipboard shareable URL encoding/decoding, ShareBar component, and /trip restoration route — all TypeScript-strict**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-28T19:18:09Z
- **Completed:** 2026-02-28T19:33:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Export utilities with Google Maps deep link (9-waypoint cap + truncation flag) and Apple Maps start-to-end link
- buildShareUrl/parseShareUrl roundtrip using base64+encodeURIComponent for Unicode safety
- ShareBar component with three working actions and 2-second "copied" feedback
- /trip route that restores full results view from URL params without any account
- ItineraryPanel stub with ShareBar included at bottom (ready for Plan 08 to expand)
- i18n keys for `share.google_limit` added in both en and de locales

## Task Commits

Each task committed atomically:

1. **Task 1: Export utilities and shareable URL serialization** - `084bf82` (feat)
2. **Task 2: ShareBar component and /trip route for shared link restoration** - `1f83861` (feat)

## Files Created/Modified
- `apps/web/src/utils/exportMaps.ts` — buildGoogleMapsUrl (9-waypoint cap, truncated flag) + buildAppleMapsUrl
- `apps/web/src/utils/shareUrl.ts` — buildShareUrl and parseShareUrl with SharePayload v:1 versioning
- `apps/web/src/components/share/ShareBar.tsx` — Three-action share bar reading from Zustand store
- `apps/web/src/components/share/ShareBar.css` — Panel styles using CSS custom properties
- `apps/web/src/components/itinerary/ItineraryPanel.tsx` — Stop list panel with ShareBar at bottom
- `apps/web/src/components/itinerary/ItineraryPanel.css` — Positioned panel styles
- `apps/web/src/routes/trip.tsx` — /trip route using createRoute, restores results from ?data= param
- `apps/web/src/app.tsx` — Registers tripRoute in router tree
- `apps/web/src/i18n/locales/en/common.json` — Added share.google_limit key
- `apps/web/src/i18n/locales/de/common.json` — Added share.google_limit key (German translation)

## Decisions Made
- `createRoute` (not `createFileRoute`) used for `/trip` — consistent with established codebase pattern from Plan 04
- ItineraryPanel created as stub here rather than waiting for Plan 08 — ShareBar must live somewhere; Plan 08 can expand the stop list section without any import conflict
- `btoa(encodeURIComponent(...))` encoding chosen over plain `btoa` to handle non-ASCII town names (e.g., München, Zürich) — pure btoa would throw for multi-byte characters
- MapContainer used without stop marker props in /trip page — those props don't exist yet in MapContainer; Plan 08 will add map marker interaction when it expands the results view

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used createRoute instead of createFileRoute in trip.tsx**
- **Found during:** Task 2 (trip route creation)
- **Issue:** Plan spec used `createFileRoute('/trip')` but codebase notes explicitly state codebase uses `createRoute` with `getParentRoute` — `createFileRoute` requires Vite codegen plugin for correct types
- **Fix:** Used `createRoute({ getParentRoute: () => rootRoute, path: '/trip', component: TripPage })`
- **Files modified:** apps/web/src/routes/trip.tsx
- **Verification:** TypeScript clean, consistent with index.tsx pattern
- **Committed in:** 1f83861 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Created ItineraryPanel stub**
- **Found during:** Task 2 (ShareBar integration)
- **Issue:** Plan 08 (ItineraryPanel) had not yet run; no ItineraryPanel.tsx existed; ShareBar needs a host component; /trip route also imports ItineraryPanel
- **Fix:** Created ItineraryPanel stub with stop list and ShareBar at bottom — Plan 08 can expand it without conflicts
- **Files modified:** apps/web/src/components/itinerary/ItineraryPanel.tsx, ItineraryPanel.css
- **Verification:** TypeScript clean, renders correctly when mode === 'results'
- **Committed in:** 1f83861 (Task 2 commit)

**3. [Rule 1 - Bug] Removed non-existent MapContainer props from trip.tsx**
- **Found during:** Task 2 (trip page implementation)
- **Issue:** Plan spec passed `selectedStopIndex` and `onStopClick` to MapContainer, but MapContainer only accepts `onDrawComplete` and `onDrawClear` — type error
- **Fix:** Removed non-existent props; MapContainer renders without stop markers for now (Plan 08 will add them)
- **Files modified:** apps/web/src/routes/trip.tsx
- **Verification:** TypeScript clean, no type errors
- **Committed in:** 1f83861 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug — wrong router API; 1 missing critical — host component; 1 bug — non-existent props)
**Impact on plan:** All fixes required for the code to work. No scope creep. Plan 08 can expand ItineraryPanel without any conflicts.

## Issues Encountered
- None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Share/export fully functional — ShareBar renders with Google Maps, Apple Maps, and copy-link actions
- /trip route ready to restore results from shareable URLs
- ItineraryPanel stub is ready for Plan 08 to expand with detailed stop cards, score breakdowns, etc.
- buildGoogleMapsUrl/buildAppleMapsUrl exported and ready for any future export integration
- parseShareUrl returns typed ParsedShareData — strongly typed, version-safe

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-28*
