# Roadmap: WeatherChaser

## Overview

WeatherChaser is rebuilt from a static HTML/JS prototype into a production-grade cross-platform product. The rebuild proceeds in five phases that follow the product's natural dependency graph: the core algorithm and web app first (everything else depends on this being right), the Weather Finder mode second (built on the same infrastructure), a production backend with user accounts third (enabling save, share, and safe API proxying), freemium monetization fourth (requires identity from Phase 3), and native iOS/Android apps last (require a stable API contract from Phase 3). Each phase delivers a working, testable capability — no phase produces infrastructure that can only be verified by the next phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Algorithm + Route Planner Web** - Working web app with real town data, temporal weather scoring, anti-backtracking optimizer, day-by-day itinerary, and shareable trip link — no backend required
- [x] **Phase 2: Weather Finder Mode** - Second product mode: ranked best-weather locations for a given date range with map visualization and time-of-day scoring
- [ ] **Phase 3: Backend + Auth + Production Hosting** - API server with weather/Overpass/OSRM proxies and caching, user accounts (email + OAuth), saved routes, favorites, preferences, and public web hosting
- [ ] **Phase 4: Freemium + Monetization** - Stripe subscription, premium feature enforcement server-side, custom weight sliders, and clear free vs. premium UX
- [ ] **Phase 5: Native Mobile Apps** - iOS and Android apps at feature parity with web, distributed via Expo EAS through App Store and Play Store

## Phase Details

### Phase 1: Core Algorithm + Route Planner Web
**Goal**: Users can plan an optimized multi-day campervan route through real towns, see a day-by-day itinerary with weather scores, and share the trip — without creating an account
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-05, WTHR-01, LOC-01, LOC-02, LOC-03, ENTRY-01, ENTRY-02, ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05, ALGO-06, ALGO-07, TRIP-01, TRIP-02, TRIP-03, TRIP-04, ITIN-01, ITIN-02, ITIN-03, MAP-01, MAP-02, MAP-03, SHARE-01, SHARE-02
**Success Criteria** (what must be TRUE):
  1. User types a region name or draws a polygon, sets trip duration, start location, and max-stay, then receives a route through named real towns (not grid coordinates)
  2. The day-by-day itinerary shows specific dates, location names, nights per stop, and a weather score — and each stop's score reflects the weather on the specific day(s) the user would be there
  3. The route on the map follows geographic progression — it does not criss-cross or revisit locations, and numbered stops match the itinerary order
  4. User can export the route to Google Maps or Apple Maps via a single tap, or copy a shareable link that anyone can open without an account
  5. User can designate a must-visit town and the optimizer includes it as a stop in the generated route
**Plans**: 10 plans

Plans:
- [x] 01-01-PLAN.md — Turborepo monorepo scaffold (packages/core skeleton + apps/web Vite+React skeleton)
- [x] 01-02-PLAN.md — TDD: Temporal weather scoring module (scoreLocation + PRESETS in packages/core)
- [x] 01-03-PLAN.md — TDD: Route optimizer (nearest-neighbor + 2-opt + assignStops in packages/core)
- [x] 01-04-PLAN.md — Web app shell (MapLibre full-screen map, TanStack Router, react-i18next, Zustand store)
- [x] 01-05-PLAN.md — Location services (Nominatim geocoding, Overpass town fetching, map polygon drawing)
- [x] 01-06-PLAN.md — Entry panel UI (shared config: dates + location + criteria + two CTAs + route-config second step)
- [x] 01-07-PLAN.md — Optimizer pipeline integration (Web Worker, weather fetch, OSRM matrix, loading overlay)
- [x] 01-08-PLAN.md — Results display (itinerary timeline, score-colored map markers, per-segment route line)
- [x] 01-09-PLAN.md — Share + export (Google Maps, Apple Maps deep links, shareable URL + /trip restore route)
- [x] 01-10-PLAN.md — End-to-end verification checkpoint (all 5 phase success criteria)

