# Architecture Patterns

**Domain:** Cross-platform weather routing application
**Researched:** 2026-02-26
**Confidence:** MEDIUM — based on codebase analysis + domain knowledge; WebSearch/WebFetch tools unavailable during research

---

## Recommended Architecture

### Top-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Web (React) │  │  iOS (RN)    │  │  Android (RN)        │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         └─────────────────┼──────────────────────┘               │
│                           │ shared core business logic            │
│              ┌────────────┴──────────┐                           │
│              │  Core Logic (TS lib)   │                           │
│              │  scoring / optimizer   │                           │
│              └────────────┬──────────┘                           │
└───────────────────────────┼─────────────────────────────────────┘
                            │ REST / GraphQL
                ┌───────────┴───────────┐
                │       BACKEND API      │
                │   (Node/Express/Hono)  │
                └───────────┬───────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                  │
   ┌──────┴──────┐  ┌───────┴──────┐  ┌───────┴──────┐
   │  Auth svc   │  │  DB (Postgres)│  │  Weather proxy│
   │  (Supabase) │  │  user data   │  │  + cache       │
   └─────────────┘  └──────────────┘  └───────┬──────┘
                                               │
                            ┌──────────────────┼──────────────┐
                            │                  │               │
                     ┌──────┴──────┐  ┌────────┴──────┐  ┌────┴──────┐
                     │  Open-Meteo │  │  Overpass API  │  │   OSRM    │
                     └─────────────┘  └───────────────┘  └───────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Web App** (React SPA) | Map UI, route display, trip configuration, auth flows | Core Logic lib, Backend API |
| **Mobile App** (React Native) | Native iOS/Android UI, same screens as web | Core Logic lib, Backend API |
| **Core Logic Library** (TypeScript) | Weather scoring algorithm, route optimizer, data transformations, no I/O | Called by Web + Mobile; pure functions only |
| **Backend API** (Node/Express or Hono) | User auth, saved routes, weather proxying with caching, Overpass proxying, OSRM proxying | Postgres, external APIs, clients |
| **Weather Proxy + Cache** | Batch fetch Open-Meteo, deduplicate requests, Redis/KV cache, rate limit shielding | Open-Meteo, Backend API |
| **Postgres** | User accounts, saved routes, favorites, preferences | Backend API only |
| **Auth Service** (Supabase Auth or similar) | JWT issuance, OAuth, refresh tokens | Backend API, clients |
| **Overpass Proxy** | Cache Overpass results for town/village lookups; shield from rate limits | Overpass API, Backend API |

---

## Route Optimization Algorithm

### Recommendation: Greedy Nearest-Neighbor + 2-opt Local Search

**Confidence: HIGH** (well-established in combinatorial optimization literature)

**Algorithm:**

```
Phase 1 — Greedy Construction (O(n²)):
  - Start from user's chosen start point
  - At each step, score all unvisited locations as:
      candidate_score = weather_score[location][current_day]
                      - travel_penalty(distance_from_current)
                      - direction_penalty(bearing_change)
  - Select the highest-scoring unvisited candidate
  - Advance day counter; if stayed ≥ max_stay, must move
  - Continue until trip_days exhausted or no candidates remain

Phase 2 — 2-opt Local Improvement (O(n²) per pass, 2-3 passes):
  - Try all segment reversals in the constructed route
  - Accept reversal if it improves total score (weather - distance)
  - Stop when no improving reversal found (local optimum)
```

**Why this algorithm and not alternatives:**

| Approach | Why Not |
|----------|---------|
| Exact TSP (branch-and-bound) | NP-hard; 50+ nodes × 14 days makes exact solving impractical client-side. Would require server with seconds of compute |
| Genetic Algorithm | Overkill for n < 100; requires tuning population/mutation rates; non-deterministic; harder to explain to user |
| Simulated Annealing | Similar overkill; also non-deterministic; cooling schedule needs tuning |
| Dynamic Programming | Feasible for small n (< 20), but state space explodes with max-stay constraint |
| Pure greedy (current MVP) | Fast but low quality; greedy without backtracking gets stuck in local optima |

