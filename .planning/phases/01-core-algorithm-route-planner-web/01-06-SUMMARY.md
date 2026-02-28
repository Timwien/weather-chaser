---
phase: 01-core-algorithm-route-planner-web
plan: 06
subsystem: ui
tags: [react, zustand, maplibre, i18n, css, date-picker, design-system]

# Dependency graph
requires:
  - phase: 01-core-algorithm-route-planner-web
    provides: MapContainer, DrawingControls, appStore, useLocationSearch, Nominatim service
provides:
  - Floating frosted-glass entry panel overlaid on full-screen map
  - Date range picker: single-button trigger with 2-month calendar popover
  - Multi-location input: tag chips, radius slider (single-place), Pick-on-map stub
  - Criteria multi-select (sunshine, rain, warmth, wind)
  - Route config second step (start location, duration, max-stay, presets, must-visit)
  - Premium petrol teal design tokens + Inter font
  - CartoDB Positron GL tile style (Google Maps-like)
  - Multi-area store (searchAreas[] + addSearchArea/removeSearchArea/clearSearchAreas)
affects:
  - "01-07: optimizer integration reads searchAreas from store"
  - "01-08: mobile tabs — entry panel currently hidden on <768px"

# Tech tracking
tech-stack:
  added:
    - "Inter (Google Fonts) — loaded via @import in tokens.css"
    - "CartoDB Positron GL — https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
  patterns:
    - "Frosted glass panel: backdrop-filter blur(20px) + rgba(255,255,255,0.82) background"
    - "Calendar popover built from scratch: 7-column CSS grid, range highlight with drp-day--cap/range classes"
    - "Multi-tag pattern: searchAreas[] array in store; addSearchArea/removeSearchArea actions"
    - "Radius slider: snap to discrete values [10,25,50,100,150,200,300,500] via index mapping"

key-files:
  created: []
  modified:
    - apps/web/src/styles/tokens.css
    - apps/web/src/styles/global.css
    - apps/web/src/components/entry/EntryPanel.css
    - apps/web/src/components/entry/EntryPanel.tsx
    - apps/web/src/components/entry/DateRangePicker.tsx
    - apps/web/src/components/entry/LocationInput.tsx
    - apps/web/src/components/map/MapContainer.tsx
    - apps/web/src/stores/appStore.ts
    - apps/web/src/i18n/locales/en/common.json
    - apps/web/src/i18n/locales/de/common.json

key-decisions:
  - "Petrol teal #0E7490 chosen over turquoise (#1B6B7B) — Cyan-700 reads as premium without being too dark"
  - "Inter loaded via Google Fonts @import in tokens.css — no build step, simple CDN solution for Phase 1"
  - "Calendar popover built custom (no library) — avoids dependency for a straightforward 2-month grid; range selection state managed locally in DateRangePicker"
  - "searchAreas[] array added to store alongside legacy searchArea — draw callbacks in routes/index.tsx still use legacy; plan 07 will migrate"
  - "CartoDB Positron GL replaces demotiles.maplibre.org — free, no API key, clean Google Maps aesthetic"
  - "Radius slider snaps to [10,25,50,100,150,200,300,500]km steps — avoids arbitrary values, covers practical range"

patterns-established:
  - "CSS var(--glass-bg) + var(--glass-blur) tokens centralize frosted glass values — reuse in modals/popovers"
  - "drp-day--cap / drp-day--range CSS classes for calendar day states — extend with drp-day--today etc. in future"
  - "loc-tag chip pattern for multi-select place chips — reuse in must-visit and other multi-tag UIs"

requirements-completed:
  - ENTRY-01
  - ENTRY-02
  - TRIP-01
  - TRIP-02
  - TRIP-03
  - TRIP-04
  - ALGO-03
  - ALGO-07

# Metrics
duration: 120min
completed: 2026-02-28
---

# Phase 1 Plan 06: Entry Panel UI Summary

**Frosted-glass floating config panel with petrol teal design system, 2-month date range picker, multi-location tag input with radius slider, and CartoDB Positron map tiles**

## Performance

- **Duration:** ~120 min (including human-verify checkpoint and user feedback round)
- **Started:** 2026-02-28
- **Completed:** 2026-02-28
- **Tasks:** 3 (2 original + 1 user-feedback iteration)
- **Files modified:** 10

## Accomplishments