### Phase 2: Weather Finder Mode
**Goal**: Users can ask "where is the weather best near me this weekend?" and receive a ranked list of real locations with color-coded map markers, filterable by date range, distance, time of day, and activity preset
**Depends on**: Phase 1
**Requirements**: FIND-01, FIND-02, FIND-03, FIND-04, FIND-05, FIND-06
**Success Criteria** (what must be TRUE):
  1. User selects Weather Finder from the shared entry point, picks a date or date range (up to 14 days out), and receives a ranked list of named locations with weather scores
  2. The same locations appear simultaneously on the map as color-coded markers (green = best, yellow = fair, red = poor) that match the ranked list
  3. User can set a maximum distance constraint and the results update to show only locations within that radius
  4. User can toggle between morning and afternoon scoring and the rankings and scores update immediately without re-fetching weather data
  5. User can select a preset profile (Beach, Hiking, Sightseeing) and the scores recalculate using that profile's weights
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Store finder slice + Overpass radius query + hourly weather service
- [x] 02-02-PLAN.md — Finder Web Worker + useFinder hook
- [x] 02-03-PLAN.md — WeatherFinderStep entry UI + FinderFilterBar + FinderEmptyState + EntryPanel patch
- [x] 02-04-PLAN.md — FinderResultRow + WeatherFinderPanel (ranked list + sort buttons + useMemo re-scoring)
- [x] 02-05-PLAN.md — FinderMarkers (map) + MapContainer finder integration
- [x] 02-06-PLAN.md — routes/index.tsx wiring + end-to-end verification checkpoint

### Phase 3: Backend + Auth + Production Hosting
**Goal**: Users can create accounts, save routes, and favorite locations — and the app runs safely in production with all public API dependencies proxied and cached server-side
**Depends on**: Phase 1
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, WTHR-02, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, PLAT-01
**Success Criteria** (what must be TRUE):
  1. Guest users (no account) can plan routes and use Weather Finder with full functionality — the app never requires login to generate or view results
  2. User can create an account with email/password, sign in with Google, or sign in with Apple, and stay logged in across app restarts
  3. Logged-in user can save a named route, view it again later, and favorite a location — and these persist after closing the app
  4. The web app is publicly accessible at a stable URL, all weather and location API calls are routed through the backend proxy, and no client-to-Nominatim/OSRM-demo/Overpass-public calls occur in production
  5. User data (accounts, saved routes, favorites) is stored in an EU-region database and the app satisfies GDPR requirements for the German market
**Plans**: TBD

### Phase 4: Freemium + Monetization
**Goal**: The freemium tier split is enforced server-side with a working Stripe subscription flow, premium features are gated behind a paywall, and users can upgrade from within the app
**Depends on**: Phase 3
**Requirements**: AUTH-08, AUTH-09, PREM-01, PREM-02, PREM-03, PREM-04
**Success Criteria** (what must be TRUE):
  1. A guest or free-tier user can plan routes and use all core features with no trip-length limit — the app does not prompt for login or payment to generate a route
  2. When a free-tier user attempts to use custom score weight sliders, the app shows an upgrade prompt and a premium endpoint returns 403 — bypassing the UI does not grant access
  3. A user who subscribes via Stripe gains access to custom weight sliders immediately after payment confirmation, without needing to log out and back in
  4. Save and favorite actions for a guest user trigger a signup prompt, not a paywall — the account is free, only the action requires registration
**Plans**: TBD

### Phase 5: Native Mobile Apps
**Goal**: Users can install WeatherChaser on iOS and Android and use all core route planning and weather finding features natively, with maps and location services working as expected on each platform
**Depends on**: Phase 3
**Requirements**: PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. User can install the iOS app from the App Store and the Android app from the Play Store, and both apps launch, connect to the production backend, and support login with Apple (iOS) and Google (both)
  2. User can plan a route and view the optimized itinerary and map on a mid-range Android device without performance degradation or map rendering failures
  3. The mobile apps support the same core features as the web app — route planning, Weather Finder, save/favorite (with account), and export to Google Maps / Apple Maps — without requiring a separate code path for mobile-specific behavior
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Algorithm + Route Planner Web | 10/10 | Complete | 2026-03-01 |
| 2. Weather Finder Mode | 6/6 | Complete | 2026-03-02 |
| 3. Backend + Auth + Production Hosting | 0/TBD | Not started | - |
| 4. Freemium + Monetization | 0/TBD | Not started | - |
| 5. Native Mobile Apps | 0/TBD | Not started | - |