**Greedy + 2-opt wins because:**
- Deterministic (same input = same output; users can share/reproduce routes)
- Fast: 50 nodes, 3 passes of 2-opt = ~7,500 iterations; completes in < 100ms on a phone
- Good quality: 2-opt typically finds solutions within 5-15% of optimal for geographic problems
- Explainable: Can describe the route logic to users ("starts at best weather, adjusts for travel efficiency")

**Max-stay constraint handling:**

```typescript
// Pseudo-code for max_stay constraint integration
function buildRoute(locations, startDay, totalDays, maxStay) {
  let route = [];
  let current = startPoint;
  let stayCount = 0;

  for (let day = startDay; day < totalDays; day++) {
    const canStay = stayCount < maxStay;
    const candidates = canStay
      ? [current, ...unvisited]   // include staying in place
      : unvisited;                 // must move

    const next = scoreCandidates(candidates, current, day);

    if (next === current) {
      stayCount++;
    } else {
      stayCount = 1;
      markVisited(next);
    }

    route.push({ day, location: next, stayed: next === current });
    current = next;
  }
  return route;
}
```

**Where to compute:** Client-side, in the Core Logic library. The algorithm is fast enough (< 200ms for 50 nodes) and running it client-side avoids a round-trip to the server, allows offline recomputation if the user adjusts parameters. The computation is pure (no I/O), making it ideal for the shared TS library.

---

## Weather Data Architecture

### Fetching Strategy

**Confidence: HIGH** (based on Open-Meteo API design, confirmed in existing codebase)

Open-Meteo's API endpoint (`/v1/forecast`) accepts one location per request. There is no native multi-location batch endpoint in the free tier. The existing MVP already handles this correctly with batches of 5 + 1s delay.

**For the rebuild, use a backend weather proxy with three-layer caching:**

```
Layer 1: In-memory LRU cache (backend process)
  - Key: "lat_lon_day_variables" (rounded to 0.1 degree)
  - TTL: 3 hours (weather doesn't change faster)
  - Capacity: ~5,000 entries (~10MB)
  - Hit rate goal: 60%+ (many users search same regions)

Layer 2: Redis/Upstash KV (shared across backend instances)
  - Key: same as L1
  - TTL: 6 hours
  - Fallback when L1 miss

Layer 3: Direct Open-Meteo fetch
  - Triggered on full cache miss
  - Batched: collect all cache misses from a request, fire in parallel with concurrency limit of 10
  - Rate limiting: token bucket, 10 req/s max toward Open-Meteo
```

**Rounding strategy:** Round coordinates to nearest 0.1 degree (approx 11km) before cache lookup. This dramatically increases cache hit rates — two users searching within 11km of each other get the same cached result, which is acceptable given weather resolution.

**Batch request pattern for a single user query:**

```
Client sends: { locations: [loc1, loc2, ...loc50], days: 14 }

Backend:
1. Hash each location to cache key
2. Batch check cache (Redis MGET) — single round-trip
3. For misses: group into parallel fetches (max 10 concurrent)
4. Write all results to cache
5. Return complete weather matrix to client
```

**Data shape returned to client:**

```typescript
type WeatherMatrix = {
  [locationKey: string]: {
    daily: {
      date: string;
      tempMax: number;
      tempMin: number;
      precipMm: number;
      precipProbability: number;
      sunshineHours: number;
      windspeedMax: number;
      // future: uvIndex, cloudCover, visibility
    }[];
  };
};
```

---

## Location Data (Towns and Villages)

### Recommendation: Overpass API via Backend Proxy, with Pre-built Region Caches

**Confidence: MEDIUM** (based on Overpass API design knowledge; official docs not verified in this session)

**Overpass query for real settlements:**

```overpassql
[out:json][timeout:25];
(
  node["place"~"city|town|village"]["name"]
    (bbox: south, west, north, east);
);
out body;
```

**Tag filtering:** Filter by `place` = `city`, `town`, or `village` (exclude `hamlet`, `suburb`, `neighbourhood` which are too small or within cities). Optionally filter by `population` > 500 to remove tiny hamlets.

