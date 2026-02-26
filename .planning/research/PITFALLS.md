# Domain Pitfalls

**Domain:** Cross-platform weather/travel route optimization app (campervan)
**Project:** WeatherChaser
**Researched:** 2026-02-26
**Confidence note:** All external research tools (WebSearch, WebFetch) were unavailable for this session. All findings are drawn from training knowledge (cutoff August 2025) and detailed project context analysis. Confidence levels reflect this limitation — verify critical claims against official docs before acting.

---

## Critical Pitfalls

Mistakes that cause rewrites or major problems.

---

### Pitfall 1: Treating Cross-Platform as "Write Once, Run Everywhere" for Maps

**What goes wrong:** Teams choose React Native + Expo or Flutter expecting the map component to work identically on web, iOS, and Android. In reality, no single map library spans all three platforms well. `react-native-maps` uses Google Maps on Android and Apple Maps on iOS — neither is Leaflet (what the current MVP uses on web). `react-leaflet` is web-only. Flutter's `google_maps_flutter` plugin has different behavior per platform and no web equivalent. Teams discover this late and end up maintaining two map implementations.

**Why it happens:** Marketing for cross-platform frameworks emphasizes the happy path ("90% code sharing!"). Map components are almost always in the 10% that doesn't share cleanly.

**Consequences:**
- Separate map implementations for web vs. native = doubled map-related bug surface
- Inconsistent UX (different gestures, zoom behavior, marker styles per platform)
- Leaflet is not available in React Native — all existing Leaflet-based logic must be rewritten
- Route polylines, custom markers, and drawing tools all behave differently per library

**Prevention:**
- Decision phase: Explicitly choose map strategy before picking the cross-platform framework. Options: (a) React Native + react-native-maps for iOS/Android + separate web app with Leaflet, (b) Expo with WebView embedding Leaflet for all platforms (performance penalty), (c) Mapbox GL — the only library with native iOS/Android + web SDKs using a consistent API.
- Budget for map code to NOT be shared — plan two separate map module implementations from the start.
- Prototype the map component on all three target platforms before committing to the stack.

**Detection (warning signs):**
- Stack research shows "react-native-maps" as the solution without mentioning web
- Roadmap treats map rendering as a single shared component
- No separate "web map" vs "native map" module boundaries in architecture

**Phase:** Address in Phase 1 (Stack Selection / Architecture). This cannot be fixed late.

---

### Pitfall 2: O(N²) Route Optimization Exploding at Scale

**What goes wrong:** The current MVP uses a greedy nearest-neighbor algorithm (`optimizeRoute()` → `findNextBestLocation()`) that calls OSRM for each candidate at each step. With 10 locations, this is fast. With 50+ towns from Overpass (the planned upgrade), the number of OSRM calls balloons: at 50 locations, a naive approach makes up to 50×50 = 2,500 API calls per optimization run. OSRM's public instance has no guaranteed SLA and will throttle or fail. The UI freezes while waiting.

**Why it happens:** The MVP was built with small grids (9–49 points). Replacing grid points with real Overpass-sourced towns naturally increases the candidate set. The algorithm isn't changed to match the new scale.

**Consequences:**
- Route building times out or takes minutes instead of seconds
- OSRM public endpoint gets hammered, causing 429s or bans
- Mobile clients block the main thread if optimization runs client-side
- Users abandon before seeing results

**Prevention:**
- Cap candidate set: Never pass more than 20–30 locations to the route optimizer in a single run. Filter by weather score threshold before routing.
- Pre-compute distance matrix once before optimization, not per-step. OSRM supports multi-waypoint table requests (`/table` endpoint) — one API call for an N×N distance matrix.
- Use OSRM's `/table` endpoint instead of `/route` for each pair during optimization.
- Move route optimization to backend to avoid blocking the UI thread.
- For >20 stops, use 2-opt or simulated annealing, not pure greedy.

**Detection (warning signs):**
- Overpass query returning 50+ town results fed directly to route optimizer
- Route builder code still calling `calculateRoadDistance()` in a loop for each candidate
- No distance matrix pre-computation step

**Phase:** Address in Phase 2 (Route Optimization Rebuild). Needs dedicated performance research.

---

### Pitfall 3: Overpass API Returning Unusable Location Data

