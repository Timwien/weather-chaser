# Phase 1: Core Algorithm + Route Planner Web - Research

**Researched:** 2026-02-27
**Domain:** Turborepo monorepo, TypeScript algorithm library, MapLibre GL JS, Open-Meteo, OSRM, Overpass API, React SPA
**Confidence:** MEDIUM-HIGH (all core libraries verified via official docs; external service policies confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Design System**
- Light theme with strong color accent(s) — white base, accent for CTAs and interactive elements
- No gradients (except weather score gradient), no emojis
- Icons over emoji throughout
- Localization-ready from day one: all user-facing strings use i18n keys (never hardcoded strings)
- Design should feel "fancier than Google Maps" — clean, minimal, premium — not AI-generated-looking
- Reference aesthetics: Linear, Airbnb — clean hierarchy, strong brand color, restrained use of decoration

**Entry Point (Shared by Both Modes)**
- Map-first layout: full-screen map as the base, floating config panel overlaid (Google Maps pattern)
- The config panel is the single entry point for both Route Planner and Weather Finder
- Three setup inputs visible in the panel:
  1. Trip date — click opens date picker (from/to range). Special option: "Day trip" → select morning, afternoon, or full day
  2. Location(s) — user types one or more place names. If one place: radius selector appears. "Pick on map" option opens map interaction: select pins, draw one or more areas, or set a place + adjust radius by typing km or dragging the circle
  3. Criteria — user picks most important weather criteria (multi-select): sun (most), precipitation (least), temperature (warmest), wind (least), etc.
- After filling the three inputs, two CTA buttons appear: "Find Best Route" and "Find Best Weather" (exact copy TBD)
- Mode selection happens via CTAs, not tabs or toggles — the shared config comes first

**Route-Specific Config**
- Route Planner extra inputs (max-stay, start point, must-visit stops) appear after tapping "Find Best Route" — as a second config step or expanded panel
- Claude's discretion on exact layout of this second step (inline expansion, modal, slide-in panel)

**Itinerary Display**
- Timeline / vertical flow layout — not cards or rows
- Each stop in the timeline:
  - Day number(s) in a bubble (e.g. "Day 1–2")
  - City name only (no region/state)
  - Driving distance to next stop shown between stops in thinner/lighter text (e.g. "82km")
  - Weather score as a continuous gradient color (red → yellow → green, not fixed colors) with a score bar and breakdown (sun/rain/temp/wind icons + contribution) visible inline — no tap-to-expand needed
- Summary bar at top of itinerary: total days, total distance, avg score (compact)
- Summary stats card at bottom of itinerary: detailed breakdown

**Map <-> List Layout**
- Desktop: Map fills the background/majority of screen; itinerary timeline is an overlay panel on the side (left or right — Claude's discretion)
- Mobile: Two separate screens — itinerary is the default/first view; map is the second view (tab or button to switch)
- Click/tap a stop on map: popup appears on map (name + score) AND itinerary scrolls to that stop
- Route line: gradient line — color shifts from red to green along the route based on weather score of each segment
- Stop markers: numbered circles — color follows the score gradient (red for low, green for high)

**Loading States**
- While optimizing: show progress steps — "Finding towns...", "Fetching weather...", "Optimizing route..." — user sees what's happening rather than a generic spinner
- Map is visible throughout (doesn't go blank during loading)

**Edge Cases**
- Too few towns / no results: Claude decides UX — friendly message with actionable suggestion (expand radius, draw larger area)
- All locations have poor weather: Show results anyway with a visible warning ("Weather looks unfavorable across this region for these dates")
- Weather data unavailable for some locations: Claude decides — exclude silently or show with "data unavailable" indicator

### Claude's Discretion
- Exact layout of route-specific second config step (max-stay, must-visit, start point)
- Empty/error state UX details
- Exact spacing, typography scale, component-level design decisions
- Mobile map-to-itinerary transition animation
- Loading skeleton details
- Color for brand accent (primary CTA color)

### Deferred Ideas (OUT OF SCOPE)
- Weather Finder results UI (ranked list + map heatmap, morning/afternoon toggle, distance filter) — Phase 2
- User accounts, save/favorite — Phase 3
- Custom weather weight sliders (premium) — Phase 4
- Native iOS/Android app UI — Phase 5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-05 | Turborepo monorepo with shared TypeScript core library (scoring + optimization) used by web and mobile apps | Turborepo compiled package pattern with `tsc`; `packages/core` as internal compiled package |
| WTHR-01 | App fetches hourly weather data via Open-Meteo API (14-day horizon) | Open-Meteo supports 16-day forecast; hourly variables confirmed: `temperature_2m`, `precipitation`, `sunshine_duration`, `wind_speed_10m` |
| LOC-01 | Route stops are real named towns and villages — not arbitrary grid points | Overpass API with `place=town/village/city` filter; proxy required for production |
| LOC-02 | User can search by region or place name to define the search area | Nominatim geocoding for place-to-bbox; proxy required (1 req/s limit on public server) |
| LOC-03 | User can draw a custom polygon on the map | `@watergis/maplibre-gl-terradraw` plugin handles freehand + polygon draw modes in MapLibre |
| ENTRY-01 | User defines a search area (by region/place name, radius from current location, or drawn polygon) | Nominatim (name search) + MapLibre + terradraw (polygon) + radius circle (GeoJSON circle + MapLibre drag) |
| ENTRY-02 | From the search area, user selects one of two modes: Weather Finder or Route Planner | Two CTA buttons after shared config — no routing needed, conditional panel expansion |
| ALGO-01 | Generate weather-optimized multi-day route through real towns | Overpass towns + Open-Meteo scores + OSRM matrix + nearest-neighbor heuristic with 2-opt improvement |
| ALGO-02 | Weather scoring is temporal — scored for specific day(s) at each stop | Algorithm assigns arrival dates per stop and fetches/slices hourly data for those specific calendar days |
| ALGO-03 | User can configure max-stay duration | Input in route-specific second config step; algorithm respects `maxNights` per stop |
| ALGO-04 | Route optimizer minimizes backtracking and criss-crossing | Geographic progression heuristic (nearest neighbor from start + 2-opt) |
| ALGO-05 | No location visited twice | Standard TSP constraint; nearest-neighbor with visited set naturally enforces this |
| ALGO-06 | Route optimizer pre-computes full road-distance matrix per session | OSRM `/table` API on self-hosted instance; returns NxN duration matrix |
| ALGO-07 | User can designate must-visit locations | Must-visit stops pinned in route; optimizer anchors around them using constrained insertion |
| TRIP-01 | User can set trip duration (number of days) | Input in route-specific config; drives itinerary length |
| TRIP-02 | User can set start location (address or place name) | Nominatim geocoding for start point |
| TRIP-03 | User can set max-stay constraint (y nights per stop) | Maps to ALGO-03 |
| TRIP-04 | User can select a weather preset profile (Beach, Hiking, Sightseeing) | Preset weight sets in `packages/core` scoring module |
| ITIN-01 | Day-by-day itinerary with specific dates, location names, nights, weather score | Timeline component driven by algorithm output |
| ITIN-02 | Weather score breakdown per location (rain, sun, temp, wind contributions) | Scoring module exposes per-dimension values; inline breakdown in timeline |
| ITIN-03 | Trip summary stats (total distance, stops, average score) | Derived from algorithm output; shown in summary bar and stats card |
| MAP-01 | Interactive map with numbered stops | MapLibre GL JS markers with custom HTML element (numbered circles) |
| MAP-02 | Map markers color-coded by weather score | HSL interpolation red→yellow→green mapped to score 0–100; applied to marker DOM element |
| MAP-03 | Map works cross-platform using MapLibre / @rnmapbox | Web uses MapLibre GL JS; this phase is web-only; MAP-03 full cross-platform is Phase 5 |
| SHARE-01 | Export route to Google Maps / Apple Maps via deep link | Google Maps: `https://www.google.com/maps/dir/?api=1&origin=...&waypoints=lat,lng|lat,lng`; Apple Maps: `https://maps.apple.com/?saddr=...&daddr=...` |
| SHARE-02 | Shareable link to trip (URL-encoded, no account required) | TanStack Router search params with JSON serialization; compress with LZ-string if needed |
</phase_requirements>

---

## Summary

Phase 1 requires building six distinct technical layers that must compose cleanly: a Turborepo monorepo scaffold, a pure TypeScript algorithm library (`packages/core`), a Vite + React web app, MapLibre GL JS for map rendering, Open-Meteo for weather data, and OSRM + Overpass API for routing and location data. Research confirms all chosen technologies are viable and actively maintained. The primary risk areas are external service compliance (Open-Meteo requires a paid plan for commercial use at $29/month; Nominatim and the OSRM demo server cannot be used in production — both require self-hosting or proxying) and algorithm complexity (the route optimizer is a constrained TSP variant that must run client-side without freezing the UI — Web Workers are the standard solution).

The algorithm is the hardest engineering problem in this phase. It is not a standard TSP: it adds temporal scoring (score depends on which day you arrive), max-stay constraints, must-visit anchoring, and geographic anti-backtracking. A nearest-neighbor heuristic seeded from the start location with 2-opt improvement handles the no-backtrack constraint well and runs in acceptable O(n²) time for the typical town-count range (20–100 stops). The full road-distance matrix from OSRM (pre-computed once per session) makes repeated distance lookups O(1).

MapLibre GL JS v5.x is the correct map library for web. The `@vis.gl/react-maplibre` package (v8.1.0) provides idiomatic React components. For polygon drawing, `@watergis/maplibre-gl-terradraw` is the officially-referenced MapLibre plugin that wraps Terra Draw — it handles freehand polygons, pin selection, and radius circles with minimal custom code. The gradient route line uses MapLibre's `line-gradient` paint property with `line-progress` expressions (requires `lineMetrics: true` on the GeoJSON source).

**Primary recommendation:** Use Turborepo compiled package pattern for `packages/core` (tsc, no bundler), Vite + React for `apps/web`, `@vis.gl/react-maplibre` for map binding, Zustand for app state, TanStack Router for type-safe URL sharing, react-i18next for i18n, and run the route optimizer in a Web Worker.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Turborepo | latest (2.x) | Monorepo build orchestration | Vercel-maintained, fastest caching, works with pnpm workspaces |
| TypeScript | 5.x | Shared core library + all apps | Strict typing prevents scoring/algorithm bugs |
| Vite | 6.x | Web app bundler | Fastest HMR; best for client-side SPA; no SSR needed here |
| React | 19.x | Web UI framework | Chosen stack; compatible with all supporting libraries |
| maplibre-gl | 5.19.0 | Map rendering engine | Open-source Mapbox fork; no token required; active development |
| @vis.gl/react-maplibre | 8.1.0 | React wrapper for MapLibre GL JS | Official vis.gl wrapper; same API as react-map-gl; requires maplibre-gl >= 4 |
| Zustand | 5.x | App-wide state management | 3KB; no boilerplate; ideal for mid-complexity SPA state |
| TanStack Router | 1.x | Routing + URL state | Type-safe search params for shareable trip links; built-in JSON serialization |
| react-i18next | 15.x | Internationalization | Most popular React i18n; plugin-driven; namespaces; lazy loading |
| i18next | 24.x | i18n core (peer dep of react-i18next) | Required peer |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @watergis/maplibre-gl-terradraw | latest | Polygon/freehand drawing on map | LOC-03: user draws custom search area |
| terra-draw | latest | Drawing engine (transitive dep of terradraw plugin) | Do not use directly; use via maplibre-gl-terradraw |
| @turf/turf | 7.x | Geospatial calculations (bbox, point-in-polygon, distance) | Computing bounding boxes from drawn polygons; filtering towns inside area |
| pnpm | 9.x | Package manager | Turborepo's preferred package manager; workspace protocol support |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Next.js | Next.js adds SSR complexity we don't need; no SEO requirement for this SPA; Vite is simpler |
| Zustand | Jotai | Jotai better for fine-grained atom-level reactivity; Zustand's single store is simpler for route optimizer state that changes as a whole |
| TanStack Router | React Router + nuqs | TanStack Router has first-class JSON search param serialization built in; fewer packages |
| react-i18next | react-intl | react-i18next has better namespace support and lazy loading; react-intl is more standards-based but heavier for this use case |
| @watergis/maplibre-gl-terradraw | mapbox-gl-draw (ported) | mapbox-gl-draw works with MapLibre but is Mapbox-originated; terradraw is OSS-native and officially used in MapLibre docs examples |

**Installation:**
```bash
# Root
pnpm add -D turbo typescript

# packages/core (algorithm library)
pnpm add -D typescript

# apps/web
pnpm add react react-dom maplibre-gl @vis.gl/react-maplibre zustand @tanstack/react-router
pnpm add i18next react-i18next i18next-browser-languagedetector
pnpm add @turf/turf @watergis/maplibre-gl-terradraw
pnpm add -D vite @vitejs/plugin-react typescript
```

---

## Architecture Patterns

### Recommended Project Structure

```
weather-chaser/
├── apps/
│   ├── web/                    # Vite + React SPA (Phase 1)
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router route files
│   │   │   ├── components/     # UI components (map, panel, itinerary)
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── workers/        # Web Worker files (optimizer.worker.ts)
│   │   │   ├── i18n/           # i18n config + locale JSON files
│   │   │   └── hooks/          # Custom React hooks
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── mobile/                 # Phase 5 placeholder (do not build yet)
├── packages/
│   ├── core/                   # Shared TS algorithm library
│   │   ├── src/
│   │   │   ├── scoring/        # Weather scoring functions
│   │   │   ├── optimizer/      # Route optimization algorithm
│   │   │   ├── types/          # Shared TypeScript types
│   │   │   └── index.ts        # Public API barrel
│   │   ├── package.json        # name: "@weatherchaser/core"
│   │   └── tsconfig.json
│   └── typescript-config/      # Shared tsconfig base
│       ├── base.json
│       └── react-library.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Pattern 1: Compiled Internal Package for `packages/core`

**What:** The core algorithm library is a compiled TypeScript package — `tsc` compiles `src/` to `dist/` — making its build output cacheable by Turborepo and compatible with both the web app and future mobile app.

**When to use:** Any shared pure-logic library without framework dependencies.

```typescript
// packages/core/package.json
{
  "name": "@weatherchaser/core",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    },
    "./scoring": {
      "types": "./src/scoring/index.ts",
      "default": "./dist/scoring/index.js"
    },
    "./optimizer": {
      "types": "./src/optimizer/index.ts",
      "default": "./dist/optimizer/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "@weatherchaser/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"]
}
```

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Source:** Turborepo official docs — https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package

### Pattern 2: Route Optimizer in a Web Worker

**What:** The route optimizer (distance matrix computation + nearest-neighbor + 2-opt) runs in a Web Worker to prevent UI freezes. Communication is via `postMessage`.

**When to use:** Any computation that might take >50ms. The OSRM matrix fetch + optimization for 50 towns is in this range.

```typescript
// apps/web/src/workers/optimizer.worker.ts
// Source: MDN Web Workers API

import { optimizeRoute } from '@weatherchaser/core/optimizer';

self.onmessage = async (event: MessageEvent<OptimizerInput>) => {
  const { towns, weatherScores, config } = event.data;

  // Post intermediate progress updates
  self.postMessage({ type: 'progress', step: 'Fetching distance matrix...' });
  const matrix = await fetchOSRMMatrix(towns);

  self.postMessage({ type: 'progress', step: 'Optimizing route...' });
  const result = optimizeRoute({ towns, matrix, weatherScores, config });

  self.postMessage({ type: 'complete', result });
};

// In React component:
const worker = new Worker(
  new URL('../workers/optimizer.worker.ts', import.meta.url),
  { type: 'module' }
);
```

### Pattern 3: MapLibre Gradient Route Line

**What:** The route line uses MapLibre's `line-gradient` paint property with `line-progress` expression to produce a continuous red→yellow→green color shift along the route.

**Critical requirement:** GeoJSON source MUST set `lineMetrics: true`.

```typescript
// Source: https://maplibre.org/maplibre-gl-js/docs/examples/create-a-gradient-line-using-an-expression/

map.addSource('route', {
  type: 'geojson',
  lineMetrics: true,   // REQUIRED for line-gradient
  data: routeGeoJSON
});

map.addLayer({
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-width': 4,
    'line-gradient': [
      'interpolate',
      ['linear'],
      ['line-progress'],
      0,   'hsl(0, 80%, 50%)',    // red (low score)
      0.5, 'hsl(45, 90%, 55%)',   // yellow (mid score)
      1,   'hsl(120, 60%, 45%)'   // green (high score)
    ]
  }
});
```

### Pattern 4: Custom Numbered Marker with Score Color

**What:** Stop markers are custom HTML elements (numbered circles) injected via `new Marker({ element })`. Color is computed from the weather score using HSL interpolation.

```typescript
// Source: https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/

function scoreToHSL(score: number): string {
  // score: 0–100 → hue: 0 (red) → 120 (green)
  const hue = Math.round((score / 100) * 120);
  return `hsl(${hue}, 70%, 45%)`;
}

function createStopMarker(stopNumber: number, score: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'stop-marker';
  el.style.backgroundColor = scoreToHSL(score);
  el.style.borderRadius = '50%';
  el.style.width = '32px';
  el.style.height = '32px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.color = 'white';
  el.style.fontWeight = 'bold';
  el.style.fontSize = '13px';
  el.textContent = String(stopNumber);
  return el;
}

const marker = new Marker({ element: createStopMarker(1, 78) })
  .setLngLat([lng, lat])
  .setPopup(new Popup().setHTML(`<b>${town.name}</b><br/>Score: ${score}`))
  .addTo(map);
```

### Pattern 5: URL State for Shareable Trips (TanStack Router)

**What:** Trip configuration and results are serialized into URL search params. Anyone opening the link sees the same result without an account.

```typescript
// Source: https://tanstack.com/router/v1/docs/framework/react/guide/search-params

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const tripSchema = z.object({
  region: z.string().optional(),
  days: z.number().optional(),
  maxStay: z.number().optional(),
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  mustVisit: z.array(z.string()).optional(),
  result: z.string().optional(), // base64-compressed JSON result
});

export const Route = createFileRoute('/planner')({
  validateSearch: tripSchema,
});

// Generating a shareable link:
navigate({ to: '/planner', search: { ...tripConfig, result: compressedResult } });
```

### Pattern 6: Open-Meteo API Fetch

**What:** Fetch hourly weather for all candidate towns in one batch (via `latitude` + `longitude` arrays). Open-Meteo supports array parameters for multi-location fetch.

```typescript
// Source: https://open-meteo.com/en/docs

async function fetchWeatherBatch(towns: Town[]): Promise<WeatherData[]> {
  const lats = towns.map(t => t.lat).join(',');
  const lngs = towns.map(t => t.lng).join(',');

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    hourly: 'temperature_2m,precipitation,sunshine_duration,wind_speed_10m',
    forecast_days: '16',
    timezone: 'Europe/Berlin'
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  return res.json();
}
```

Note: For Phase 1 (development/prototype), the free tier is acceptable during development only. Production launch requires a commercial plan ($29/month Standard).

### Pattern 7: Overpass API Query for Towns

**What:** Query named settlements inside a polygon or bounding box.

```
// Overpass QL query for towns inside a bounding box
// Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL

[out:json][timeout:30];
(
  node["place"~"^(city|town|village)$"](bbox_south,bbox_west,bbox_north,bbox_east);
  node["place"~"^(city|town|village)$"](poly:"lat1 lng1 lat2 lng2 ...");
);
out center;
```

Note: Must be proxied through your own backend or self-hosted instance in production. The public `overpass-api.de` instance prohibits production use.

### Pattern 8: Temporal Weather Scoring Algorithm

**What:** Each stop is scored using only the hourly weather data for the specific calendar days the user would be there (not averaged across all forecast days).

```typescript
// packages/core/src/scoring/weatherScore.ts

export interface ScoringWeights {
  sunshine: number;   // 0–1
  precipitation: number; // 0–1 (inverted — less is better)
  temperature: number; // 0–1
  wind: number;       // 0–1 (inverted — less is better)
}

// Preset profiles (TRIP-04)
export const PRESETS: Record<string, ScoringWeights> = {
  beach:       { sunshine: 0.4, precipitation: 0.3, temperature: 0.2, wind: 0.1 },
  hiking:      { sunshine: 0.3, precipitation: 0.3, temperature: 0.2, wind: 0.2 },
  sightseeing: { sunshine: 0.3, precipitation: 0.4, temperature: 0.2, wind: 0.1 },
};

export function scoreLocation(
  hourlyData: HourlyWeather,
  arrivalDate: Date,
  nightsStay: number,
  weights: ScoringWeights
): WeatherScore {
  // Slice hourly data to only the days this stop is occupied
  const relevantHours = sliceHoursByDays(hourlyData, arrivalDate, nightsStay);

  const avgSunshine = mean(relevantHours.sunshine_duration);      // seconds/hour
  const totalPrecip  = sum(relevantHours.precipitation);           // mm
  const avgTemp      = mean(relevantHours.temperature_2m);         // °C
  const avgWind      = mean(relevantHours.wind_speed_10m);         // km/h

  // Normalize each dimension to 0–100
  const sunScore   = normalize(avgSunshine, 0, 3600) * 100;
  const rainScore  = (1 - normalize(totalPrecip, 0, 20)) * 100;   // inverted
  const tempScore  = normalize(avgTemp, 5, 30) * 100;
  const windScore  = (1 - normalize(avgWind, 0, 50)) * 100;       // inverted

  const composite =
    sunScore   * weights.sunshine +
    rainScore  * weights.precipitation +
    tempScore  * weights.temperature +
    windScore  * weights.wind;

  return {
    composite,
    breakdown: { sunshine: sunScore, precipitation: rainScore, temperature: tempScore, wind: windScore }
  };
}
```

### Anti-Patterns to Avoid

- **Calling OSRM per route step in real-time:** Pre-compute the full NxN matrix once per session (ALGO-06). Calling OSRM for each step during optimization makes it O(n³) API calls.
- **Running the optimizer on the main thread:** Block the UI for >50ms → users see frozen interface during optimization. Use a Web Worker.
- **Hardcoding strings anywhere:** All user-facing text must go through `t('key')` from react-i18next from day one. Retrofitting i18n later is costly.
- **Using demo/public OSRM/Nominatim/Overpass endpoints in production:** All three services explicitly prohibit bulk/automated production traffic on their public endpoints.
- **Using TypeScript Project References:** Turborepo docs explicitly warn against them — adds complexity without benefit in this monorepo setup.
- **Floating-point route line without `lineMetrics: true`:** MapLibre ignores `line-gradient` unless the GeoJSON source has `lineMetrics: true`. This is a silent failure.
- **Using react-map-gl instead of @vis.gl/react-maplibre:** `react-map-gl` defaults to Mapbox GL JS; you must import from `'react-map-gl/maplibre'` or use the dedicated `@vis.gl/react-maplibre` package to avoid pulling in the Mapbox SDK.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polygon drawing on map | Custom mouse/touch event handlers | `@watergis/maplibre-gl-terradraw` | Handles freehand, polygon, circle modes; manages geometry state; already integrated with MapLibre |
| Geospatial math (bbox, containment) | Custom lat/lng arithmetic | `@turf/turf` | Edge cases: antimeridian crossing, great-circle distances, polygon winding order |
| URL state serialization | Custom JSON encode/decode in URL | TanStack Router search params | Type-safe, validated, handles arrays/objects, browser history integration |
| i18n key management | Switch statements / string constants | react-i18next namespaces | Lazy loading, plurals, interpolation, date formatting |
| Map layer management lifecycle | Direct `map.addLayer/removeLayer` in effects | `@vis.gl/react-maplibre` Layer/Source components | Handles mount/unmount, style load timing, and React reconciliation |
| Monorepo task caching | Shell scripts / Makefile | Turborepo | Content-addressed caching, remote cache, parallel execution, dependency graph |
| Weather score gradient CSS | Custom interpolation math in components | HSL color math (`hsl(score * 1.2, 70%, 45%)`) — simple one-liner | Score → hue mapping is trivial arithmetic; no library needed |

**Key insight:** The algorithm is the one place where hand-rolling is appropriate — the scoring and optimization are domain-specific enough that no off-the-shelf library exists for this exact problem. Everything else should use established libraries.

---

## Common Pitfalls

### Pitfall 1: Open-Meteo Free Tier in Production

**What goes wrong:** Developer uses free API during development, ships to production without upgrading. App works until Open-Meteo detects commercial use and throttles or blocks the API key.

**Why it happens:** The free API has no hard enforcement during development — it only applies the non-commercial policy contractually.

**How to avoid:** Purchase the Standard plan ($29/month) before any public launch. Add the API key to environment config from day one so it's easy to switch.

**Warning signs:** API calls succeed in dev but fail silently or return 429 errors on the live URL.

### Pitfall 2: OSRM Demo Server in Any Non-Local Environment

**What goes wrong:** Route optimizer sends the full distance matrix request to `router.project-osrm.org`. This service rate-limits and blocks automated/bulk queries. The public demo server explicitly states it is for demonstration only.

**Why it happens:** It's the default OSRM URL in all tutorials.

**How to avoid:** Self-host OSRM via Docker from day one, even locally. In Phase 1 (no backend), run OSRM locally during development and point to it. For any staging/production environment, OSRM must run behind a proxy (Phase 3 adds the backend proxy).

**Warning signs:** Matrix requests return 429 or timeout for >10 coordinate pairs.

### Pitfall 3: Nominatim Rate Limit in Search Autocomplete

**What goes wrong:** User types in search box; each keystroke triggers a Nominatim geocoding request. At 1 req/s limit, the user gets throttled within seconds of typing.

**Why it happens:** Autocomplete-style search fires many requests rapidly.

**How to avoid:** Debounce the Nominatim input at 500ms minimum. Implement a local cache (sessionStorage or in-memory Map) for repeated queries. For Phase 1 (no backend), this is acceptable with heavy debouncing. Phase 3 adds a proxy with caching.

**Warning signs:** Geocoding requests return `{"error": "usage limit reached"}`.

### Pitfall 4: MapLibre Style Load Race Condition

**What goes wrong:** Code calls `map.addSource()` or `map.addLayer()` before the map style has loaded. MapLibre throws an error: "Style is not done loading."

**Why it happens:** MapLibre initializes asynchronously. The `load` event fires when the style is ready, but React effects may run before then.

**How to avoid:** When using `@vis.gl/react-maplibre`, use `<Source>` and `<Layer>` components which handle load timing automatically. If using imperative MapLibre API, wrap in the `map.on('load', () => { ... })` callback or check `map.isStyleLoaded()`.

**Warning signs:** Console errors about style not loaded; layers appear intermittently.

### Pitfall 5: Optimizer Freezes UI (Main Thread Blocking)

**What goes wrong:** The nearest-neighbor + 2-opt algorithm runs on 50–100 towns with a 100x100 matrix. This can take 200–500ms. Running it on the main thread causes visible UI freeze, especially on mobile.

**Why it happens:** JavaScript is single-threaded; no async operation can unblock a synchronous computation loop.

**How to avoid:** Run all optimizer code in a Web Worker. Import `packages/core` functions into the worker, not the React component. Use `postMessage` for progress updates ("Finding towns...", "Optimizing route...") to feed the loading state UI.

**Warning signs:** Browser shows "Page Unresponsive" dialog during optimization; UI animations stutter.

### Pitfall 6: Overpass Query Returns Water/Field Points

**What goes wrong:** Querying for `place=hamlet` or low-level place tags returns nodes that OSM has tagged as small settlements but may be in the middle of forests or water bodies. The route stops at these unrecognizable names.

**Why it happens:** OSM tagging is inconsistent; many nodes with settlement tags are low-quality entries.

**How to avoid:** Filter by `place=city|town|village` (not hamlet, isolated_dwelling, farm). Add a minimum population filter if OSM data includes it (`population > 500` via Overpass filter). Post-process results to exclude nodes without `name` tags.

### Pitfall 7: Google Maps Waypoint Limit

**What goes wrong:** The export-to-Google-Maps deep link fails for routes with more than 9 stops.

**Why it happens:** Google Maps URLs support a maximum of 9 waypoints on desktop and 3 on mobile browsers.

**How to avoid:** When generating the export link, limit waypoints to 9. For longer routes, offer a "Copy all waypoints" option, or create multiple linked legs. Document this limitation in the UX with a clear message.

**Warning signs:** Google Maps opens but shows only partial route.

---

## Code Examples

Verified patterns from official sources:

### Open-Meteo Forecast Request

```typescript
// Source: https://open-meteo.com/en/docs
// Supports array of lat/lng for batch fetching

const url = new URL('https://api.open-meteo.com/v1/forecast');
url.searchParams.set('latitude', '48.1351,47.9990,48.5734');
url.searchParams.set('longitude', '11.5820,11.9878,13.4050');
url.searchParams.set('hourly', 'temperature_2m,precipitation,sunshine_duration,wind_speed_10m');
url.searchParams.set('forecast_days', '16');
url.searchParams.set('timezone', 'Europe/Berlin');

const response = await fetch(url.toString());
const data = await response.json();
// data is an array when multiple lat/lng provided
```

### Overpass API Towns in Polygon

```
// Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
[out:json][timeout:30];
(
  node["place"~"^(city|town|village)$"]["name"](poly:"48.0 11.0 48.5 11.0 48.5 12.0 48.0 12.0");
);
out body;
```

### OSRM Table (Distance Matrix) Request

```typescript
// Source: https://project-osrm.org/docs/v5.5.1/api/#table-service
// Self-hosted OSRM at localhost:5000 during development

const coords = towns.map(t => `${t.lng},${t.lat}`).join(';');
const url = `http://localhost:5000/table/v1/driving/${coords}?annotations=duration,distance`;
const res = await fetch(url);
const { durations, distances } = await res.json();
// durations[i][j] = seconds from town i to town j
// distances[i][j] = meters from town i to town j
```

### Google Maps Export Deep Link (SHARE-01)

```typescript
// Source: https://developers.google.com/maps/documentation/urls/get-started
// Max 9 waypoints on desktop

function buildGoogleMapsUrl(stops: Stop[]): string {
  const MAX_WAYPOINTS = 9;
  const limited = stops.slice(0, MAX_WAYPOINTS + 2); // origin + dest + waypoints
  const origin = `${limited[0].lat},${limited[0].lng}`;
  const destination = `${limited[limited.length - 1].lat},${limited[limited.length - 1].lng}`;
  const waypoints = limited.slice(1, -1)
    .map(s => `${s.lat},${s.lng}`)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
}

// Apple Maps equivalent
function buildAppleMapsUrl(stops: Stop[]): string {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}`;
}
```

### react-i18next Setup (Vite + TypeScript)

```typescript
// Source: https://react.i18next.com/latest/using-with-hooks
// apps/web/src/i18n/index.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/common.json';
import de from './locales/de/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { common: en }, de: { common: de } },
    defaultNS: 'common',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;

// Usage in components:
// const { t } = useTranslation('common');
// <button>{t('cta.findBestRoute')}</button>
```

### Nearest-Neighbor + 2-opt Route Optimizer Sketch

```typescript
// packages/core/src/optimizer/nearestNeighbor.ts
// O(n²) nearest neighbor from start + O(n³) 2-opt improvement

export function optimizeRoute(input: OptimizerInput): Route {
  const { towns, matrix, weatherScores, config } = input;
  const { startIndex, totalDays, maxStay, mustVisit } = config;

  // Phase 1: Build greedy nearest-neighbor tour from start
  const visited = new Set<number>();
  const tour: number[] = [startIndex];
  visited.add(startIndex);

  let current = startIndex;
  while (visited.size < towns.length) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < towns.length; i++) {
      if (!visited.has(i) && matrix[current][i] < nearestDist) {
        nearest = i;
        nearestDist = matrix[current][i];
      }
    }
    tour.push(nearest);
    visited.add(nearest);
    current = nearest;
  }

  // Phase 2: 2-opt improvement (reduce total distance)
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < tour.length - 2; i++) {
      for (let j = i + 1; j < tour.length - 1; j++) {
        const d0 = matrix[tour[i-1]][tour[i]] + matrix[tour[j]][tour[j+1]];
        const d1 = matrix[tour[i-1]][tour[j]] + matrix[tour[i]][tour[j+1]];
        if (d1 < d0) {
          tour.splice(i, j - i + 1, ...tour.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }

  // Phase 3: Assign dates and scores; respect maxStay
  return assignDatesAndScores(tour, weatherScores, config);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mapbox GL JS (license required) | MapLibre GL JS (OSS fork) | 2021 (Mapbox license change) | No token required, fully open-source |
| react-map-gl/mapbox | @vis.gl/react-maplibre | 2023 (split packages) | Dedicated MapLibre React package without Mapbox dependency |
| Webpack + Create React App | Vite | 2021–2023 (CRA deprecated) | CRA is unmaintained; Vite is the standard |
| Lerna | Turborepo | 2022 (Vercel acquisition) | Turborepo has better caching and simpler config |
| MapLibre GL JS v4 | MapLibre GL JS v5 | 2025 | v5 is current stable (5.19.0 as of Feb 2026) |
| Per-step OSRM calls | Pre-computed distance matrix | ALGO-06 requirement | Reduces API calls from O(n²) during optimize to 1 batch call |

**Deprecated/outdated:**
- Create React App: Officially deprecated; do not use
- Lerna (standalone): Superseded by Turborepo + pnpm workspaces
- mapbox-gl (for open-source use): Requires API token since v2; use maplibre-gl instead
- TypeScript Project References in Turborepo: Explicitly not recommended by Turborepo docs

---

## Open Questions

1. **Open-Meteo batch API for multiple locations**
   - What we know: The API accepts comma-separated `latitude` and `longitude` parameters and returns an array of results
   - What's unclear: Whether there is a per-request limit on number of locations that can be batched in one call (confirmed rate limits are per-call count, not per-location-per-call)
   - Recommendation: Test empirically; if batching 50 towns in one request is supported, use it; otherwise batch in groups of 10

2. **OSRM table API max-table-size for self-hosted**
   - What we know: The public demo server caps at ~10,000 elements (100x100 matrix). Self-hosted allows configuring `--max-table-size`
   - What's unclear: Memory requirements for running OSRM locally during Phase 1 development (no backend yet)
   - Recommendation: For Phase 1 development, run OSRM Docker locally with a regional extract (e.g., Germany only, ~600MB). Document developer setup requirement.

3. **Nominatim for region-name → polygon**
   - What we know: Nominatim can return boundary polygons (not just bounding boxes) for named regions via `polygon_geojson=1` parameter
   - What's unclear: Reliability and completeness of admin boundary polygons for all regions users might search (e.g., "Black Forest" may not have a clean polygon)
   - Recommendation: Use Nominatim to get the bounding box first; use the bounding box to seed the Overpass query. The drawn-polygon mode (LOC-03) is the fallback for imprecise region names.

4. **TanStack Router vs React Router for this SPA**
   - What we know: TanStack Router has better built-in search param type safety; React Router is more widely used
   - What's unclear: Whether TanStack Router's Vite plugin (TanStack Router Vite plugin) is stable enough for production use in Feb 2026
   - Recommendation: Use TanStack Router with the file-based routing Vite plugin. It is stable (v1.x) and the search param handling is significantly better for the trip sharing use case.

5. **Weather score gradient for `line-gradient` vs per-segment coloring**
   - What we know: MapLibre's `line-gradient` is a gradient along the total line length (0→1 from start to end) — it cannot change color per-segment based on score
   - What's unclear: How to represent each stop's score accurately on the line (gradient is positional, not score-driven per segment)
   - Recommendation: Render the route as multiple individual line segments (one GeoJSON Feature per leg), each with a solid color based on the destination stop's weather score. This is more accurate than a single gradient line. Use layer filtering or multiple sources for this.

---

## Sources

### Primary (HIGH confidence)

- Turborepo official docs — https://turborepo.dev/docs — internal packages, TypeScript setup, compiled vs JIT strategy
- MapLibre GL JS official docs — https://maplibre.org/maplibre-gl-js/docs/ — line-gradient, Marker API, examples
- Open-Meteo official docs — https://open-meteo.com/en/docs — hourly variables, forecast_days parameter, API structure
- Open-Meteo terms — https://open-meteo.com/en/terms — confirmed: commercial use prohibited on free tier
- Open-Meteo pricing (substack) — https://openmeteo.substack.com/p/api-subscriptions-for-commercial — Standard: $29/month, Professional: $99/month
- OSRM official API docs — https://project-osrm.org/docs/v5.5.1/api/ — table service, matrix format, source/destination params
- Overpass API wiki — https://wiki.openstreetmap.org/wiki/Overpass_API — query language, place tags, polygon syntax
- Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/ — 1 req/s max, commercial use undefined but risky
- @vis.gl/react-maplibre npm — version 8.1.0, requires maplibre-gl >= 4.0.0
- maplibre-gl npm — latest version 5.19.0 (as of Feb 2026)
- TanStack Router docs — https://tanstack.com/router/v1/docs — search params, type safety, JSON serialization
- react-i18next docs — https://react.i18next.com — setup, hooks, TypeScript support
- Google Maps URLs — https://developers.google.com/maps/documentation/urls/get-started — waypoint format, 9-waypoint limit
- @watergis/maplibre-gl-terradraw — npm + GitHub — polygon/freehand drawing, Terra Draw integration

### Secondary (MEDIUM confidence)

- Turborepo TypeScript guide (WebFetch verified) — base tsconfig patterns, just-in-time vs compiled recommendation
- Open-Meteo batch multi-location fetch — confirmed API accepts array lat/lng; exact per-request limits not documented
- OSRM table API max-table-size — confirmed configurable on self-hosted; demo server caps at 10,000 elements (GitHub issues)

### Tertiary (LOW confidence)

- Open-Meteo free tier rate limits (10,000 calls/day, 5,000/hour, 600/min) — from secondary WebSearch source, not official pricing page; marked for validation
- Nearest-neighbor 2-opt delivers ~15% above optimal — standard algorithm literature claim; sufficient for this use case

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm and official docs; library choices confirmed with multiple sources
- Architecture patterns: HIGH — Turborepo patterns from official docs; MapLibre patterns from official examples
- External service policies: HIGH — Open-Meteo terms verified directly; Nominatim policy from official OSMF page; OSRM verified via GitHub
- Algorithm approach: MEDIUM — nearest-neighbor + 2-opt is well-established; exact performance for this use case is untested
- Pitfalls: HIGH — most are derived from official policy pages or documented API behavior

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (stable for 90 days; re-verify Open-Meteo pricing and maplibre-gl version before planning)
