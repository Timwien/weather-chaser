# Project Research Summary

**Project:** WeatherChaser — Cross-Platform Campervan Weather Route Optimizer
**Domain:** Weather-optimized travel routing / campervan trip planning
**Researched:** 2026-02-26
**Confidence:** MEDIUM

## Executive Summary

WeatherChaser occupies genuinely unclaimed territory: no existing product answers "I have 10 days, a campervan, and I'm starting from Munich — route me through the best weather in Germany." The existing prototype (static HTML/JS with Leaflet) has proven the core concept but must be rebuilt on a cross-platform, production-grade foundation to support user accounts, freemium monetization, and native iOS/Android apps. The product's moat is the routing algorithm itself — weather-optimized, anti-backtracking, multi-day temporal scoring — which must be treated as the irreplaceable core from day one.

The recommended architecture is a Turborepo monorepo with three apps (web React SPA, React Native/Expo mobile, Node/Hono API) sharing a pure TypeScript core library that contains all routing and scoring logic. The backend handles five and only five responsibilities: auth, user data persistence, weather proxying with caching, Overpass location proxying, and route storage for sharing. The routing algorithm runs client-side — it is deterministic, fast (< 200ms for 50 nodes), and running it locally enables instant parameter re-runs without server round-trips. Open-Meteo is the correct free-tier weather backbone due to its 16-day horizon, EU-hosted infrastructure, and ICON model accuracy for Germany/Austria/Switzerland.

The two highest-risk decisions are the map library strategy and the infrastructure dependencies. No single map library spans web, iOS, and Android cleanly; the plan is MapLibre GL JS on web and @rnmapbox/maps on native — two separate map implementations sharing only types and business logic. Three public APIs the prototype relies on (Nominatim, OSRM demo server, Overpass) are not production-safe and must be proxied or self-hosted before any public exposure. Freemium gating must be enforced server-side from the start — retrofitting it later is a major refactor and a revenue leak.

## Key Findings

### Recommended Stack

The full-stack recommendation is Expo (React Native) + React SPA monorepo for cross-platform delivery, Supabase for backend-as-a-service (Postgres + Auth + Edge Functions), Open-Meteo as the free weather API, MapLibre GL JS for web maps, and @rnmapbox/maps for native maps. Zustand + TanStack Query handle client state (UI state and server state separated). Stripe handles subscription billing. Vercel hosts the web app; Supabase cloud (Frankfurt region) handles the backend. All primary infrastructure choices have EU data residency, satisfying GDPR requirements for the German-first market.

**Core technologies:**
- **Expo SDK 51+ / React Native 0.74+**: Cross-platform runtime — single TypeScript codebase for iOS and Android; web app built separately but shares the core business logic library
- **Turborepo monorepo**: Organizes `packages/core` (shared algorithm), `apps/web` (React + MapLibre), `apps/mobile` (Expo), `apps/api` (Hono + Node)
- **Supabase**: Postgres + Auth + Edge Functions + Row Level Security — replaces custom backend, auth system, and file storage; EU Frankfurt region; generous free tier
- **Open-Meteo**: Primary weather API — free, no key, 16-day horizon, ICON model (best for EU), EU-hosted; commercial tier (~$30-50/mo) available when scale demands it
- **MapLibre GL JS (web) + @rnmapbox/maps (native)**: The only credible open-source map stack with both web and native coverage; these are two distinct implementations, not shared code
- **OSRM (proxied) + custom greedy + 2-opt optimizer**: Road distance via OSRM `/table` endpoint (batch, not per-pair); route sequencing as client-side pure TypeScript
- **Zustand 4.x + TanStack Query 5.x**: UI state and server state separated; eliminates the monolithic class mutation pattern from the prototype
- **Stripe**: Subscription billing; Revenue Cat as alternative if App Store IAP is primary channel
- **Vercel**: Web app hosting; zero-config, edge CDN, GitHub integration

Version numbers from training data; verify before pinning: Expo 51+, @rnmapbox/maps 10.x, MapLibre GL JS 4.x, Zustand 4.x, TanStack Query 5.x, Expo Router 3.x.

### Expected Features