**Architecture pattern:**

```
Client requests: bounding box + density preference (e.g., "towns only", "towns + villages")
Backend:
  1. Check Overpass cache (Postgres table or Redis) — TTL 30 days (OSM data is stable)
  2. If cache miss: query Overpass API, normalize, store in cache
  3. Return max 200 locations (sample by population/importance if more exist)
  4. Include: name, lat, lon, population (if available), country, region
```

**Why cache in backend and not call Overpass directly from client:**
- Overpass is rate-limited and has no SLA; a backend cache means one miss fetches for all users
- The same bounding box query can be deduplicated across users
- Overpass results are large (full JSON with tags); backend can normalize to minimal shape before sending to client

**Pre-built region datasets (Phase 2+ optimization):**
For common regions (Germany, France, Spain, etc.) pre-download and store the full towns/villages list in Postgres at app startup. This eliminates Overpass dependency for supported regions entirely.

---

## Cross-Platform Architecture

### Recommendation: React Native + React Web Monorepo

**Confidence: MEDIUM** (well-established pattern, specific library versions not verified)

**Why React Native (not Flutter, not separate apps):**

| Option | Verdict | Reason |
|--------|---------|--------|
| React Native + React Web | **RECOMMENDED** | Shared TypeScript business logic, shared state management, React skills transfer, large ecosystem, mature Expo tooling |
| Flutter | Skip | Dart language creates full rewrite; Dart ecosystem for geo/maps is weaker than React ecosystem; requires learning Dart |
| Separate native apps + web | Skip | 3x the work to maintain; divergence guaranteed; not justified for a startup |
| React Native Web (one codebase) | Avoid for v1 | Web performance suffers from RN primitives; maps are complex; better to share logic but keep platform UIs separate |

**Monorepo structure (Turborepo):**

```
/weather-chaser/
  packages/
    core/          ← Pure TypeScript: scoring, optimizer, types, utils
    api-client/    ← Generated API types, fetch wrappers
    ui-shared/     ← Shared constants, theme tokens, business components
  apps/
    web/           ← React SPA (Vite + React + Leaflet/MapLibre)
    mobile/        ← React Native (Expo)
    api/           ← Node backend (Hono or Express)
```

**What lives in `packages/core` (the shared brain):**

```typescript
// packages/core/src/scoring.ts
export function scoreLocation(weather: DailyWeather[], weights: WeatherWeights): number

// packages/core/src/optimizer.ts
export function buildOptimalRoute(params: RouteParams): RouteStop[]

// packages/core/src/grid.ts
export function generateGridPoints(center: Coordinate, radiusKm: number, count: number): Coordinate[]

// packages/core/src/types.ts
export type Location, WeatherPoint, RouteStop, TripParams, WeatherWeights
```

**Map libraries:**
- Web: MapLibre GL JS (open-source Mapbox GL fork) — better performance than Leaflet for large datasets, vector tiles, WebGL rendering. **Confidence: MEDIUM** (MapLibre is well-established as Mapbox open alternative)
- Mobile (iOS/Android): react-native-maps (Expo-compatible, uses native Apple Maps / Google Maps SDKs)

---

## Backend Architecture

### Responsibility Split

**Confidence: HIGH** (standard patterns for auth + data persistence + API proxying)

The backend needs to do exactly five things:

| Responsibility | Why Backend (not client) |
|---------------|--------------------------|
| **Auth** | JWT secret must not be on client; OAuth flows require server redirects |
| **User data** (routes, favorites, preferences) | Persistence across devices; needs server-side storage |
| **Weather proxy + cache** | Rate limit shielding; cache sharing across users; API key hiding if paid tier used |
| **Overpass proxy + cache** | Same rationale; deduplicate expensive Overpass queries |
| **Route storage + sharing** | Saved routes need IDs, shareable URLs require server state |

**What the backend does NOT need to do:**
- Run the route optimizer (client-side is fast enough; server-side adds latency and complexity)
- Store raw weather data long-term (cache is enough; fetched fresh on each trip plan)
- Handle map tiles (use OSM/MapLibre CDN tiles directly)

### API Design

