# Technology Stack

**Project:** WeatherChaser — Cross-Platform Campervan Weather Route Optimizer
**Researched:** 2026-02-26
**Research basis:** Training data through August 2025. Note: WebSearch and WebFetch were unavailable during this research session. All findings are from training data. Version numbers should be verified against official docs before pinning.

---

## Recommended Stack

### Cross-Platform Framework

**Recommendation: Expo (React Native) — single codebase for web + iOS + Android**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Expo SDK | 51+ (verify current) | Cross-platform runtime | Ships web (via React Native Web), iOS, and Android from one codebase. Largest ecosystem, best map library support, familiar JS/TS for anyone who knows React. |
| React Native | 0.74+ | UI framework | Underlying engine for Expo. Native rendering on mobile, DOM rendering on web. |
| TypeScript | 5.x | Language | Type safety catches bugs at build time. Essential for a multi-platform project with complex data models. |
| React Native Web | bundled via Expo | Web rendering | Expo's Metro bundler handles web target automatically — same React components render to DOM on web. |

**Why Expo over alternatives:**

Flutter would require Dart (unfamiliar language, smaller library ecosystem for maps/weather), and its map story in 2025 is weaker than RN's — `flutter_map` supports MapLibre but lags behind `@rnmapbox/maps` in maturity. Separate codebases (web + native Swift/Kotlin) are the highest-quality option but 3x the development cost for a solo/small team. Expo Router v3 (file-based routing) makes web + mobile navigation consistent. Expo EAS Build/Submit handles App Store and Play Store publishing from CI.

**Confidence: MEDIUM** — Expo + RN is the dominant choice for small teams targeting web+iOS+Android simultaneously. Flutter adoption is growing but map/routing library ecosystem still trails. Version numbers need verification before pinning.

---

### Navigation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Expo Router | 3.x | File-based routing | Works on web (URL-based) and mobile (native stacks/tabs) from the same file structure. Eliminates need for separate web router. |

---

### Maps

**Recommendation: MapLibre GL JS (web) + @rnmapbox/maps (native) via Mapbox-compatible tile source**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| MapLibre GL JS | 4.x | Web map rendering | Open-source fork of Mapbox GL JS. Vector tiles, GPU-accelerated, free. Works with any tile source. Drop-in replacement for Mapbox GL on web. |
| @rnmapbox/maps | 10.x | iOS + Android maps | The standard React Native MapLibre/Mapbox-compatible SDK. Native rendering, same GL-based visual style as MapLibre web. Requires a tile source (see below). |
| MapTiler (tile source) | — | Map tiles + geocoding | Best free tier for MapLibre-compatible vector tiles. 100K tiles/month free. EU-hosted option. OR use OpenMapTiles self-hosted. |

**Why not Leaflet:** Leaflet is web-only. It does not have a maintained React Native equivalent. The MVP uses Leaflet but rebuilding for cross-platform requires abandoning it. MapLibre provides nearly identical visual results with GL rendering.

**Why not Google Maps:** Requires per-use billing (no free tier at scale), policy restrictions on caching, mandatory Google branding. Poor fit for a privacy-conscious EU product.

**Why not Mapbox:** Mapbox GL JS v2+ is no longer open source (proprietary license). MapLibre is the community fork of the last open-source version. For a product that values open APIs, MapLibre is correct.

**Why not react-native-maps:** Uses Google Maps (Android) and Apple Maps (iOS) — inconsistent visual style cross-platform, no vector tile support, limited to what each platform SDK exposes. Cannot use custom weather overlays as easily.

**Confidence: MEDIUM-HIGH** — MapLibre + @rnmapbox/maps is the established open-source path. The tile source choice (MapTiler vs self-hosted) should be validated for EU-specific SLA and cost at scale.

---

### Backend

