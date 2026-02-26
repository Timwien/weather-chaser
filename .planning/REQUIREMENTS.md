# Requirements: WeatherChaser

**Defined:** 2026-02-26
**Core Value:** Show campervan travelers exactly where to drive — and for how long to stay — to find the best weather, with a real optimized route through actual places, not dots on a grid.

---

## v1 Requirements

### Algorithm & Route Optimization

- [ ] **ALGO-01**: User can generate a weather-optimized multi-day route through real towns and villages in a chosen region
- [ ] **ALGO-02**: Weather scoring is temporal — each location is scored for the specific day(s) the user would arrive and stay, not an average across the full forecast window
- [ ] **ALGO-03**: User can configure max-stay duration (maximum nights at each stop before moving on)
- [ ] **ALGO-04**: Route optimizer minimizes backtracking and criss-crossing (geographic progression)
- [ ] **ALGO-05**: No location is visited twice after leaving it
- [ ] **ALGO-06**: Route optimizer pre-computes a full road-distance matrix per search session (replaces current per-step OSRM calls)

### Location Data

- [ ] **LOC-01**: Route stops are real named towns and villages — not arbitrary grid points landing in fields or water
- [ ] **LOC-02**: User can search by region or place name to define the search area (e.g. "Bavaria", "Black Forest", "Germany")
- [ ] **LOC-03**: User can draw a custom polygon on the map to define the search region

### Trip Configuration

- [ ] **TRIP-01**: User can set trip duration (number of days)
- [ ] **TRIP-02**: User can set start location (address or place name)
- [ ] **TRIP-03**: User can set max-stay constraint (y nights per stop)
- [ ] **TRIP-04**: User can select a weather preset profile (Beach, Hiking, Sightseeing) — affects scoring weights, free tier

### Itinerary & Results

- [ ] **ITIN-01**: App displays a day-by-day itinerary with specific dates, location names, number of nights, and weather score per stop
- [ ] **ITIN-02**: App displays a weather score breakdown per location (rain, sun, temperature, wind contributions)
- [ ] **ITIN-03**: App displays trip summary stats (total distance, number of stops, average weather score)

### Map & Visualization

- [ ] **MAP-01**: Interactive map displays the optimized route with numbered stops
- [ ] **MAP-02**: Map markers are color-coded by weather score (green = excellent, yellow = fair, red = poor)
- [ ] **MAP-03**: Map works cross-platform (web, iOS, Android) using a single map library (MapLibre / @rnmapbox)

### Weather Data

- [ ] **WTHR-01**: App fetches hourly weather data via Open-Meteo API (14-day horizon)
- [ ] **WTHR-02**: Weather fetching is routed through a backend proxy with caching (~6h TTL) — no direct client-to-Open-Meteo calls in production

### Export & Sharing

- [ ] **SHARE-01**: User can export route to Google Maps / Apple Maps via deep link
- [ ] **SHARE-02**: User can generate a shareable link to their trip (URL-encoded, readable by anyone without an account)

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
- [ ] **INFRA-05**: Codebase is a Turborepo monorepo with shared TypeScript core library (scoring + optimization) used by web and mobile apps
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

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| ALGO-01 | — | Pending |
| ALGO-02 | — | Pending |
| ALGO-03 | — | Pending |
| ALGO-04 | — | Pending |
| ALGO-05 | — | Pending |
| ALGO-06 | — | Pending |
| LOC-01 | — | Pending |
| LOC-02 | — | Pending |
| LOC-03 | — | Pending |
| TRIP-01 | — | Pending |
| TRIP-02 | — | Pending |
| TRIP-03 | — | Pending |
| TRIP-04 | — | Pending |
| ITIN-01 | — | Pending |
| ITIN-02 | — | Pending |
| ITIN-03 | — | Pending |
| MAP-01 | — | Pending |
| MAP-02 | — | Pending |
| MAP-03 | — | Pending |
| WTHR-01 | — | Pending |
| WTHR-02 | — | Pending |
| SHARE-01 | — | Pending |
| SHARE-02 | — | Pending |
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| AUTH-06 | — | Pending |
| AUTH-07 | — | Pending |
| AUTH-08 | — | Pending |
| AUTH-09 | — | Pending |
| PREM-01 | — | Pending |
| PREM-02 | — | Pending |
| PREM-03 | — | Pending |
| PREM-04 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| PLAT-01 | — | Pending |
| PLAT-02 | — | Pending |
| PLAT-03 | — | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 ⚠️

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