**What goes wrong:** Overpass queries for `place=town` and `place=city` within a radius return OSM nodes — but OSM data quality varies enormously by region. Common problems: (a) Many nodes lack names or have names only in local scripts. (b) "Towns" in rural Germany can be hamlets of 200 people — not viable campervan stops. (c) Overpass public instances have strict timeouts (default 25s) and will return partial results or timeout entirely for large radius queries. (d) Results include border crossings, motorway services, and industrial areas tagged as places. (e) Coordinates point to administrative centroids, not campsite-accessible locations.

**Why it happens:** OSM's tagging is community-contributed and inconsistently applied. The MVP's existing Overpass query filters by `place` type and population but doesn't handle the full range of data quality issues.

**Consequences:**
- Route optimizer tries to navigate to a field or a motorway junction
- Location names display as garbled characters or "Unknown"
- Query timeouts cause the location search step to fail silently
- Population filter misses good camping towns that haven't been tagged with population

**Prevention:**
- Add multiple filter layers: require `name` tag, minimum population (e.g., >500), and exclude `place=hamlet`, `place=isolated_dwelling`.
- Use `[out:json][timeout:60]` in Overpass queries and handle partial responses.
- Validate returned coordinates are on land (not water) using a simple bounding box check.
- Cache Overpass results — the same region query doesn't need to re-run on every session.
- Consider supplementing with the GeoNames database for more reliable European location data.
- Test specifically in rural eastern Germany and the Alps, where OSM data quality degrades fastest.

**Detection (warning signs):**
- Test runs in Bavaria returning villages with no German name
- Route stops appearing in water bodies or outside roads
- Overpass queries regularly timing out for 200km+ radius searches

**Phase:** Address in Phase 2 (Location Data). Needs phased testing with real query results.

---

### Pitfall 4: Nominatim Public Instance Usage Policy Violation

**What goes wrong:** The Nominatim public instance at nominatim.openstreetmap.org enforces a hard limit of 1 request per second per IP, forbids bulk geocoding, and requires a valid User-Agent with contact info. A production app with multiple concurrent users will easily exceed 1 req/s in aggregate — triggering bans. The MVP sets `User-Agent: WeatherChaser/1.0` but provides no contact URL, which technically violates the policy.

**Why it happens:** During development, a single developer running searches occasionally doesn't trigger the rate limit. The problem only manifests at scale or when Nominatim notices the User-Agent policy violation.

**Consequences:**
- IP banned from nominatim.openstreetmap.org — geocoding fails for all users simultaneously
- No fallback means the app completely breaks for location search
- Bans require manual review to lift

**Prevention:**
- Self-host Nominatim or switch to a commercial geocoding API (Mapbox Geocoding, Google Geocoding, Geoapify) before public launch.
- Alternatively, implement server-side geocoding proxy that respects the rate limit and caches results.
- Update User-Agent to include a contact URL immediately: `WeatherChaser/1.0 (contact@example.com)`.
- Add geocoding result caching: the same place name should not be re-geocoded on every search.

**Detection (warning signs):**
- Direct browser → nominatim.openstreetmap.org requests visible in production
- No server-side geocoding proxy
- User-Agent missing contact information

**Phase:** Address in Phase 1 (Backend Foundation) — replace with server-side proxy before any public exposure.

---

### Pitfall 5: OSRM Public Demo Server Is Not Production Infrastructure

**What goes wrong:** `router.project-osrm.org` is a demo instance run by the OSRM project for testing, not production use. It has no SLA, rate limits are unenforced but can be suspended at any time, and it is explicitly forbidden for production use in the OSRM documentation. The MVP uses it correctly for a prototype but the rebuild must not rely on it.

**Why it happens:** It works great during development. Teams forget it's a demo server until it goes down in production.

**Consequences:**
- Distance calculations fail silently (the MVP falls back to air distance, hiding the breakage)
- Route quality degrades: air-distance routes backtrack more than road-distance routes
- No notice before the demo server changes behavior or is taken down

**Prevention:**
- Self-host OSRM with EU road data (OpenStreetMap extracts from Geofabrik), or use a commercial routing API (Mapbox Directions, HERE Routing, Valhalla).
- For the free-tier approach: deploy OSRM on a small VPS with EU/Germany OSM extract. Memory requirement: Germany ~4GB RAM for pre-processed data.
- Use OSRM's `/table` endpoint (matrix routing) to batch distance calculations, reducing total API calls.

