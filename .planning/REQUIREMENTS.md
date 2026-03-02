# Requirements: WeatherChaser

**Defined:** 2026-02-26
**Core Value:** Show travelers exactly where the best weather is — and for campervan trips, the optimal route to chase it — through real places, not dots on a grid.

---

## v1 Requirements

### Shared Entry Point

- [x] **ENTRY-01**: User defines a search area (by region/place name, radius from current location, or drawn polygon) — shared by both app modes
- [x] **ENTRY-02**: From the search area, user selects one of two modes: **Weather Finder** or **Route Planner**

---

### Mode 1: Weather Finder

*Use case: "Where is the weather best on Saturday for a hike?" or "Where should I spend next week, max 500km from here?"*

- [x] **FIND-01**: User can search for the best weather in a defined area for a specific date or date range (up to 14-day forecast horizon)
- [x] **FIND-02**: User can set a maximum distance constraint (e.g. max 500km from starting point) to filter results
- [ ] **FIND-03**: Results are displayed as a ranked list of top locations with weather scores
- [ ] **FIND-04**: Results are simultaneously displayed on a map as color-coded markers (green = best weather)
- [x] **FIND-05**: User can toggle between morning and afternoon scoring for day-trip planning (e.g. "I'll arrive Saturday morning")
- [x] **FIND-06**: User can select a weather preset profile (Beach, Hiking, Sightseeing) to adjust scoring weights — free tier

---

### Mode 2: Route Planner

*Use case: "Plan an optimal campervan route through the best weather over 10 days."*

- [x] **ALGO-01**: User can generate a weather-optimized multi-day route through real towns and villages in a chosen region
- [x] **ALGO-02**: Weather scoring is temporal — each location is scored for the specific day(s) the user would arrive and stay, not an average across the full forecast window
- [x] **ALGO-03**: User can configure max-stay duration (maximum nights at each stop before moving on)
- [x] **ALGO-04**: Route optimizer minimizes backtracking and criss-crossing (geographic progression)
- [x] **ALGO-05**: No location is visited twice after leaving it
- [x] **ALGO-06**: Route optimizer pre-computes a full road-distance matrix per search session (replaces current per-step OSRM calls)
- [x] **ALGO-07**: User can designate one or more must-visit locations that the optimizer is required to include as stops in the route

### Location Data

- [x] **LOC-01**: Route stops are real named towns and villages — not arbitrary grid points landing in fields or water
- [x] **LOC-02**: User can search by region or place name to define the search area (e.g. "Bavaria", "Black Forest", "Germany")
- [x] **LOC-03**: User can draw a custom polygon on the map to define the search region

### Trip Configuration

- [x] **TRIP-01**: User can set trip duration (number of days)
- [x] **TRIP-02**: User can set start location (address or place name)
- [x] **TRIP-03**: User can set max-stay constraint (y nights per stop)
- [x] **TRIP-04**: User can select a weather preset profile (Beach, Hiking, Sightseeing) — affects scoring weights, free tier

### Itinerary & Results

- [ ] **ITIN-01**: App displays a day-by-day itinerary with specific dates, location names, number of nights, and weather score per stop
- [ ] **ITIN-02**: App displays a weather score breakdown per location (rain, sun, temperature, wind contributions)
- [ ] **ITIN-03**: App displays trip summary stats (total distance, number of stops, average weather score)

### Map & Visualization

- [x] **MAP-01**: Interactive map displays the optimized route with numbered stops
- [ ] **MAP-02**: Map markers are color-coded by weather score (green = excellent, yellow = fair, red = poor)
- [x] **MAP-03**: Map works cross-platform (web, iOS, Android) using a single map library (MapLibre / @rnmapbox)

### Weather Data

- [x] **WTHR-01**: App fetches hourly weather data via Open-Meteo API (14-day horizon)
- [ ] **WTHR-02**: Weather fetching is routed through a backend proxy with caching (~6h TTL) — no direct client-to-Open-Meteo calls in production

### Export & Sharing

- [x] **SHARE-01**: User can export route to Google Maps / Apple Maps via deep link
- [x] **SHARE-02**: User can generate a shareable link to their trip (URL-encoded, readable by anyone without an account)

### User Accounts — Three Tiers

- [ ] **AUTH-01**: App is fully functional without login — guest users can plan routes, view results, and share links
- [ ] **AUTH-02**: User can create a free account with email/password
- [ ] **AUTH-03**: User can sign in with OAuth (Google) — Apple Sign-In required for iOS App Store
- [ ] **AUTH-04**: User session persists across app restarts (free account)
- [ ] **AUTH-05**: Free account user can save and name planned routes
- [ ] **AUTH-06**: Free account user can favorite/bookmark specific locations
- [ ] **AUTH-07**: Free account user can save weather preferences and home region
- [ ] **AUTH-08**: Premium account user can use custom weather score weight sliders (override preset profiles)
- [ ] **AUTH-09**: Premium account user can access future premium features as they are added

### Freemium & Monetization