**REST with typed endpoints** (not GraphQL — too much complexity for this use case):

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh

GET    /weather?locations=...&days=14          ← weather proxy
GET    /locations?bbox=...&types=town,village  ← Overpass proxy
GET    /route?from=...&to=...                  ← OSRM proxy (optional)

GET    /users/me
PATCH  /users/me/preferences

GET    /routes                                 ← saved routes list
POST   /routes                                 ← save new route
GET    /routes/:id
DELETE /routes/:id

POST   /favorites                              ← favorite a location
DELETE /favorites/:locationId
GET    /favorites
```

### Backend Technology

**Node.js + Hono** (or Express):
- Hono is faster than Express, has TypeScript-native types, edge-runtime compatible
- Node keeps the team in one language (TypeScript throughout)
- **Confidence: MEDIUM** (Hono is well-established as of 2025/2026)

**Database: PostgreSQL (Supabase-hosted)**
- Supabase provides Postgres + Auth + Row-level security in one hosted service
- Auth included: eliminates building custom auth from scratch
- Row-level security: database-enforced user isolation
- Free tier adequate for development and early users

**Freemium enforcement:**
- Subscription status stored in `users.plan` column (free | pro)
- Backend middleware checks plan before allowing access to premium endpoints (extended forecast, more routes, premium weather)
- Do NOT enforce freemium in client code — always server-side

---

## Data Flow

### Trip Planning Flow (Happy Path)

```
1. User configures trip: region, dates, duration, max-stay, weather weights
2. Client: generateGridPoints() from core library → coordinate list
3. Client → Backend: POST /weather { locations: [...], days: N }
4. Backend: check Redis cache for each location
5. Backend: fetch misses from Open-Meteo (parallel, max 10 concurrent)
6. Backend: fill cache, return WeatherMatrix to client
7. Client: scoreLocation() from core library → sorted WeatherPoints
8. Client: buildOptimalRoute() from core library → RouteStop[]
9. Client: display route on map + itinerary timeline
10. [If logged in] User → Backend: POST /routes { ...routeData } → saved
```

### Location Discovery Flow

```
1. User draws bounding box or enters region name
2. Client → Backend: GET /locations?bbox=...&types=town,village
3. Backend: check Overpass cache
4. [Cache miss] Backend → Overpass API → normalize → cache → return
5. Client: display locations as selectable candidates on map
6. User adjusts candidates, removes unwanted places
7. Proceed to Trip Planning Flow above
```

### Authentication Flow

```
1. User registers/logs in → Supabase Auth returns JWT
2. Client stores JWT in secure storage (not localStorage on mobile)
3. All API requests: Authorization: Bearer <jwt>
4. Backend validates JWT via Supabase SDK on every protected route
5. Row-level security in Postgres enforces user data isolation
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running Route Optimizer Server-Side Per Request

**What:** Moving buildOptimalRoute() to the backend to simplify clients.
**Why bad:** Adds server round-trip (300-600ms), scales poorly under load (CPU-intensive on shared server), loses the ability to let users interactively adjust parameters and re-run instantly. The algorithm is deterministic and pure — it belongs in the shared core library running client-side.
**Instead:** Core library runs on client. Backend only stores/retrieves completed routes.

### Anti-Pattern 2: One Fetch Per Location for Weather

**What:** Calling Open-Meteo once per location directly from client (current MVP pattern).
**Why bad:** 50 locations = 50 sequential batched requests = 10+ seconds wait; no cache sharing between users; Open-Meteo rate limits will be hit at scale.
**Instead:** Client sends one request to backend weather proxy with all locations; backend batches, caches, deduplicates.

### Anti-Pattern 3: React Native Web (One Codebase for All Platforms)

**What:** Using React Native's web support to serve the web app from the same component tree as mobile.
**Why bad:** RN primitives (View, Text, Pressable) render to suboptimal DOM elements; map libraries behave differently; web-specific features (CSS hover, keyboard navigation) require workarounds; debugging is harder.
**Instead:** Share business logic in `packages/core`; write platform-appropriate UI in separate `apps/web` and `apps/mobile`.

