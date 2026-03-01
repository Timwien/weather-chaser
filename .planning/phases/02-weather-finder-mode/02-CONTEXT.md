# Phase 2: Weather Finder Mode - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Weather Finder Mode: users ask "where is the best weather near me?" and receive a ranked list of real locations with color-coded map markers, filterable by date range, distance, time of day, and activity preset.

**CRITICAL:** The entry panel, date picker, location input, and "Was ist dir wichtig?" buttons (preset/criteria) already exist from Phase 1. Phase 2 adds the Weather Finder flow on top of the existing UI shell — nothing in the shared entry panel is rebuilt or changed. The researcher and planner MUST inspect what Phase 1 built before writing any tasks.

</domain>

<decisions>
## Implementation Decisions

### Results layout
- Compact rows matching the existing itinerary/route-planner design style
- Each row shows: rank, town name, overall score, plus individual metric values (sun hours, temp, precip) — matching the density of Phase 1 itinerary rows
- Sortable by overall score AND by individual criteria (sun hours, temperature, precipitation) via sort buttons above the list
- The currently active sort criterion is highlighted (bold or similar visual indicator)
- Top 10 results shown
- Empty state: "No locations found. Try increasing your radius." with a one-tap action to expand the radius

### Entry & search flow
- Two mode buttons already exist from Phase 1 — Weather Finder button is already wired; Phase 2 implements the panel/flow behind it
- Weather Finder entry panel requires only: start location + date range — distance and preset use default values set at launch
- Start location accepts both: text input (reuse existing location field) AND a "Use my location" GPS button
- Default values on first load: 200 km radius, Sightseeing preset
- Date picker, location input, and "Was ist dir wichtig?" buttons from Phase 1 MUST NOT be changed — Phase 2 builds on top of them without modification

### Map–list interaction
- Two-way selection: clicking a list row pans the map and highlights the matching marker; clicking a map marker scrolls the list and highlights the matching row
- When results first load, the map auto-fits its bounds to show all result markers
- Markers display color (green = best, yellow = fair, red = poor) + score value as a visible label on the marker

### Filter controls
- Filter row is pinned above the ranked list and remains visible while scrolling
- All filter changes (distance, time of day, preset) update results instantly and reactively — no apply/refresh button
- Time-of-day toggle has three states: Morning / Afternoon / Full day
- Distance filter is a slider (range approx. 50–500 km)
- Preset filter: Beach / Hiking / Sightseeing selector (matches existing "Was ist dir wichtig?" options)

### Claude's Discretion
- Exact color score thresholds for green/yellow/red (e.g. 70+ = green, 40–70 = yellow, <40 = red)
- Loading skeleton/spinner design during weather fetch
- Exact slider step values and snap behavior for distance filter
- Error state handling for network failures and API errors

</decisions>

<specifics>
## Specific Ideas

- "Check what has been done in phase 1 before executing phase 2" — researcher must read existing entry panel, store, and routing code before planning anything
- Sort buttons should highlight the active sort criterion (bold or similar) — not just change the order silently
- The overall visual language should match the existing route planner results (itinerary rows, teal accent, same spacing)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-weather-finder-mode*
*Context gathered: 2026-03-01*