The prototype already implements the core loop (weather grid → scoring → greedy route → map display). The rebuild must replace grid points with real named towns, add proper multi-day temporal scoring, and ship user accounts + freemium gating.

**Must have (table stakes):**
- Named real locations (towns/villages from Overpass) — grid coordinates are meaningless to users
- Day-by-day itinerary with dates ("Monday 3 March: Freiburg, 2 nights, score 84")
- Interactive map with animated route visualization (numbered stops, polyline)
- Weather score explanation — component breakdown per location (rain, sun, temp, wind)
- Configurable stay duration (min/max nights per stop) — this is the campervan-specific differentiator
- Shareable trip link — URL-encoded route for viral growth; must be free
- Google Maps / Apple Maps deep-link export — already in prototype; keep it
- Loading states and error handling — currently minimal; any network-dependent app needs this
- Mobile-responsive web UI — 60-70% of travel planning is mobile

**Should have (competitive differentiators):**
- Weather score weight sliders — adjustable rain/sun/temp/wind weights; preset profiles (Beach, Hiking, Sightseeing)
- Anti-backtracking penalty in routing — geographic progression heuristic; campervans burn real fuel
- Multi-day temporal weather awareness — score "location A on THIS specific day" not location average
- Freemium-viable route sharing — shared trips viewable without account (viral acquisition)
- Historical climate confidence overlay — "this region is usually sunny in May" adds trust beyond 14-day forecast

**Defer to v2+:**
- User accounts and saved trips — prove the algorithm first; add persistence after
- Campsite/Park4Night overlay — external data dependency; phase 3 or later
- Native iOS / Android apps — PWA/web first to validate; native is phase 4
- Dynamic re-routing notifications — requires background jobs and push infrastructure
- Route comparison (Plan A vs Plan B) — power feature; premium tier phase 3
- Historical climate data — interesting differentiator; not core to the planning use case at launch
- Full offline mode — design for graceful degradation v1; full offline is a v2 architecture commitment

**Freemium split:** Free tier includes 7-day routing, 3 saved trips, preset weather profiles, export, and sharing. Premium (~EUR 29/year or EUR 3.99/month) unlocks 14-day routing, unlimited saved trips, custom weight sliders, route comparison, and historical climate overlay. Price anchors from comparable apps (Roadtrippers Plus ~USD 30/yr, Park4Night Premium ~EUR 20/yr). Validate with user interviews before locking in.

**Anti-features (deliberately avoid):**
- Turn-by-turn navigation — deep-link to Google Maps / Apple Maps; can't compete
- Campsite booking — link to Pitchup, ACSI; don't build the reservation backend
- Social feed / UGC reviews — Park4Night owns EU camping reviews; don't compete
- AI chat assistant — LLM API costs unpredictable; the algorithm IS the intelligence
- Full internationalization at launch — German + English covers 80% of target users

### Architecture Approach

The architecture separates concerns across five layers: a pure TypeScript `packages/core` library (scoring, optimizer, types — no I/O, runs on any platform), a React web SPA and React Native mobile app both importing from core, a Node/Hono API handling only persistence and external API proxying, Supabase managing auth and Postgres, and Redis/Upstash providing a weather data cache shared across all users. The route optimizer runs entirely client-side — it is fast enough (< 200ms at 50 nodes), requires no server round-trip, and must remain deterministic so routes are reproducible and shareable.

**Major components:**
1. `packages/core` — Pure TypeScript: `scoreLocation()`, `buildOptimalRoute()` (greedy + 2-opt), `generateGridPoints()`, shared types. Zero I/O. Imported by both web and mobile apps.
2. `apps/web` — React SPA with MapLibre GL JS; trip configuration, route display, auth flows. Hosted on Vercel.
3. `apps/mobile` — React Native / Expo with @rnmapbox/maps; same screens as web but native UI. Published via Expo EAS.
4. `apps/api` — Node + Hono: auth proxy (Supabase), weather proxy (Open-Meteo + Redis cache), Overpass proxy (Postgres cache), CRUD for routes/favorites/preferences. The backend does NOT run the route optimizer.
5. **Weather proxy + Redis cache** — Three-layer cache (in-memory LRU, Redis/Upstash, Open-Meteo fetch). Cache key rounds coordinates to 0.1° (~11km) for high hit rates. TTL: 3h L1, 6h L2. At 100 DAU × 3 searches × 50 locations = 15K API calls/day without caching; with caching target is 60%+ hit rate.
6. **Overpass proxy + Postgres cache** — Town/village lookups cached for 30 days (OSM data is stable). Pre-built region datasets (Germany, France, etc.) in Phase 5 eliminate live Overpass dependency for major markets.