- [ ] **PREM-01**: Core route planning is free and unlimited at launch (no trip-length gate)
- [ ] **PREM-02**: Save and favorite features require a free account (signup prompt on attempt)
- [ ] **PREM-03**: Custom score weight sliders are premium-only (paywall on attempt, upgrade prompt)
- [ ] **PREM-04**: Premium subscription managed via Stripe (web) — App Store IAP policy decision deferred to monetization phase

### Infrastructure & Platform

- [ ] **INFRA-01**: Backend API handles auth, user data persistence, weather proxy + cache, Overpass proxy + cache
- [ ] **INFRA-02**: Web app is publicly hosted (Vercel or equivalent)
- [ ] **INFRA-03**: All production API usage complies with provider ToS — no use of Nominatim/OSRM/Overpass public demo endpoints for production traffic
- [ ] **INFRA-04**: Backend hosted in EU region (GDPR compliance for EU user data)
- [x] **INFRA-05**: Codebase is a Turborepo monorepo with shared TypeScript core library (scoring + optimization) used by web and mobile apps
- [ ] **PLAT-01**: Web app is released as v1
- [ ] **PLAT-02**: Native iOS app is released as v1 (Expo / React Native)
- [ ] **PLAT-03**: Native Android app is released as v1 (Expo / React Native)

---

## v2 Requirements

### Location Enrichment

- **LOC-V2-01**: Route stops include campsite/parking overlay (Park4Night or similar data source)
- **LOC-V2-02**: Locations show points of interest relevant to van lifers (fuel, water, waste disposal)

### Weather Intelligence

- **WTHR-V2-01**: Historical climate confidence overlay ("this region is usually sunny in May" — 5-year average)
- **WTHR-V2-02**: Dynamic re-routing suggestions when forecast changes significantly for an active trip

### Export

- **EXP-V2-01**: Export route as GPX file (for navigation apps)
- **EXP-V2-02**: Export route as PDF itinerary (printable day-by-day plan)

### Planning Tools

- **PLAN-V2-01**: Route comparison — user can view two planned routes side by side
- **PLAN-V2-02**: Trip history — user can view previously generated routes

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Turn-by-turn navigation | Google/Apple Maps do this better; WeatherChaser deep-links to them |
| Campsite booking / reservations | Requires data partnerships and payment infrastructure; out of scope |
| Social feed / user-generated content | Distraction from core; Park4Night owns EU camping UGC |
| Real-time traffic routing | Irrelevant for multi-day planning; navigation app territory |
| Hotel / accommodation search | WeatherChaser is campervan-specific |
| Offline map tile downloads | Storage and licensing complexity; out of scope |
| Full internationalization (>2 languages) | German + English covers launch market; expand later |
| Collaboration / shared editing | Very high complexity; future milestone |
| AI chat assistant | Algorithm IS the intelligence; don't add an LLM chat layer |
| Global launch (non-EU) | Germany/EU first; global expansion based on traction |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENTRY-01 | Phase 1 | Complete |
| ENTRY-02 | Phase 1 | Complete |
| ALGO-01 | Phase 1 | Complete |
| ALGO-02 | Phase 1 | Complete |
| ALGO-03 | Phase 1 | Complete |
| ALGO-04 | Phase 1 | Complete |
| ALGO-05 | Phase 1 | Complete |
| ALGO-06 | Phase 1 | Complete |
| ALGO-07 | Phase 1 | Complete |
| LOC-01 | Phase 1 | Complete |
| LOC-02 | Phase 1 | Complete |
| LOC-03 | Phase 1 | Complete |
| TRIP-01 | Phase 1 | Complete |
| TRIP-02 | Phase 1 | Complete |
| TRIP-03 | Phase 1 | Complete |
| TRIP-04 | Phase 1 | Complete |
| ITIN-01 | Phase 1 | Pending |
| ITIN-02 | Phase 1 | Pending |
| ITIN-03 | Phase 1 | Pending |
| MAP-01 | Phase 1 | Complete |
| MAP-02 | Phase 1 | Pending |
| MAP-03 | Phase 1 | Complete |
| WTHR-01 | Phase 1 | Complete |
| SHARE-01 | Phase 1 | Complete |
| SHARE-02 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| FIND-01 | Phase 2 | Complete |
| FIND-02 | Phase 2 | Complete |
| FIND-03 | Phase 2 | Pending |
| FIND-04 | Phase 2 | Pending |
| FIND-05 | Phase 2 | Complete |
| FIND-06 | Phase 2 | Complete |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| AUTH-05 | Phase 3 | Pending |
| AUTH-06 | Phase 3 | Pending |
| AUTH-07 | Phase 3 | Pending |
| WTHR-02 | Phase 3 | Pending |
| INFRA-01 | Phase 3 | Pending |
| INFRA-02 | Phase 3 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 3 | Pending |
| PLAT-01 | Phase 3 | Pending |
| AUTH-08 | Phase 4 | Pending |
| AUTH-09 | Phase 4 | Pending |
| PREM-01 | Phase 4 | Pending |
| PREM-02 | Phase 4 | Pending |
| PREM-03 | Phase 4 | Pending |
| PREM-04 | Phase 4 | Pending |
| PLAT-02 | Phase 5 | Pending |
| PLAT-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 — Traceability populated after roadmap creation*