- Replaced flat white rectangle panel with premium frosted-glass card using `backdrop-filter: blur(20px)`, rgba background, and interior shadow — floats visibly over the map
- Replaced two raw date inputs with a single "Travel dates" trigger button that opens a 2-month calendar popover with hover range preview and day selection
- Replaced single location input with multi-place tag system: type a place, select from autocomplete, it becomes a chip; radius slider (10–500 km snap steps) appears when exactly one place is tagged
- Replaced MapLibre demo tiles with CartoDB Positron GL for clean, Google Maps-like base map (free, no API key)
- Switched accent color from generic blue to petrol teal (#0E7490) and loaded Inter via Google Fonts CDN
- Expanded appStore with `searchAreas[]` array and `addSearchArea`/`removeSearchArea`/`clearSearchAreas`/`setSearchRadiusKm` actions

## Task Commits

1. **Task 1: Date picker, location input, criteria selector sub-components** - `435c27a` (feat)
2. **Task 2: EntryPanel, RouteConfigStep, route index integration** - `a7fbf38` (feat)
3. **Task 3: Apply user feedback — redesign entry panel** - `f570fce` (feat)

## Files Created/Modified

- `apps/web/src/styles/tokens.css` - Petrol teal tokens, Inter font @import, frosted glass tokens, generous radius scale
- `apps/web/src/styles/global.css` - Font smoothing added; imports tokens
- `apps/web/src/components/entry/EntryPanel.css` - Full redesign: frosted glass panel, calendar popover styles, tag chips, radius slider
- `apps/web/src/components/entry/EntryPanel.tsx` - Uses `searchAreas.length > 0` for CTA visibility (multi-area aware)
- `apps/web/src/components/entry/DateRangePicker.tsx` - Single trigger button + 2-month CalendarMonth popover with range selection
- `apps/web/src/components/entry/LocationInput.tsx` - Multi-tag location input with autocomplete, radius slider, Pick-on-map button
- `apps/web/src/components/map/MapContainer.tsx` - CartoDB Positron GL tile URL
- `apps/web/src/stores/appStore.ts` - Added SearchAreaItem union type, searchAreas[], multi-area actions
- `apps/web/src/i18n/locales/en/common.json` - Added location_placeholder, location_add, location_pick_map, location_radius_label, dates_placeholder, dates_select_end
- `apps/web/src/i18n/locales/de/common.json` - Same keys in German

## Decisions Made

- **Petrol teal #0E7490**: Cyan-700 reads as rich and premium; lighter teal options felt turquoise-bright which cheapened the UI
- **Custom calendar popover**: No date-range library added — 2-month grid with 7-column CSS grid is ~150 lines, avoids a dependency for Phase 1
- **Discrete radius steps**: [10, 25, 50, 100, 150, 200, 300, 500] km — avoids arbitrary values; slider index maps to snap values
- **Dual store (searchAreas + legacy searchArea)**: Polygon draw callbacks in `routes/index.tsx` still use legacy `setSearchArea`; full migration to `searchAreas[]` deferred to Plan 07

## Deviations from Plan

### User Feedback Round (Task 3 — post-checkpoint)

The human-verify checkpoint surfaced comprehensive design feedback. The following changes were applied as Task 3:

**1. Design system overhaul**
- Found during: Human checkpoint review
- Change: Replaced blue-600 (#2563eb) with petrol teal #0E7490; added Inter via Google Fonts; added frosted glass panel with `backdrop-filter`; increased border radius to 16–24px
- Files: tokens.css, global.css, EntryPanel.css

**2. Date picker redesign**
- Found during: Human checkpoint review
- Change: Removed two raw date inputs; built custom 2-month calendar popover with range selection
- Files: DateRangePicker.tsx, EntryPanel.css

**3. Multi-location input**
- Found during: Human checkpoint review
- Change: Replaced single text input with tag-chip multi-select; radius slider appears conditionally for single-place; Pick-on-map button stub added
- Files: LocationInput.tsx, appStore.ts, EntryPanel.css, i18n JSON files

**4. Map tile style**
- Found during: Human checkpoint review
- Change: demotiles.maplibre.org → CartoDB Positron GL
- Files: MapContainer.tsx

---

**Total deviations:** 4 (all from user feedback post-checkpoint — not auto-fix rules)
**Impact on plan:** All changes improve UX quality significantly. No functional regressions. TypeScript passes cleanly.

## Issues Encountered

None — TypeScript was clean after all changes. No runtime errors in dev server (already running on port 5173).

## User Setup Required

None — CartoDB Positron GL is free with no API key. Google Fonts loads via @import CDN.

## Next Phase Readiness

- Entry panel is functional and visually premium — ready for Plan 07 optimizer integration
- Plan 07 reads `searchAreas[]` from store for geocoding; also reads `tripConfig` (dates, criteria, maxStay, mustVisitNames)
- Pick-on-map button is a UI stub — Plan 07 or 08 should wire it to `DrawingControls` activation
- `searchArea` (legacy) still present in store for backward compat with polygon draw callbacks

## Self-Check: PASSED

All files present and all task commits verified:
- FOUND: apps/web/src/styles/tokens.css
- FOUND: apps/web/src/components/entry/DateRangePicker.tsx
- FOUND: apps/web/src/components/entry/LocationInput.tsx
- FOUND: apps/web/src/components/entry/EntryPanel.css
- FOUND: .planning/phases/01-core-algorithm-route-planner-web/01-06-SUMMARY.md
- FOUND commit 435c27a: feat(01-06): add DateRangePicker, LocationInput, and CriteriaSelector
- FOUND commit a7fbf38: feat(01-06): EntryPanel, RouteConfigStep, and route index integration
- FOUND commit f570fce: feat(01-06): redesign entry panel — petrol theme, date picker, multi-location, CartoDB tiles

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-28*