**Route algorithm:** Greedy nearest-neighbor construction (O(n²)) followed by 2-opt local improvement (2-3 passes). Deterministic: same input always produces same route (shareable/reproducible). At 50 nodes, 3 passes of 2-opt = ~7,500 iterations, completing in < 100ms on mobile. Pre-compute distance matrix via OSRM `/table` endpoint once per session (single API call for N×N matrix) — not per-step as the prototype does.

**REST API design:** Standard resource-based REST (not GraphQL). Endpoints: `/auth/*`, `/weather`, `/locations`, `/route` (OSRM proxy), `/users/me`, `/routes` (CRUD), `/favorites` (CRUD). Premium enforcement happens in backend middleware returning 403, never enforced only in client code.

### Critical Pitfalls

1. **Map library doesn't span all three platforms** — No single library works equally on web, iOS, and Android. Plan two distinct map implementations (MapLibre web + @rnmapbox native) from day one. Never treat the map as a shared component. Prototype map on all target platforms before committing to the stack.

2. **O(n²) OSRM calls during route optimization** — The prototype calls OSRM per candidate per step. With 50 Overpass towns, this is 2,500+ API calls per route build. Fix: use OSRM `/table` endpoint to pre-compute the full distance matrix in one API call before optimization begins. Cap candidate set at 20-30 locations (filter by weather score threshold before routing).

3. **Nominatim and OSRM demo server are not production infrastructure** — Both have explicit no-production-use policies. The OSRM demo server (`router.project-osrm.org`) has no SLA and can go down without notice. Nominatim enforces 1 req/s, forbids bulk use, and bans violating IPs. Self-host OSRM on a VPS with EU OSM extract (~4GB RAM for Germany), and proxy Nominatim lookups server-side with caching before any public exposure.

4. **Freemium gating added as an afterthought** — Feature limits enforced only in client code are trivially bypassed. Design the entitlement model (user has capability `feature.extended_forecast` = true/false) in Phase 1 architecture. All premium data endpoints return 403 server-side regardless of client-side UI state. This cannot be retrofitted without a major refactor.

5. **Overpass data quality in rural regions** — OSM data varies significantly. Rural eastern Germany and the Alps have villages with missing names, population fields, or coordinates pointing to administrative centroids. Apply multi-layer filtering: require `name` tag, minimum population > 500, exclude `hamlet` and `isolated_dwelling`. Cache results (30-day TTL). Consider supplementing with GeoNames database for higher reliability. Test specifically in rural Bavaria and the Alps before shipping location search.

6. **Monolithic MVP state ported directly to React** — The prototype's `WeatherChaser` class with direct property mutation does not translate to React's rendering model. Extract pure functions (scoring, optimization) into `packages/core`; build new state management (Zustand + TanStack Query) around them. Never port the class directly. Separate server state (weather data, geocoding results) from UI state (filter settings, selected route) from the start.

## Implications for Roadmap

Based on the dependency graph established by architecture research and pitfall analysis, five phases are suggested. Each phase is a prerequisite for the next; no phase should begin before its predecessor is complete and tested.

### Phase 1: Core Algorithm + Web Foundation

**Rationale:** Everything else — mobile apps, backend, freemium — depends on the routing algorithm being correct, tested, and living in a shared library. Building the core first means every subsequent phase starts with proven business logic. This phase also makes the irreversible infrastructure decisions (map library, monorepo structure, web framework) that must be validated on all target platforms before committing.

**Delivers:** A working web app with the improved routing algorithm, real town names from Overpass, configurable stay duration, and day-by-day itinerary. Users can build a route without accounts. No backend required — calls Open-Meteo, Overpass, OSRM directly from client (same as prototype).