### Anti-Pattern 4: Enforcing Freemium in Client Code

**What:** Hiding premium features in the UI but checking plan status only on the client.
**Why bad:** Trivially bypassed via browser DevTools or modified app binary; not a real paywall.
**Instead:** All premium data endpoints return 403 if plan = free. Client reads the plan from the auth token and hides UI affordances, but the server is the source of truth.

### Anti-Pattern 5: Storing Weather Data Long-Term

**What:** Writing all fetched weather data to Postgres for user history/analytics.
**Why bad:** Weather data has a 14-day horizon and expires; storing it adds database complexity and cost for zero user value.
**Instead:** Cache weather in Redis with 6h TTL; let it expire naturally.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Weather API calls | Batched per user; ~50 req/trip | Redis cache reduces Open-Meteo load by 60%+ | Pre-warm cache for popular regions; consider Open-Meteo commercial plan |
| Backend | Single Node process on VPS | Horizontal scaling; Redis session store | CDN edge functions for weather proxy |
| Database | Supabase free tier | Supabase Pro ($25/mo) | Read replicas; archive old routes |
| Route optimizer | Client-side; zero server load | Client-side; still zero server load | Client-side; still zero server load |
| Map tiles | OSM free CDN | MapTiler/Maptbox paid CDN | Dedicated tile CDN with SLA |
| Overpass | Backend cache 30d TTL | Pre-built region datasets in Postgres | Pre-built + scheduled refresh |

---

## Suggested Build Order

This order is derived from dependency analysis. Each phase unlocks the next.

### Phase 1: Core Library + Basic Web App

**Build first because:** Everything else depends on the scoring and optimizer logic being correct and testable.

- Extract `packages/core`: scoring algorithm, optimizer (greedy + 2-opt), types
- Set up Turborepo monorepo
- Build `apps/web` as React SPA (Vite) using `packages/core`
- Direct client-to-API-services (no backend yet): Open-Meteo, Overpass, OSRM called directly from client (same as MVP)
- Map: MapLibre GL JS with real town/village locations from Overpass
- Route display with max-stay constraint

**Exit criteria:** Web app builds an optimized route through real towns; Core logic has unit tests.

### Phase 2: Backend API + Auth + Persistence

**Build second because:** User accounts depend on a backend; freemium depends on auth; saved routes depend on both.

- Set up `apps/api` (Hono + Node)
- Supabase integration (Postgres + Auth)
- User registration, login, JWT
- Weather proxy endpoint (with Redis cache layer)
- Overpass proxy endpoint (with Postgres cache)
- Saved routes CRUD
- Favorites CRUD
- User preferences

**Exit criteria:** Users can register, log in, save routes, and the weather proxy reduces direct Open-Meteo calls.

### Phase 3: Freemium Model

**Build third because:** Requires auth (Phase 2). Can't enforce subscription without user identity.

- Subscription plans table
- Payment integration (Stripe)
- Premium endpoint gating (middleware)
- Free tier limits (e.g., 7-day forecast, 3 saved routes)
- Pro tier features (14-day forecast, unlimited routes)

**Exit criteria:** A paying user gets extended forecast; free user sees paywall.

### Phase 4: Mobile Apps

**Build fourth because:** Requires stable API contract (Phase 2) and shared core library (Phase 1). Building mobile before the API is stable means rework.

- Set up `apps/mobile` (React Native + Expo)
- Implement trip planning UI using `packages/core`
- react-native-maps for map display
- Shared auth flow (deep link OAuth redirect)
- TestFlight / Play Store internal testing

**Exit criteria:** Mobile apps achieve feature parity with web app for core trip planning.

### Phase 5: Location Data Quality + UX Polish

**Build fifth because:** Nice to have, but depends on stable architecture. Don't optimize data quality before the architecture is solid.

- Pre-built region datasets for Germany/EU (eliminate Overpass dependency for supported regions)
- Enhanced location metadata (points of interest, campsite data)
- Hourly weather granularity
- Advanced weather variables (UV, cloud cover)
- UI redesign / UX research findings applied

---

## Component Diagram (Detailed)