**Recommendation: Supabase**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | hosted (latest) | Backend-as-a-service: auth, database, storage, Edge Functions | Postgres-backed, open source, generous free tier (500MB DB, 1GB storage, 50K MAU auth). Row Level Security (RLS) enforces data isolation per user natively in Postgres. EU region available (Frankfurt). REST API auto-generated from schema. Real-time subscriptions if needed later. |
| Supabase Auth | bundled | User accounts, OAuth, magic links | Handles email/password, OAuth (Google, Apple required for iOS), JWT tokens. Apple Sign-In is mandatory for iOS App Store if any OAuth is offered — Supabase supports it. |
| Supabase Edge Functions | bundled (Deno) | Server-side logic | For subscription webhooks (Stripe), complex route optimization that shouldn't run on client, weather pre-fetching. Avoid running heavy computation on device. |

**Why Supabase over Firebase:**
- Firebase (Firestore) is a NoSQL document store — poor fit for relational data (users → routes → stops → weather scores). Complex queries become expensive.
- Supabase is Postgres: JOIN across users, routes, and weather snapshots naturally. Easier to write migration scripts.
- Firebase pricing is consumption-based with notorious surprise bills at scale. Supabase has predictable tiers.
- Supabase is open source and self-hostable — no vendor lock-in risk.
- Both offer similar auth capabilities.

**Why not custom backend (Node/Express/FastAPI):**
- Auth, RLS, API generation, and file storage would each need to be built from scratch.
- For a small team moving fast to MVP, Supabase delivers this infrastructure in days, not months.
- Can always self-host or migrate later since Supabase is standard Postgres underneath.

**Confidence: MEDIUM-HIGH** — Supabase is well-established for this class of product. EU region availability verified via training data. Specific pricing tier details should be re-verified at integration time.

---

### Database

**Recommendation: Supabase Postgres (managed)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 15+ (via Supabase) | Primary data store | Relational model fits routes (ordered list of stops), user preferences (JSONB), subscription state. PostGIS extension (available in Supabase) enables native geographic queries — useful for spatial filtering of routes and weather points. |
| PostGIS | via Supabase extension | Geospatial queries | ST_Contains, ST_Distance for finding routes in a region. Enables efficient bounding box queries instead of fetching all user routes. |

**Schema shape (high-level):**
```
users (id, email, created_at, subscription_tier)
routes (id, user_id, name, region_geom, trip_days, created_at, route_data jsonb)
favorites (id, user_id, place_name, lat, lon, notes)
user_preferences (user_id, home_lat, home_lon, weather_weights jsonb, max_stay_days)
```

**Why not SQLite / local-only:** User accounts require server-side persistence. SQLite on device is appropriate for offline caching (future phase) but not as the primary store.

**Why not MongoDB/DynamoDB:** Route data has natural relational structure. Weather score preferences are JSON blobs that Postgres JSONB handles well. No need for a document store.

**Confidence: HIGH** — Postgres + Supabase is the standard pairing for this architecture. PostGIS availability in Supabase is established.

---

### Weather APIs

**Recommendation: Open-Meteo as primary, with Tomorrow.io as premium tier option**

| API | Tier | Forecast Horizon | Key Variables | Cost | Confidence |
|-----|------|-----------------|---------------|------|------------|
| Open-Meteo | Free (primary) | 16 days | Temp, precipitation, sunshine duration, wind, UV, cloud cover, visibility | Free (no key, rate-limited generously) | HIGH |
| Open-Meteo Commercial | Paid ($30-$50/mo est.) | 16 days | Same + SLA, higher rate limits | Low cost commercial plan | MEDIUM |
| Tomorrow.io | Freemium premium option | 5 days (free), longer on paid | Hyperlocal 1km resolution, road conditions, particulates | Free: 25 calls/day — essentially paid-only at scale | MEDIUM |
| Meteomatics | Enterprise | 10+ days | Highest accuracy (ECMWF ensemble), multiple model blending | Expensive, enterprise only | MEDIUM |
| OpenWeatherMap | Freemium | 5 days free, 16 days paid | Standard variables | $40+/month for 16-day | MEDIUM |

**Decision: Keep Open-Meteo as free-tier backbone.**