**Addresses from FEATURES.md:**
- Named real locations (towns from Overpass replacing grid points)
- Day-by-day itinerary with dates
- Weather score weight sliders (preset profiles)
- Anti-backtracking routing with configurable stay duration
- Shareable trip link (URL-encoded, no server required)
- Google Maps / Apple Maps export
- Weather score explanation (component breakdown)

**Avoids from PITFALLS.md:**
- Map library mismatch (Pitfall 1): prototype MapLibre GL JS on web; plan @rnmapbox boundary for mobile
- Monolithic state chaos (Pitfall 12): Zustand + TanStack Query from day one, not the prototype's class
- O(n²) OSRM calls (Pitfall 2): distance matrix via OSRM `/table` in core library

**Research flag:** Needs `/gsd:research-phase` — map library evaluation (MapLibre vs alternatives on web specifically), OSRM `/table` endpoint capabilities, and Overpass query design for EU town data all require deeper investigation before Phase 1 begins.

---

### Phase 2: Backend API + Auth + Persistence

**Rationale:** User accounts require a backend; saved routes require user accounts; freemium requires both. Building backend after the core algorithm is stable means the API contract reflects proven client needs rather than speculation. This phase also moves the dangerous public API dependencies (Nominatim, OSRM demo, Overpass) behind a server-side proxy.

**Delivers:** User registration, login (email + OAuth), saved routes (up to 3 on free tier), favorites, user preferences, weather proxy with Redis cache, Overpass proxy with Postgres cache, and OSRM proxy. Nominatim and OSRM demo server eliminated from direct client usage.

**Uses from STACK.md:**
- Supabase (Postgres + Auth + Row Level Security + Frankfurt EU region)
- Node + Hono for the API layer
- Redis/Upstash for weather cache (3h/6h TTL with coordinate rounding to 0.1°)
- Supabase Auth (email/password + Google OAuth + Apple Sign-In for iOS App Store compliance)

**Implements from ARCHITECTURE.md:**
- `apps/api` with all proxy and CRUD routers
- Freemium entitlement model (`users.plan` column; middleware returns 403 on premium endpoints for free users)
- Three-layer weather cache (in-memory LRU → Redis → Open-Meteo)

**Avoids from PITFALLS.md:**
- Nominatim production ban (Pitfall 4): geocoding moves server-side with caching
- OSRM demo server dependency (Pitfall 5): OSRM self-hosted or proxied
- Weather API cost explosion (Pitfall 7): server-side cache shared across users
- Freemium as afterthought (Pitfall 6): entitlement model built into this phase, not Phase 3
- Auth complexity underestimation (Pitfall 10): Supabase Auth handles GDPR-compliant EU-hosted auth

**Research flag:** Needs `/gsd:research-phase` — Supabase Edge Functions vs separate Node process for the API tier, Redis/Upstash pricing at target scale, and OSRM self-hosting requirements (memory, disk, update cadence for EU OSM data).

---

### Phase 3: Freemium Model + Monetization

**Rationale:** Freemium gating requires auth (Phase 2). This phase activates the subscription paywall and premium features. It is sequenced third because the product must be proven worth saving before asking users to pay, and because the entitlement model is already designed in Phase 2 — this phase only activates it.

**Delivers:** Stripe subscription integration, premium endpoint enforcement (14-day forecast, unlimited routes, custom weight sliders, route comparison), App Store / Play Store billing consideration, and a clear free vs. premium UX.

**Uses from STACK.md:**
- Stripe + Stripe Billing for web subscriptions
- Revenue Cat consideration if App Store IAP is primary monetization channel (verify 30% platform fee impact)
- Supabase Edge Functions for Stripe webhook handling

**Avoids from PITFALLS.md:**
- Freemium bypass (Pitfall 6): all premium checks are server-side 403s; this phase validates they work end-to-end

**Research flag:** Standard patterns — Stripe integration is well-documented. However, App Store IAP vs. Stripe routing decision needs a business/legal review, not a technical research phase.

---

### Phase 4: Native Mobile Apps (iOS + Android)

