# Phase 1: Core Algorithm + Route Planner Web - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete route planning experience as a web app — from area definition to an optimized day-by-day itinerary with weather scores — running entirely in the browser with no backend required. Includes the Turborepo monorepo foundation, the shared TypeScript core library (scoring + optimization algorithm), MapLibre map integration, and the full Route Planner UI. The shared entry point (area definition) is designed from day one to serve both Route Planner and Weather Finder (Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Design System

- Light theme with strong color accent(s) — white base, accent for CTAs and interactive elements
- No gradients (except weather score gradient), no emojis
- Icons over emoji throughout
- Localization-ready from day one: all user-facing strings use i18n keys (never hardcoded strings)
- Design should feel "fancier than Google Maps" — clean, minimal, premium — not AI-generated-looking
- Reference aesthetics: Linear, Airbnb — clean hierarchy, strong brand color, restrained use of decoration

### Entry Point (Shared by Both Modes)

- Map-first layout: full-screen map as the base, floating config panel overlaid (Google Maps pattern)
- The config panel is the **single entry point for both Route Planner and Weather Finder**
- Three setup inputs visible in the panel:
  1. **Trip date** — click opens date picker (from/to range). Special option: "Day trip" → select morning, afternoon, or full day
  2. **Location(s)** — user types one or more place names. If one place: radius selector appears. "Pick on map" option opens map interaction: select pins, draw one or more areas, or set a place + adjust radius by typing km or dragging the circle
  3. **Criteria** — user picks most important weather criteria (multi-select): sun (most), precipitation (least), temperature (warmest), wind (least), etc.
- After filling the three inputs, two CTA buttons appear: **"Find Best Route"** and **"Find Best Weather"** (exact copy TBD)
- Mode selection happens via CTAs, not tabs or toggles — the shared config comes first

### Route-Specific Config

- Route Planner extra inputs (max-stay, start point, must-visit stops) appear **after tapping "Find Best Route"** — as a second config step or expanded panel
- Claude's discretion on exact layout of this second step (inline expansion, modal, slide-in panel)

### Itinerary Display

- **Timeline / vertical flow** layout — not cards or rows
- Each stop in the timeline:
  - Day number(s) in a bubble (e.g. "Day 1–2")
  - City name only (no region/state)
  - Driving distance to next stop shown between stops in thinner/lighter text (e.g. "82km")
  - Weather score as a continuous gradient color (red → yellow → green, not fixed colors) with a score bar and breakdown (sun/rain/temp/wind icons + contribution) visible inline — no tap-to-expand needed
- Summary bar at top of itinerary: total days, total distance, avg score (compact)
- Summary stats card at bottom of itinerary: detailed breakdown

### Map ↔ List Layout

- **Desktop**: Map fills the background/majority of screen; itinerary timeline is an overlay panel on the side (left or right — Claude's discretion)
- **Mobile**: Two separate screens — itinerary is the default/first view; map is the second view (tab or button to switch)
- **Click/tap a stop on map**: popup appears on map (name + score) AND itinerary scrolls to that stop
- **Route line**: gradient line — color shifts from red to green along the route based on weather score of each segment
- **Stop markers**: numbered circles — color follows the score gradient (red for low, green for high)

### Loading States

- While optimizing: show progress steps — "Finding towns...", "Fetching weather...", "Optimizing route..." — user sees what's happening rather than a generic spinner
- Map is visible throughout (doesn't go blank during loading)

### Edge Cases

- **Too few towns / no results**: Claude decides UX — friendly message with actionable suggestion (expand radius, draw larger area)
- **All locations have poor weather**: Show results anyway with a visible warning ("Weather looks unfavorable across this region for these dates")
- **Weather data unavailable for some locations**: Claude decides — exclude silently or show with "data unavailable" indicator

### Claude's Discretion

- Exact layout of route-specific second config step (max-stay, must-visit, start point)
- Empty/error state UX details
- Exact spacing, typography scale, component-level design decisions
- Mobile map-to-itinerary transition animation
- Loading skeleton details
- Color for brand accent (primary CTA color)

</decisions>

<specifics>
## Specific Ideas

- "Similar to Google Maps but fancier" — map-first, familiar interaction model, elevated visual quality
- Weather score gradient: continuous red→yellow→green (not fixed red/yellow/green buckets) — applies to score bars, route line, and stop markers
- Timeline itinerary: day bubbles + city name + driving distance between stops — like a travel itinerary app, not a data table
- "Pick on map" area definition: supports pins, drawn areas, and radius circle (drag or type km) — flexible and powerful
- Localization keys from day one — no hardcoded strings anywhere

</specifics>

<deferred>
## Deferred Ideas

- Weather Finder results UI (ranked list + map heatmap, morning/afternoon toggle, distance filter) — Phase 2
- User accounts, save/favorite — Phase 3
- Custom weather weight sliders (premium) — Phase 4
- Native iOS/Android app UI — Phase 5

</deferred>

---

*Phase: 01-core-algorithm-route-planner-web*
*Context gathered: 2026-02-27*