Open-Meteo's strengths for this product:
1. **No API key** — zero friction for development and no billing to manage on free tier
2. **16-day forecast horizon** — competitors' free tiers stop at 5-7 days; WeatherChaser needs 7-14 day planning
3. **Hourly granularity available** — current MVP uses daily; hourly unlock per-day timing optimization
4. **Multiple weather models** — Open-Meteo aggregates ECMWF, GFS, ICON (Germany's own model, best for EU) — ICON model particularly accurate for German/EU market
5. **EU-based** — GDPR-friendly, no US data routing required
6. **All needed variables exist** — temperature, precipitation, sunshine_duration, windspeed, UV index, cloud_cover, visibility all available

**Freemium strategy:** Open-Meteo free for all users. Premium subscription could unlock: longer forecast windows (beyond 7 days), hourly resolution (vs daily), or multiple weather models per location. If accuracy becomes a differentiator, add Tomorrow.io as a premium tier upgrade.

**What NOT to use:**
- OpenWeatherMap: 5-day free limit is a dealbreaker. Paid tier is not competitive with Open-Meteo quality for EU.
- WeatherAPI.com: Similar limitations. Not worth the complexity.
- Weather.gov: US only.

**Confidence: MEDIUM** — Open-Meteo free tier capabilities are well-established from training data. Pricing of commercial tiers and Tomorrow.io specifics need verification at decision time.

---

### Routing and Route Optimization

**Recommendation: OSRM (public API) for distance calculations, custom greedy optimizer for route sequence**

| Technology | Purpose | Why |
|-----------|---------|-----|
| OSRM public API | Road distance/duration between two points | Already integrated in MVP, free, no key required. Reliable for EU road network. |
| Valhalla (self-hosted, future) | Road routing at scale | If OSRM public API becomes a bottleneck at scale, Valhalla is a self-hostable alternative with comparable accuracy and an isochrone API. |
| Custom greedy optimizer (in-house) | Multi-stop route sequencing | No library solves "maximize weather score while minimizing backtracking" — this is a domain-specific optimization. Use a greedy nearest-neighbor heuristic (already in MVP) with improvements: pre-computed distance matrix, configurable weights. |
| OR-Tools (Google, optional future) | TSP/VRP solver | For exact route optimization (Traveling Salesman Problem variant). Only necessary if >20 stops. Overkill for MVP but good to know about. |

**Why not Google Directions API:** Requires billing account and API key. OSRM is free, accurate for EU roads, and already proven in the MVP.

**Why not GraphHopper:** Similar capability to OSRM, but OSRM is already integrated. No migration needed.

**Pre-computation strategy:** The MVP's O(n²) OSRM calls per route build is a known performance bottleneck. Fix: compute a full distance matrix for all candidate stops once per search, cache it, then run route optimization against the cached matrix. Reduces OSRM calls from O(n²×days) to O(n²) per session.

**Confidence: MEDIUM** — OSRM public API reliability is well-established. OR-Tools licensing and suitability for this use case should be verified if that path is taken.

---

### Authentication

**Recommendation: Supabase Auth (already bundled with backend recommendation)**

| Technology | Purpose | Notes |
|-----------|---------|-------|
| Supabase Auth | Email/password, magic link, OAuth | Handles JWT issuance, refresh tokens, RLS integration |
| Apple Sign-In (via Supabase) | iOS App Store requirement | App Store mandates Apple Sign-In if any 3rd-party OAuth offered |
| Google Sign-In (via Supabase) | User convenience | Largest OAuth provider |

**What NOT to use:** Auth0/Clerk/Okta — all add per-MAU cost on top of Supabase. Since Supabase Auth is included, adding a separate auth vendor is pure overhead.

**Confidence: HIGH** — Supabase Auth capabilities and Apple Sign-In requirement for App Store are well-established.

---

### Subscription / Payments

**Recommendation: Stripe + Stripe Billing**

| Technology | Purpose | Why |
|-----------|---------|-----|
| Stripe | Payment processing + subscription management | Industry standard. React Native Stripe SDK available. Webhook integration with Supabase Edge Functions to update user subscription tier in DB. |
| Stripe Billing | Recurring subscriptions | Handles plan upgrades, downgrades, trial periods, proration. |
| Revenue Cat (alternative) | Mobile subscription management | Better for App Store / Play Store in-app purchases (IAP). Consider if monetizing primarily through app stores rather than web. |

**Important:** App Store and Play Store each take 30% (15% after year 1) on in-app purchases. If users can subscribe via the web app (Stripe), iOS rules still require offering Apple IAP for in-app upgrades. Many apps route users to the web for subscriptions to avoid platform fees. This is a legal/business decision, not a tech one.

**Confidence: MEDIUM** — Stripe is the standard. Revenue Cat vs direct Stripe for mobile is an ongoing industry tradeoff. App Store policy details should be verified at monetization phase.

---

### Hosting

**Recommendation: Vercel (web app) + Supabase managed cloud (backend)**

| Component | Host | Why |
|-----------|------|-----|
| Web app (Expo Web / Next.js if extracted) | Vercel | Zero-config deployment, edge CDN, free tier, GitHub integration, excellent for React-based apps |
| iOS app | Apple App Store (via Expo EAS Submit) | Required. EAS handles build + submission. |
| Android app | Google Play Store (via Expo EAS Submit) | Required. EAS handles build + submission. |
| Backend / database | Supabase cloud | Managed Postgres, auth, edge functions. EU region (Frankfurt). Free tier: 500MB DB, 2 projects. |
| Static assets / images | Supabase Storage or Cloudflare R2 | Route thumbnails, user avatars. R2 is free egress. |

**Why not AWS/GCP/Azure:** Overkill infrastructure overhead for a startup-phase product. Supabase + Vercel covers all needs without DevOps burden. Can migrate to AWS when scale demands it.

**Why not Railway/Render for backend:** Supabase is already handling the full backend. A separate Node.js server is only needed for heavy compute (route optimization at scale), which can live in Supabase Edge Functions until proven insufficient.

**Confidence: MEDIUM** — Vercel + Supabase is the dominant modern stack for this class of product. Pricing tiers need verification at launch time.

---

### Geocoding

**Recommendation: Nominatim for free tier, Mapbox Geocoding API for premium/production accuracy**

| Technology | Purpose | Notes |
|-----------|---------|-------|
| Nominatim (OpenStreetMap) | Location search, coordinate lookup | Free, no key, no SLA. Adequate for MVP. Rate limit: 1 req/sec. |
| Mapbox Geocoding API | Production geocoding with better accuracy/speed | $0.75/1000 requests after free 100K/month. Better for EU address resolution. Requires API key. |

**Note:** If MapTiler is chosen as the tile source, their geocoding API comes bundled and avoids a separate Mapbox relationship.

**Confidence: MEDIUM** — Nominatim limitations are well-established. Mapbox/MapTiler pricing needs current verification.

---

### State Management (Frontend)

**Recommendation: Zustand**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x | Client-side state management | Minimal boilerplate vs Redux. Works identically on web and React Native. Handles: current route, search state, user preferences, map viewport. Simpler than Redux Toolkit for a project of this size. |
| React Query (TanStack Query) | 5.x | Server state / data fetching | Caches Supabase queries, handles loading/error states, background refetching. Eliminates manual loading state management. |

**What NOT to use:** Redux — too much boilerplate for this project size. Context API alone — will cause excessive re-renders with complex map+route state. MobX — smaller community in RN ecosystem.

**Confidence: MEDIUM-HIGH** — Zustand + React Query is the established pairing for React/RN projects as of 2025.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Expo Location | bundled | GPS coordinates for "start from here" feature | When adding "use my location" to route start |
| react-hook-form | 7.x | Form validation | Registration, login, trip configuration forms |
| Zod | 3.x | Schema validation | Validate API responses, form inputs, route configs |
| date-fns | 3.x | Date formatting and manipulation | Trip date ranges, itinerary display, weather date labels |
| @shopify/flash-list | 1.x | High-performance lists (RN) | Replacing FlatList for route itinerary and results lists on mobile |
| react-native-reanimated | 3.x | Smooth animations | Map transitions, loading states, weather score animations |
| Expo Notifications | bundled | Push notifications (future) | Weather alerts, route reminders. Out of scope for v1 but include EAS setup |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Cross-platform | Expo (React Native) | Flutter | Dart ecosystem smaller; map libraries less mature for this use case; larger app size; team unfamiliarity risk |
| Cross-platform | Expo (React Native) | Separate web + native codebases | 3x development cost for equivalent features; no shared business logic |
| Maps | MapLibre + @rnmapbox | react-native-maps | Google Maps/Apple Maps underneath — inconsistent cross-platform, no vector tiles, harder weather overlays |
| Maps | MapLibre + @rnmapbox | Leaflet | Web-only, no React Native equivalent, cannot reuse on mobile |
| Backend | Supabase | Firebase | NoSQL poor fit for relational data; pricing unpredictability; US-only by default |
| Backend | Supabase | Custom Node.js + Express | Build time cost; auth + RLS from scratch; not justified at current scale |
| Auth | Supabase Auth | Auth0 / Clerk | Per-MAU cost stacks on top of backend; redundant since Supabase Auth is included |
| State | Zustand | Redux Toolkit | Excessive boilerplate for this scale; Zustand is idiomatic in 2025 RN projects |
| Payments | Stripe | RevenueCat | RevenueCat better for pure app store IAP; Stripe better if web subscriptions are primary path |
| Weather | Open-Meteo | OpenWeatherMap | 5-day free limit unusable for trip planning; EU model (ICON) inferior to Open-Meteo for Germany |
| Routing | OSRM public | Google Directions API | Billing required; OSRM is already integrated and accurate for EU |
| Hosting | Vercel + Supabase | AWS / GCP | Infrastructure overhead not justified for current scale; can migrate later |

---

## Installation

```bash
# Bootstrap Expo project with TypeScript
npx create-expo-app@latest weather-chaser --template expo-template-blank-typescript
cd weather-chaser

# Navigation
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar

# Maps
npm install @rnmapbox/maps maplibre-gl

# Backend client
npm install @supabase/supabase-js

# State management
npm install zustand @tanstack/react-query

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Utilities
npm install date-fns

# React Native performance
npx expo install @shopify/flash-list react-native-reanimated

# Payments
npm install @stripe/stripe-react-native
```

---

## Version Verification Required

The following versions were cited from training data (through August 2025) and MUST be verified before pinning in package.json:

| Package | Claimed Version | Verify At |
|---------|----------------|-----------|
| expo | 51+ | https://expo.dev/changelog |
| @rnmapbox/maps | 10.x | https://github.com/rnmapbox/maps |
| maplibre-gl | 4.x | https://maplibre.org/news |
| @supabase/supabase-js | latest | https://supabase.com/docs/reference/javascript |
| zustand | 4.x | https://github.com/pmndrs/zustand |
| @tanstack/react-query | 5.x | https://tanstack.com/query/latest |
| react-hook-form | 7.x | https://react-hook-form.com |
| expo-router | 3.x | https://docs.expo.dev/router/introduction |

---

## Key Constraints Honored

1. **EU/Germany market first** — Open-Meteo uses ICON weather model (German Weather Service, DWD) which is the most accurate model for Central Europe. MapTiler has EU-hosted infrastructure. Supabase has Frankfurt region.

2. **Prefer free/open APIs** — Open-Meteo (free), Nominatim (free), OSRM (free), Overpass (free) are all preserved. MapLibre is open source. Only Supabase and (optionally) MapTiler introduce commercial services, both with generous free tiers.

3. **Cross-platform from day one** — Expo + MapLibre + Supabase all have first-class cross-platform support. No component needs to be rewritten for each platform.

4. **Freemium model supported** — Supabase RLS enforces feature gating at database level. Stripe handles subscription lifecycle. Subscription tier stored on `users` table, checked in Edge Functions before returning premium data.

---

## Sources

- Training data through August 2025 (PRIMARY — no live web access during this session)
- Existing codebase analysis: `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md`
- Note: All external URLs, pricing, and version numbers require verification before implementation

**Overall confidence: MEDIUM** — Technology choices are well-grounded in established patterns as of training cutoff. Specific versions and pricing tiers must be verified against current official documentation before implementation begins.