**Rationale:** Mobile requires a stable API contract (Phase 2) and proven core library (Phase 1). Building mobile before the API is stable guarantees rework. Native apps are sequenced last among core phases because the web app already covers the PWA use case and App Store review cycles add 1-2 weeks of lead time that shouldn't block algorithm and backend work.

**Delivers:** iOS and Android apps at feature parity with the web app for core trip planning, distributed via Expo EAS Build + Submit through App Store and Play Store.

**Uses from STACK.md:**
- Expo SDK + React Native for the app layer
- @rnmapbox/maps for native map rendering (separate from MapLibre web implementation)
- Expo Router 3.x for file-based navigation
- Expo Location for "start from my current location" feature
- @shopify/flash-list for high-performance route itinerary lists
- react-native-reanimated for smooth transitions

**Avoids from PITFALLS.md:**
- Mobile map performance (Pitfall 11): marker clustering, native primitives, cap visible markers at 20, benchmark on mid-range Android
- Expo Web ≠ real web app (Pitfall 8): web is a separate React SPA, not Expo Web target
- App Store location permission rejection (Pitfall 17): request location only on explicit user action; "when in use" only; clear permission string
- GDPR + App Store compliance (Pitfall 15): privacy policy and consent flows built before TestFlight submission

**Research flag:** Needs `/gsd:research-phase` — @rnmapbox/maps current capabilities and known Expo SDK compatibility issues, Apple Sign-In mandatory requirement verification for the specific OAuth configuration chosen, and Expo EAS Build pricing at expected build frequency.

---

### Phase 5: Location Data Quality + UX Polish

**Rationale:** Once the architecture is stable and users are paying, invest in data quality improvements and advanced features. Pre-built region datasets eliminate the Overpass dependency for major markets; hourly weather granularity and historical climate overlays differentiate the premium tier.

**Delivers:** Pre-built European town/village datasets in Postgres (eliminating live Overpass dependency for Germany, France, Spain, etc.), hourly weather resolution, historical climate confidence overlays, enhanced location metadata, and UX improvements from user feedback.

**Uses from STACK.md:**
- PostGIS extensions (ST_Contains, ST_Distance) for spatial queries on pre-built region data
- Open-Meteo historical climate API for the historical overlay feature
- Overpass data replaced by GeoNames or curated OSM dumps for major regions

**Avoids from PITFALLS.md:**
- Overpass data quality (Pitfall 3): pre-built datasets bypass live Overpass for supported regions
- Overpass timeout in production (Pitfall 16): same fix; live Overpass only for unsupported regions with fallback

**Research flag:** Standard patterns — pre-building region datasets from OSM/GeoNames is well-understood. Open-Meteo historical API capabilities should be verified before committing to the historical overlay feature.

---

### Phase Ordering Rationale

- **Algorithm first, infrastructure second:** The routing algorithm is the product's moat. Proving it works (Phase 1) before building around it (Phases 2-5) avoids building infrastructure for an algorithm that might need fundamental redesign.
- **Web before native:** Validates the product with faster iteration cycles. Web deployments are instant; App Store reviews take 1-2 weeks. Core UX and algorithm issues surface on web before mobile investment.
- **Auth before monetization:** Cannot enforce subscription tiers without user identity. Cannot run A/B tests on pricing without user accounts. Phase 2 is the prerequisite for Phase 3.
- **Backend before mobile:** Mobile apps cannot be finalized without a stable API contract. Building both in parallel creates rework.
- **Polish last:** Data quality improvements and UX polish have the highest leverage after real users provide feedback. Phase 5 features should be prioritized based on what Phase 1-4 user feedback reveals.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Map library evaluation (MapLibre GL JS current API, @rnmapbox/maps compatibility with current Expo SDK), Overpass query design and data quality testing in target regions, OSRM `/table` endpoint usage
- **Phase 2:** Supabase Edge Functions vs. Node process for API hosting decision, Redis/Upstash pricing at scale, OSRM self-hosting operational requirements
- **Phase 4:** @rnmapbox/maps + Expo SDK compatibility matrix, Apple Sign-In mandatory requirement for the chosen OAuth configuration, EAS Build pricing