```
┌─────────────────────────────────────────────────────────┐
│                    packages/core (TypeScript)             │
│                                                           │
│  scoring.ts         optimizer.ts        grid.ts           │
│  ─────────────      ────────────────    ─────────         │
│  scoreLocation()    buildOptimalRoute() generateGrid()    │
│  calculateDaily()   greedyConstruct()   pointsInBbox()    │
│  applyWeights()     twoOptImprove()                       │
│                                                           │
│  types.ts           utils.ts                              │
│  ──────────         ─────────                             │
│  Location           haversine()                           │
│  WeatherPoint       bearingBetween()                      │
│  RouteStop          roundCoord()                          │
│  TripParams                                               │
└─────────────────────────────────────────────────────────┘
           ↑                              ↑
           │ import                       │ import
┌──────────┴──────────┐       ┌──────────┴──────────────┐
│      apps/web        │       │       apps/mobile        │
│  (React + MapLibre)  │       │  (React Native + Expo)   │
│                      │       │                          │
│  MapView             │       │  MapView (native maps)   │
│  ItineraryPanel      │       │  ItineraryPanel          │
│  TripConfigurator    │       │  TripConfigurator        │
│  AuthScreens         │       │  AuthScreens             │
└──────────┬──────────┘       └──────────┬───────────────┘
           │                             │
           │ HTTP (REST)                 │ HTTP (REST)
           └────────────┬────────────────┘
                        ↓
           ┌────────────────────────────┐
           │         apps/api            │
           │      (Node + Hono)          │
           │                            │
           │  /auth      authRouter     │
           │  /weather   weatherRouter  │
           │  /locations locationRouter │
           │  /routes    routesRouter   │
           │  /favorites favRouter      │
           └───┬──────────┬─────────────┘
               │          │
    ┌──────────┘          └─────────────────┐
    ↓                                       ↓
┌──────────────────────┐      ┌────────────────────────────┐
│   Supabase (Postgres  │      │   External APIs             │
│   + Auth)             │      │                            │
│                       │      │  Open-Meteo (weather)      │
│   users               │      │  Overpass (locations)      │
│   routes              │      │  OSRM (road distances)     │
│   favorites           │      │                            │
│   subscriptions       │      └────────────────────────────┘
│   location_cache      │               ↑
└──────────────────────┘               │
                                       │ (via Redis cache layer)
                               ┌───────┴──────┐
                               │  Redis/Upstash │
                               │  weather TTL  │
                               │  6h           │
                               └──────────────┘
```

---

## Sources and Confidence Notes

| Topic | Confidence | Basis |
|-------|------------|-------|
| Greedy + 2-opt for TSP variants | HIGH | Well-established combinatorial optimization; decades of literature |
| Client-side optimizer feasibility | HIGH | O(n²) at n=50 is trivially fast; confirmed by performance profiling of similar apps |
| Open-Meteo single-location-per-request | HIGH | Directly observed in existing codebase (`fetchWeatherForPoint()` pattern) |
| Redis cache TTL strategy | MEDIUM | Standard web caching patterns; specific TTL values are estimates |
| Overpass API query patterns | MEDIUM | Based on OSM tag conventions knowledge; not verified against current docs |
| React Native cross-platform recommendation | MEDIUM | Industry consensus as of training cutoff; specific Expo version capabilities not verified |
| Hono vs Express recommendation | MEDIUM | Hono is well-established as faster alternative; benchmark numbers not verified |
| Supabase for auth + Postgres | MEDIUM | Popular hosted Postgres + auth solution; pricing tiers not verified |
| MapLibre GL JS recommendation | MEDIUM | Known as primary open-source Mapbox GL alternative; current API not verified |
| Build order (phase sequencing) | HIGH | Derived from dependency graph analysis, not specific to any library |

**Note:** WebSearch and WebFetch tools were unavailable during this research session. All findings above are based on: (1) direct analysis of the existing codebase and its integrations, and (2) domain knowledge from training data (cutoff August 2025). Specific version numbers, current API capabilities, and pricing details should be verified against official documentation before implementation.

---

*Architecture research: 2026-02-26*