**Detection (warning signs):**
- Production code pointing to `router.project-osrm.org`
- No routing infrastructure in deployment plan

**Phase:** Address in Phase 1 (Infrastructure). Must be resolved before beta launch.

---

## Moderate Pitfalls

---

### Pitfall 6: Freemium Gating Added as an Afterthought

**What goes wrong:** Feature gating is designed late in development, after core features are already built without it in mind. The result: access checks are scattered across the codebase (UI layer, API layer, sometimes both, sometimes neither). Paywalls are easy to bypass by inspecting API calls. Free tier limits (e.g., "5 searches per day") are enforced client-side, which is trivially circumventable.

**Why it happens:** "We'll add monetization later" is the most common deferred decision in product development. It feels like it can be bolted on.

**Consequences:**
- Major refactor to add proper server-side enforcement of limits
- Inconsistent UX where some features are gated at UI, others aren't gated at all
- Revenue loss from free tier users exceeding limits without being converted to paid

**Prevention:**
- Design the feature flag/entitlement system in Phase 1 architecture, even if the freemium product tier isn't launched until later.
- All limits (forecast days, number of route stops, search frequency) must be enforced server-side, not client-side.
- Use a capability/entitlement model (user has `feature.extended_forecast` = true/false) rather than hardcoded if/else checks against plan names.
- UI gates should be cosmetic reinforcement only — the real gate is the API returning 403 for unauthorized requests.

**Detection (warning signs):**
- Paywall logic lives in React/JS components, not in backend middleware
- Plan names ("free", "premium") hardcoded in frontend conditionals
- No server-side enforcement tests in the test suite

**Phase:** Architecture decision in Phase 1; implementation in the Auth/Monetization phase.

---

### Pitfall 7: Weather API Costs Scaling Unexpectedly

**What goes wrong:** Open-Meteo's free tier (non-commercial use only, 10,000 requests/day per IP) is adequate for personal use. A production freemium app with multiple concurrent users will either exceed the free tier limits or, if using Open-Meteo's commercial API, face costs that scale with every weather point per user search. The current MVP fetches weather per-point (up to 49 points × 14 days), meaning one user search = 49 API calls minimum.

**Why it happens:** The free tier covers development perfectly. Cost modeling for production usage is deferred.

**Consequences:**
- API costs scale with users in a way that surprises founders
- Free tier violation triggers account suspension (not throttling — violation of non-commercial terms)
- At 100 daily active users × 3 searches × 49 points = 14,700 calls/day — already at free tier limit