Phases with standard, well-documented patterns (skip research-phase or lightweight only):
- **Phase 3:** Stripe subscription integration is thoroughly documented; the business decision (App Store IAP vs. web subscriptions) is a product call, not a technical research question
- **Phase 5:** Pre-building region datasets from OSM is a known operation; complexity is operational, not architectural

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Technology choices are well-grounded for 2025/2026; specific versions (Expo SDK, @rnmapbox) need verification. MapLibre + Supabase + Open-Meteo are solid choices with no strong competing alternatives at this price point. |
| Features | MEDIUM-HIGH | Prototype provides HIGH confidence on the core algorithm features. Competitive gap analysis (no product does weather-optimized campervan routing) is MEDIUM — verify against current App Store listings before roadmap finalization. Freemium pricing anchors are LOW confidence; validate with user interviews. |
| Architecture | MEDIUM-HIGH | Monorepo structure, client-side optimizer, three-layer weather cache, and REST API design are all standard well-established patterns. Map library two-implementation approach is the unavoidable correct answer. Build order derived from dependency graph analysis — HIGH confidence on sequencing logic. |
| Pitfalls | MEDIUM-HIGH | O(n²) algorithm analysis is mathematical (HIGH). Nominatim/OSRM/Overpass policy specifics are MEDIUM — policies may have changed since August 2025 training cutoff; verify before launch. Freemium and state management pitfalls are universal patterns (HIGH). |

**Overall confidence: MEDIUM**

All research was conducted from training data (cutoff August 2025) without live web access. Technology choices are well-grounded but version numbers, pricing tiers, and API policies require verification against current official documentation before any implementation begins.

### Gaps to Address

- **Map library verification:** Confirm @rnmapbox/maps is compatible with the current Expo SDK version before committing to the stack. This is the highest-risk decision and cannot be changed after Phase 1.
- **Open-Meteo commercial terms:** Verify that the current free tier terms permit commercial use (freemium apps generating revenue). Training data suggests non-commercial restriction on free tier — this may require commercial plan from launch.
- **Nominatim / OSRM policy verification:** Verify current policy wording before any public launch. Self-hosting or proxying is the correct answer regardless, but timeline and resource requirements need confirmation.
- **App Store IAP vs. Stripe routing:** Business/legal decision with major revenue impact (30% platform fee). Resolve before Phase 3 begins.
- **Overpass data quality in target regions:** Requires live testing with real Overpass queries in Germany, Austria, and Switzerland to validate filtering approach before Phase 1 ships location search.
- **Freemium pricing:** EUR 29/year anchor is based on comparable app pricing from 2024 training data. Validate with user interviews before Phase 3 launch.
- **GDPR data model:** Right to erasure, data processing agreements, and cookie consent requirements should be defined before any user data is collected. Auth provider (Supabase, Frankfurt region) satisfies data residency — consent flows and privacy policy are still required.

## Sources

### Primary (HIGH confidence)
- Existing WeatherChaser prototype codebase (`index.html`, `app.js`, `README.md`) — direct inspection of current implementation, integrations, and algorithm
- `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md` — codebase analysis

### Secondary (MEDIUM confidence)
- Training data through August 2025: React Native / Expo ecosystem, MapLibre GL JS, Supabase, Open-Meteo API capabilities, OSRM routing, Overpass API, Zustand, TanStack Query, Stripe
- Combinatorial optimization literature (greedy + 2-opt): algorithm analysis is mathematical and time-invariant (HIGH for algorithm; MEDIUM for performance benchmarks on current hardware)
- Competitive landscape: Park4Night, iOverlander, Roadtrippers, Wanderlog, Windy.app — feature sets from training data (~2024)

### Tertiary (LOW confidence — verify before acting)
- Open-Meteo commercial tier pricing and free-tier commercial use policy — verify at open-meteo.com
- Nominatim usage policy — verify at operations.osmfoundation.org/policies/nominatim/
- OSRM demo server policy — verify at github.com/Project-OSRM/osrm-backend/wiki
- Freemium pricing anchors (EUR 29/year) — validate with user interviews
- App Store / Play Store IAP policy specifics — verify current Apple/Google developer documentation

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
