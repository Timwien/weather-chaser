# WeatherChaser

## What This Is

WeatherChaser is a web and mobile app with two core modes: a **Weather Finder** that shows users where the best weather is in their area for a given day or week, and a **Route Planner** that calculates an optimized multi-day campervan route through real towns and villages to maximize good weather while minimizing backtracking. Starting with the EU/German market and expanding globally.

## Core Value

Answer two questions no other app answers: "Where is the weather best near me this weekend?" and "Where should I drive my campervan over the next 10 days to find the best weather?" — through real places, not dots on a grid.

## Requirements

### Validated

<!-- Existing capabilities confirmed in current codebase. -->

- ✓ Weather data fetching via Open-Meteo API — existing
- ✓ Weather scoring algorithm (rain, sun, temperature, wind with weights) — existing
- ✓ Interactive map visualization via Leaflet.js — existing
- ✓ Location search and geocoding via Nominatim — existing
- ✓ Grid-based weather point generation around a location or drawn area — existing
- ✓ Manual places mode for custom location lists — existing
- ✓ Basic route building connecting weather-scored stops — existing
- ✓ Road distance calculation via OSRM — existing

### Active

<!-- Current scope being built toward. These are hypotheses until shipped and validated. -->

**Locations**
- [ ] Replace arbitrary grid points with real towns and villages (via Overpass API or similar)
- [ ] Locations have names, context, and are actually worth visiting

**Smart Route Optimization**
- [ ] Configurable max-stay parameter (y days) per location before moving on
- [ ] Route optimizer minimizes backtracking and criss-crossing
- [ ] No location visited twice (after leaving)
- [ ] Route balances weather score against travel efficiency

**UX / UI Redesign**
- [ ] Full UI redesign (approach TBD — map-first, planner-style, or wizard — determined by UX research)
- [ ] Mobile-responsive design that works across web, iOS, Android
- [ ] Intuitive trip configuration (region, duration, max-stay, start point)

**Weather Intelligence**
- [ ] Research and evaluate weather model alternatives to current Open-Meteo setup
- [ ] Hourly weather granularity for better per-stop timing
- [ ] Expanded weather variables (UV index, cloud cover, visibility)

**User Accounts & Persistence**
- [ ] User registration and authentication
- [ ] Save and name planned routes
- [ ] Favorite/bookmark locations
- [ ] Persist user preferences (home region, weather weights, max-stay defaults)

**Infrastructure & Hosting**
- [ ] Backend server for user data (accounts, saved routes, favorites)
- [ ] Web app hosted and publicly accessible
- [ ] Cross-platform: web + native iOS + native Android (tech stack TBD by research)

**Monetization**
- [ ] Freemium model: core features free, advanced features (longer forecasts, more routes, premium weather data) require subscription

### Out of Scope

<!-- Explicit boundaries to prevent scope creep. -->

- Social / community features (sharing routes, following other users) — not core to v1 value
- Trip history / past routes — deferred to v2
- Offline mode — deferred, adds complexity
- Global launch — Germany/EU first, then expand based on traction
- Real-time weather alerts or push notifications — deferred to v2

## Context

The current codebase is a static HTML/CSS/JS MVP (no build process, no backend, no framework). It demonstrates the core concept but has fundamental limitations:

- Grid points land in fields, water, and empty areas — not useful as actual destinations
- Route logic connects dots in order of score but doesn't optimize for travel efficiency
- No persistence (no accounts, no saved routes, everything resets on refresh)
- Single monolithic `app.js` (1562 lines) — needs architectural rework for scale

Key existing integrations: Open-Meteo (weather), Nominatim (geocoding), OSRM (routing), Overpass (location search — partially used). These APIs are free and public, which is valuable to preserve where possible.

The rework is a full product rebuild, not incremental patching. The existing MVP serves as a proof-of-concept and source of domain logic to port.

## Constraints

- **Cross-platform**: Must ship web + iOS + Android — architecture must support this from day one
- **Geography**: Germany/EU market first; global expansion later (affects map defaults, languages, camping location data)
- **Freemium**: Business model requires clear free/paid feature split — design must support paywalls
- **APIs**: Prefer free/open APIs (Open-Meteo, Nominatim, OSRM, Overpass) to keep costs low; evaluate paid alternatives only where quality gap is significant
- **Tech stack**: TBD — research will recommend the best cross-platform approach (React Native + web, Flutter, or separate apps)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cross-platform from day one | User explicitly wants iOS + Android + web simultaneously | — Pending |
| Freemium model | Sustainable business model for a real product | — Pending |
| EU/Germany first | Focused launch market, campervan culture strong there | — Pending |
| Full rebuild vs. incremental | MVP limitations are architectural, not cosmetic | — Pending |
| Cross-platform tech stack | TBD — let research determine best approach | — Pending |
| Weather model provider | TBD — Open-Meteo may be sufficient, research will validate | — Pending |

---
*Last updated: 2026-02-26 after initialization*