**Prevention:**
- Model API costs at 100, 1,000, and 10,000 daily active users before choosing the weather API.
- Implement server-side weather data caching: same lat/lon/date combination cached for 1–3 hours (weather doesn't change that fast, forecasts update 1–4x per day).
- Reduce per-search API calls: batch multiple coordinates into a single Open-Meteo call using the multi-location endpoint, or cache aggressively by grid cell.
- Budget for commercial Open-Meteo API or alternative (Meteomatics, Tomorrow.io) at scale.
- Open-Meteo commercial API: ~$0.0001 per call — at 14,700 calls/day that's ~$0.44/day/$13/month. Cheap if cached. Expensive if not.

**Detection (warning signs):**
- Weather fetched fresh per user search with no server-side cache
- Single-coordinate endpoint used instead of batch endpoint
- No API cost modeling in planning documents

**Phase:** Architecture phase; caching implementation in backend phase.

---

### Pitfall 8: React Native + Expo Web Mode Is Not a True Web App

**What goes wrong:** Expo offers `expo-web` target, allowing a React Native app to compile to a web app. Teams use this expecting to get a full-featured web product. In practice, Expo Web is a compatibility shim — not all React Native libraries work on web, StyleSheet behavior differs from CSS, navigation looks native-app-like (not web-like), and SEO is non-existent. For WeatherChaser, where the web version needs to feel like a proper responsive web app (not a mobile app embedded in a browser), Expo Web may produce a subpar experience.

**Why it happens:** The "one codebase for everything" promise is compelling. The limitations aren't obvious until you're deep into development.

**Consequences:**
- Web version feels like a stretched mobile app
- Critical libraries (map libraries especially) may not have Expo Web support
- URL routing / deep linking requires different handling than native navigation
- SEO discovery is impossible, hurting organic growth

**Prevention:**
- Evaluate whether a proper web app vs. a PWA vs. Expo Web is acceptable for the use case before committing.
- Consider a monorepo approach (Turborepo/Nx) with shared business logic but separate UI: Next.js for web, React Native/Expo for iOS/Android.
- Test the map component on web via Expo Web specifically before committing to this architecture.

**Detection (warning signs):**
- Architecture doc shows single React Native codebase targeting all three platforms without discussing web quality tradeoffs
- No evaluation of "web version look and feel" in tech stack decision

**Phase:** Stack decision in Phase 1. Cannot be easily changed later.

---

### Pitfall 9: Offline-First Assumptions in Location Services

**What goes wrong:** Campervan travelers in rural Germany, Austria, and the Alps frequently have poor mobile connectivity. An app that makes live API calls for weather, geocoding, routing, and maps on every interaction becomes unusable in exactly the environments where it is most needed. If offline mode is deferred to v2, the app gets negative reviews from day one ("useless in the mountains").

**Why it happens:** Development happens on reliable WiFi. The target environment (rural camping, mountain passes) is not replicated in testing.

**Consequences:**
- Core use case (deciding where to go next while at a campsite with spotty 3G) is broken
- Bad reviews citing "needs internet constantly"
- Retrofitting offline mode later requires rearchitecting data sync

**Prevention:**
- Even if full offline mode is out of scope for v1, design for graceful degradation: cache the current route's weather data and map tiles for the next 48 hours.
- Implement service workers (web) / background fetch (native) early — adding them later requires re-thinking the data layer.
- Display a clear "you are offline, showing cached data from X hours ago" message rather than silently failing.
- Pre-cache map tiles for the route region at medium zoom levels.

**Detection (warning signs):**
- No mention of service workers or tile caching in architecture
- All weather data fetched on demand, no local caching
- Testing only done on reliable WiFi

**Phase:** Architecture decision in Phase 1; implementation in UX/polish phase with note about offline limitations.

---

### Pitfall 10: Authentication Complexity Underestimated

**What goes wrong:** Teams underestimate the surface area of auth: email verification flows, password reset, session expiry, refresh token rotation, GDPR data deletion requests, account linking (if adding social login later), and the security implications of JWTs stored in mobile apps. Building auth from scratch adds 2–4 weeks of work and creates security debt. Alternatively, teams add Supabase Auth or Firebase Auth but don't account for the lock-in implications.

**Why it happens:** "Auth is just a login form" is a common underestimation.

**Consequences:**
- Significant time sink in early phases
- Security vulnerabilities from DIY auth
- GDPR compliance gaps (right to erasure is easy to miss)

**Prevention:**
- Use a managed auth provider (Supabase Auth, Clerk, Auth0) from day one — don't build auth from scratch.
- For EU users: GDPR compliance is non-optional. Choose an auth provider with EU data residency.
- Design the user data model (what's stored, where, for how long) before writing any auth code.
- Account for the mobile app case: secure token storage on iOS (Keychain) and Android (Keystore) is different from browser cookies.

**Detection (warning signs):**
- Auth implementation planned as "a few days of work"
- No GDPR data deletion flow in requirements
- DIY JWT implementation planned

**Phase:** Address in Phase 2 (User Accounts). Use managed provider, not DIY.

---

### Pitfall 11: Mobile Map Memory and Rendering Performance

**What goes wrong:** Rendering 49 markers (the current MVP's max grid) with custom HTML marker popups is acceptable in desktop Leaflet. On mobile (via React Native WebView or native map SDK), 50+ interactive markers with weather data overlaid causes: frame drops during pan/zoom, high memory usage (each HTML marker is a full DOM node), and battery drain. In Flutter's `google_maps_flutter`, marker bitmap regeneration on every zoom is notoriously slow.

**Why it happens:** Mobile map performance is profoundly different from desktop browser performance. The desktop MVP works fine, creating a false sense of safety.

**Consequences:**
- Map panning becomes janky on mid-range Android devices
- App crashes on older iPhones due to memory pressure
- Users abandon the map view before seeing results

**Prevention:**
- Cluster markers at low zoom levels (MarkerClusterer pattern) — only show individual markers when zoomed in.
- Use native marker primitives (not HTML custom markers) in native apps.
- Cap visible markers at any one time: show top 20 scored locations, not all 49.
- Benchmark on a mid-range Android device (not just iPhone 15 Pro) during development.
- For the route polyline: simplify geometry for zoom levels below 10.

**Detection (warning signs):**
- Architecture shows all weather points rendered as individual HTML markers on mobile
- No marker clustering in mobile map design
- Performance testing only on flagship devices

**Phase:** Address in Phase 3 (Mobile UI). Benchmark early and often.

---

### Pitfall 12: MVP → App Transition: State Management Chaos

**What goes wrong:** The current MVP stores all state in a single `WeatherChaser` class with properties directly mutated throughout. This works for a static app. In a React/React Native app with multiple screens (search, map, itinerary, settings, user account), global mutable state without a proper state management pattern leads to: stale data displayed in one screen while another has updated, race conditions between async API calls, and impossibly tangled debug sessions.

**Why it happens:** Porting the MVP logic "as-is" into the new framework is tempting — it already works! — but the class-mutation pattern doesn't translate to React's rendering model.

**Consequences:**
- Map shows old route while itinerary shows new one
- Search re-runs unexpectedly when navigating between screens
- Weather data is re-fetched on every screen transition

**Prevention:**
- Design state management before porting any MVP logic. Recommended: Zustand (lightweight) or React Query + Zustand combination (server state + UI state separated).
- Never port the monolithic class directly. Extract pure functions from `app.js` (scoring, route optimization algorithms) and port those. Build new state management around them.
- Separate concerns explicitly: server state (weather data, geocoding results) in React Query/SWR; client UI state (selected route, filter settings) in Zustand.

**Detection (warning signs):**
- Architecture shows a "WeatherChaser" class with methods ported directly
- Single global state object without selectors
- No distinction between server state and UI state

**Phase:** Architecture in Phase 1. Critical to get right before any feature work.

---

## Minor Pitfalls

---

### Pitfall 13: Weather Data Interpretation for Non-Technical Users

**What goes wrong:** The current scoring algorithm aggregates temperature, rain, sun, and wind into a single 0–100 score. Users don't understand why their favourite beach destination scores 45. Confusing scoring leads to low trust and user churn — especially in the German market, which has high expectations for data transparency.

**Prevention:**
- Always show the component scores (rain: 80/100, sun: 40/100) alongside the total score.
- Explain the weights ("Sun hours matter most — 30% of score") in an accessible tooltip.
- Allow users to adjust weights — this also builds engagement.

**Phase:** UX design phase.

---

### Pitfall 14: Forecast Horizon Mismatch with Trip Planning

**What goes wrong:** Open-Meteo provides up to 16-day forecasts. Weather accuracy degrades significantly after day 7. Users planning 2-week trips see confident-looking scores for days 8–14 that are essentially noise. This creates false expectations — users drive to a location expecting sun based on a 12-day forecast, get rain, and blame the app.

**Prevention:**
- Cap displayed forecast confidence visually: show lower opacity / "less reliable" indicators for forecasts beyond day 7.
- Clearly label forecast reliability windows in the UI ("Reliable: days 1–7, Indicative: days 8–14").
- Document this limitation in onboarding.

**Phase:** UX design phase.

---

### Pitfall 15: EU GDPR and App Store Compliance Surprises

**What goes wrong:** iOS App Store review and Google Play Store review have specific requirements around location data, user consent, and privacy policy. For EU users, GDPR requires explicit consent for any persistent data. These requirements can delay app store approval by weeks and require UX changes late in development.

**Prevention:**
- Write the privacy policy and data processing terms before submitting to app stores.
- Implement proper consent flows (cookie banner / location permission dialogs) from the start.
- Use `expo-location` or equivalent with appropriate permission explanations that satisfy App Store review.
- Ensure the auth provider has EU data residency (relevant for GDPR Article 44 data transfers).

**Phase:** Pre-launch phase.

---

### Pitfall 16: Overpass API Timeout in Production

**What goes wrong:** The public Overpass API instances (overpass-api.de, overpass.kumi.systems) are community resources with variable load. Complex queries for all towns within a 500km radius can take 30–60 seconds or timeout entirely during peak hours.

**Prevention:**
- Cache Overpass results server-side (town data doesn't change day-to-day).
- Set a conservative timeout and show partial results if the query is slow.
- Consider pre-generating a database of European towns with population and coordinates from a GeoNames or Wikidata dump — avoiding live Overpass queries entirely for the "show all towns in region" use case.

**Phase:** Backend phase.

---

### Pitfall 17: App Store Review Rejection for Map/Location Features

**What goes wrong:** Apps using location data for anything other than the user's immediate benefit face heightened App Store scrutiny. If WeatherChaser requests location access but the use case isn't crystal-clear in the permission dialog, it gets rejected. "Always on" location access is particularly scrutinized.

**Prevention:**
- Request location permission only at the moment it's needed ("Find my current location" button tap).
- Use "when in use" permission, not "always on".
- Write a clear permission purpose string: "Used to set your trip starting point."
- Never request location permission on app first launch without explanation.

**Phase:** Mobile platform integration phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Stack selection | Map library doesn't span all 3 platforms | Prototype map on all targets before committing (Pitfall 1) |
| Architecture | Monolithic MVP state ported directly to React | Separate server state / UI state from day one (Pitfall 12) |
| Backend foundation | Nominatim / OSRM public APIs used in production | Self-host or proxy before beta launch (Pitfalls 4, 5) |
| Route optimization | OSRM called per-candidate in a loop | Use /table endpoint; pre-compute distance matrix (Pitfall 2) |
| Location data (Overpass) | Poor OSM data quality for rural locations | Multi-layer filtering + fallback to GeoNames (Pitfall 3) |
| Freemium implementation | Feature gates are client-side only | Server-side enforcement from day one (Pitfall 6) |
| User accounts / auth | DIY auth or GDPR gaps | Use managed auth provider with EU residency (Pitfall 10) |
| Mobile map UI | 50+ markers tank performance on Android | Marker clustering + native primitives (Pitfall 11) |
| Weather API scaling | Free tier exceeded by concurrent users | Server-side cache + batch endpoint (Pitfall 7) |
| Offline/connectivity | App unusable in rural campsites | Cache current route data + tiles for 48h (Pitfall 9) |
| App store submission | Location permission rejection or GDPR non-compliance | Write privacy policy + consent flows pre-submission (Pitfalls 15, 17) |
| Cross-platform web target | Expo Web is not a real web app | Evaluate monorepo + separate Next.js web target (Pitfall 8) |

---

## Sources

**Note:** All external research tools (WebSearch, WebFetch) were unavailable during this research session. The following is a list of sources that should be verified manually to raise confidence of key findings:

- Open-Meteo Terms of Service: https://open-meteo.com/en/terms — verify free tier limits and commercial requirements
- Nominatim Usage Policy: https://operations.osmfoundation.org/policies/nominatim/ — verify 1 req/s limit and User-Agent requirements
- OSRM Demo Server Policy: https://github.com/Project-OSRM/osrm-backend/wiki — verify demo server production-use prohibition
- Overpass API documentation: https://wiki.openstreetmap.org/wiki/Overpass_API — verify timeout behavior and query limits
- React Native Maps: https://github.com/react-native-maps/react-native-maps — verify web support status
- Expo Router web support: https://docs.expo.dev/router/introduction/ — verify web limitations
- GDPR Art. 44 on data transfers: https://gdpr-info.eu/art-44-gdpr/ — verify EU data residency requirements for auth providers

**Confidence by domain:**

| Domain | Confidence | Rationale |
|--------|------------|-----------|
| Cross-platform map pitfalls | MEDIUM | Well-documented ecosystem pattern; verify current React Native Maps web support |
| Route algorithm complexity | HIGH | Mathematical; O(N²) analysis is definitive |
| Overpass data quality | MEDIUM | Known OSM community issue; specifics depend on current EU coverage |
| Nominatim/OSRM policy | MEDIUM | Policy wording may have changed since Aug 2025 — verify before launch |
| Freemium implementation | HIGH | Universal software pattern; not time-sensitive |
| Weather API cost modeling | MEDIUM | Open-Meteo pricing may have changed — verify current commercial tier |
| Auth complexity | HIGH | Well-established domain; GDPR requirements are stable law |
| Mobile map performance | MEDIUM | Device landscape changes; benchmark on current hardware |
| State management | HIGH | React rendering model is stable; well-established pattern |
