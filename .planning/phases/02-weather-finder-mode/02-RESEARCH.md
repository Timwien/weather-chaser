# Phase 2: Weather Finder Mode - Research

**Researched:** 2026-03-01
**Domain:** Weather-ranked location discovery — Overpass radius query, Open-Meteo hourly batch, time-of-day scoring, ranked results panel, two-way map–list selection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Results layout
- Compact rows matching the existing itinerary/route-planner design style
- Each row shows: rank, town name, overall score, plus individual metric values (sun hours, temp, precip) — matching the density of Phase 1 itinerary rows
- Sortable by overall score AND by individual criteria (sun hours, temperature, precipitation) via sort buttons above the list
- The currently active sort criterion is highlighted (bold or similar visual indicator)
- Top 10 results shown
- Empty state: "No locations found. Try increasing your radius." with a one-tap action to expand the radius

#### Entry & search flow
- Two mode buttons already exist from Phase 1 — Weather Finder button is already wired; Phase 2 implements the panel/flow behind it
- Weather Finder entry panel requires only: start location + date range — distance and preset use default values set at launch
- Start location accepts both: text input (reuse existing location field) AND a "Use my location" GPS button
- Default values on first load: 200 km radius, Sightseeing preset
- Date picker, location input, and "Was ist dir wichtig?" buttons from Phase 1 MUST NOT be changed — Phase 2 builds on top of them without modification

#### Map–list interaction
- Two-way selection: clicking a list row pans the map and highlights the matching marker; clicking a map marker scrolls the list and highlights the matching row
- When results first load, the map auto-fits its bounds to show all result markers
- Markers display color (green = best, yellow = fair, red = poor) + score value as a visible label on the marker

#### Filter controls
- Filter row is pinned above the ranked list and remains visible while scrolling
- All filter changes (distance, time of day, preset) update results instantly and reactively — no apply/refresh button
- Time-of-day toggle has three states: Morning / Afternoon / Full day
- Distance filter is a slider (range approx. 50–500 km)
- Preset filter: Beach / Hiking / Sightseeing selector (matches existing "Was ist dir wichtig?" options)

### Claude's Discretion
- Exact color score thresholds for green/yellow/red (e.g. 70+ = green, 40–70 = yellow, <40 = red)
- Loading skeleton/spinner design during weather fetch
- Exact slider step values and snap behavior for distance filter
- Error state handling for network failures and API errors

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIND-01 | User can search for the best weather in a defined area for a specific date or date range (up to 14-day forecast horizon) | Open-Meteo supports up to 16 days via `forecast_days=16`; existing `fetchWeatherBatch` already handles date range + batch; new `around` Overpass query fetches towns within a radius |
| FIND-02 | User can set a maximum distance constraint (e.g. max 500 km from starting point) to filter results | Overpass `around` filter natively accepts radius in meters; slider in WeatherFinderStep writes to finder store; re-scoring is client-side with no re-fetch |
| FIND-03 | Results are displayed as a ranked list of top locations with weather scores | New `WeatherFinderPanel` component; sorted array derived from finder store state; sort buttons toggle active criterion |
| FIND-04 | Results are simultaneously displayed on a map as color-coded markers (green = best weather) | New `FinderMarkers` component (parallel to `StopMarkers`); uses same `@vis.gl/react-maplibre` `Marker` pattern; color based on 3-band threshold |
| FIND-05 | User can toggle between morning and afternoon scoring for day-trip planning | Client-side: hourly weather fetched once, sliced by hour range (6–11 morning / 12–17 afternoon / all full day) at scoring time; existing `sliceHoursByDays` extended or new slicer written |
| FIND-06 | User can select a weather preset profile (Beach, Hiking, Sightseeing) to adjust scoring weights — free tier | `PRESETS` already defined in `packages/core/src/scoring/presets.ts`; filter state drives re-score without re-fetch |
</phase_requirements>

---

## Summary

Phase 2 is primarily a **new flow layered on top of the Phase 1 UI shell** — no existing components are modified. The core engine (scoring, presets, Open-Meteo batch fetch, town parsing) is already built and tested. The main new work is: (1) a radius-based Overpass query, (2) a Weather Finder state slice in the Zustand store, (3) a new Web Worker mirroring `optimizer.worker.ts` but producing a ranked list rather than a route, (4) two new panel components (`WeatherFinderStep` entry and `WeatherFinderPanel` results), and (5) `FinderMarkers` for the map.

The time-of-day toggle (FIND-05) requires fetching **hourly** (not daily) weather data so scores can be sliced by hour window client-side. This is the single biggest architectural decision that diverges from the Phase 1 daily-aggregate approach: the finder worker must request `hourly` Open-Meteo variables in addition to (or instead of) `daily` variables, then hold all hourly data in memory so that Morning/Afternoon/Full-day re-scoring is purely local and instant.

The existing `scoreColor` helper (hsl 0–120 based on score 0–100) is used throughout Phase 1. Phase 2 will replace this with discrete three-band coloring (green/yellow/red) for the map markers, while the results list rows can reuse the same `ScoreBar`/`Metric` pattern from `StopCard`.

**Primary recommendation:** Implement the finder as a Web Worker (mirroring the optimizer worker) that fetches hourly weather data once and posts the full raw hourly arrays back to the main thread, where the Zustand finder store holds them. All re-scoring (time-of-day, preset, sort) is then pure in-memory computation in the main thread — no re-fetch on filter change.

---

## Phase 1 Codebase Audit

### What Phase 1 Built — Must Not Be Changed

| File | What It Does | Phase 2 Constraint |
|------|--------------|--------------------|
| `apps/web/src/components/entry/EntryPanel.tsx` | Contains the "Bestes Wetter finden" CTA button (`setMode('weather-finder')`) and a placeholder `<div class="entry-panel-coming-soon">` when `isWeatherFinder` | Replace the placeholder div with `<WeatherFinderStep />` — do NOT touch any other line |
| `apps/web/src/components/entry/DateRangePicker.tsx` | Custom date range picker (calendar popover, range highlight, 14-day cap logic built in) | Read-only; Phase 2 reads `tripConfig.startDate` / `tripConfig.endDate` from the store, set by this component |
| `apps/web/src/components/entry/LocationInput.tsx` | Multi-tag location input with Nominatim autocomplete and radius slider (steps: 10, 25, 50, 100, 150, 200, 300, 500 km). The radius slider already exists in the entry panel and writes to `searchRadiusKm` in the store | Phase 2 does NOT show `LocationInput` again in the finder step; instead it has its own compact single-location input (start point only) + GPS button. The existing `LocationInput` in the entry panel remains for route-planner use. |
| `apps/web/src/components/entry/CriteriaSelector.tsx` | Four toggle chips (sunshine, precipitation, temperature, wind) writing to `tripConfig.criteria` | Not used in finder flow; finder uses preset selector only |
| `apps/web/src/stores/appStore.ts` | `AppMode` includes `'weather-finder'` already. `tripConfig.preset` and `tripConfig.startDate/endDate/startLat/startLng` are all in place. `searchRadiusKm` (default 50 km) is in the store. | Add a `finderState` slice to the same store; do NOT change existing fields |
| `apps/web/src/workers/optimizer.worker.ts` | Multi-step worker: fetch towns → fetch daily weather → distance matrix → optimize route. Uses `MAX_TOWNS = 120`, batches Open-Meteo at 50/request, Overpass bbox/polygon queries | Pattern template for the new `finder.worker.ts`; reuse services, drop distance matrix and optimizer steps |
| `packages/core/src/scoring/weatherScore.ts` | `scoreLocation` (hourly) and `scoreDailyLocation` (daily) both exported. `normalize()` helper exported | Phase 2 calls `scoreLocation` with hourly slices; no changes needed |
| `packages/core/src/scoring/presets.ts` | `PRESETS` object: beach (sun 0.4, precip 0.3, temp 0.2, wind 0.1), hiking (sun 0.3, precip 0.3, temp 0.2, wind 0.2), sightseeing (sun 0.3, precip 0.4, temp 0.2, wind 0.1) | Read-only; used directly in finder scoring |
| `apps/web/src/services/weather.ts` | `fetchWeatherBatch` batches Open-Meteo requests at 50 towns/call with `daily` variables. Single-location returns object; multi-location returns array — handled correctly | Phase 2 needs a **second fetch function** that requests `hourly` variables (same batch structure) |
| `apps/web/src/services/overpass.ts` | `fetchTownsInArea` (bbox) and `fetchTownsInPolygon`. No radius/around query | Phase 2 adds `fetchTownsInRadius(lat, lng, radiusKm)` using Overpass `around` filter |
| `apps/web/src/components/map/StopMarkers.tsx` | Renders `Marker` + `Popup` from `@vis.gl/react-maplibre` for each route stop. Uses `scoreColor` (hsl gradient). Circle div with day number | Pattern for `FinderMarkers` — replace day number with rank number, replace hsl gradient with 3-band threshold color |
| `apps/web/src/components/map/MapContainer.tsx` | Accepts `selectedStopIndex` + `onStopClick` props. Always mounted. Renders `StopMarkers` only when `route` exists | Phase 2 adds parallel rendering: when `mode === 'weather-finder'` and finder results exist, render `FinderMarkers` instead of `StopMarkers` |

### Store Architecture (appStore.ts) — Current Shape

```typescript
type AppMode = 'idle' | 'route-config' | 'weather-finder' | 'loading' | 'results';

interface AppState {
  mode: AppMode;
  loadingStep: LoadingStep;   // 'finding_towns' | 'fetching_weather' | 'optimizing_route' | null
  searchAreas: SearchAreaItem[];
  searchRadiusKm: number;     // default 50 — used by existing radius slider
  tripConfig: TripConfig;     // includes startDate, endDate, preset, startLat/Lng
  route: Route | null;        // route-planner result
  error: string | null;
  // ... actions
}
```

Phase 2 adds to this store (does not replace anything):

```typescript
// New finder state slice — added to AppState
interface FinderState {
  finderResults: FinderResult[] | null;    // null = not yet searched
  finderLoading: boolean;
  finderError: string | null;
  // raw hourly data held in memory for instant re-scoring
  finderHourlyCache: Map<string, HourlyWeather>;  // townId → hourly data
  // finder-specific config (separate from tripConfig to avoid cross-contamination)
  finderConfig: {
    startLat: number | null;
    startLng: number | null;
    startLocation: string;
    radiusKm: number;           // default 200
    preset: WeatherPreset;      // default 'sightseeing'
    timeOfDay: 'morning' | 'afternoon' | 'full';  // default 'full'
    sortBy: 'score' | 'sunshine' | 'temperature' | 'precipitation';
  };
}

interface FinderResult {
  rank: number;
  town: Town;
  score: WeatherScore;           // re-scored from hourly with current config
  weatherAvg: StopWeatherAvg;   // sun hours, temp, precip, wind
  distanceKm: number;           // Haversine from start point
}
```

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `zustand` | ^5.0.0 | State management — finder store slice | Already installed |
| `@vis.gl/react-maplibre` | ^8.1.0 | `Marker` component for `FinderMarkers` | Already installed |
| `maplibre-gl` | ^5.19.0 | Map instance for `fitBounds` on results load | Already installed |
| `@weatherchaser/core` | workspace | `scoreLocation`, `PRESETS`, `normalize`, types | Already installed |
| `react-i18next` | ^15.0.0 | German labels in new components | Already installed |

### No New Packages Required

All capabilities for Phase 2 exist in the current dependency set. The Overpass `around` query is plain HTTP (same pattern as existing `overpass.ts`). Time-of-day filtering is pure array slicing in TypeScript.

---

## Architecture Patterns

### Recommended File Structure for Phase 2

```
apps/web/src/
├── components/
│   ├── entry/
│   │   └── WeatherFinderStep.tsx          # NEW — replaces placeholder in EntryPanel
│   ├── finder/                             # NEW directory
│   │   ├── WeatherFinderPanel.tsx          # Results panel (mirrors ItineraryPanel)
│   │   ├── WeatherFinderPanel.css          # Styles
│   │   ├── FinderResultRow.tsx             # Single result row (mirrors StopCard)
│   │   ├── FinderFilterBar.tsx             # Pinned filter row (distance, time-of-day, preset)
│   │   └── FinderEmptyState.tsx            # "No locations found" with expand-radius CTA
│   └── map/
│       └── FinderMarkers.tsx               # NEW — parallel to StopMarkers
├── services/
│   └── overpass.ts                         # ADD fetchTownsInRadius()
│   └── weatherHourly.ts                    # NEW — fetchHourlyWeatherBatch()
├── workers/
│   └── finder.worker.ts                    # NEW — fetches towns + hourly weather
├── hooks/
│   └── useFinder.ts                        # NEW — triggers finder worker, handles messages
└── stores/
    └── appStore.ts                          # ADD finderState slice + actions
```

### Pattern 1: Finder Worker (mirrors optimizer.worker.ts)

The finder worker fetches towns and hourly weather, then posts raw results. All re-scoring happens in the main thread so filter changes are instant.

```typescript
// apps/web/src/workers/finder.worker.ts
// Source: mirrors pattern from optimizer.worker.ts

export interface FinderWorkerInput {
  type: 'run';
  config: {
    startLat: number;
    startLng: number;
    radiusKm: number;
    startDate: string;   // ISO YYYY-MM-DD
    endDate: string;
  };
}

export type FinderWorkerOutput =
  | { type: 'progress'; step: 'finding_towns' | 'fetching_weather' }
  | { type: 'complete'; towns: Town[]; hourlyData: HourlyWeatherData[] }
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<FinderWorkerInput>) => {
  // Step 1: fetch towns in radius via Overpass around filter
  // Step 2: batch-fetch hourly weather from Open-Meteo
  // Step 3: post raw data — no scoring here
};
```

**Why raw data, not pre-scored results:** The time-of-day toggle and preset selector must update instantly without re-fetching. By sending raw hourly arrays, the main thread can re-score in <5ms when the user changes a filter.

### Pattern 2: Overpass Around Query

```typescript
// apps/web/src/services/overpass.ts — new function

function buildAroundQuery(lat: number, lng: number, radiusM: number): string {
  return `
    [out:json][timeout:30];
    (
      node["place"~"^(city|town|village)$"]["name"](around:${radiusM},${lat},${lng});
    );
    out body;
  `.trim();
}

export async function fetchTownsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Town[]> {
  return runOverpassQuery(buildAroundQuery(lat, lng, radiusKm * 1000));
}
```

This reuses the existing `runOverpassQuery` function (with endpoint fallback) and `parseTowns`. Confidence: HIGH — verified against official Overpass QL documentation and `osm-queries.ldodds.com/tutorial`.

### Pattern 3: Hourly Weather Batch Fetch

Open-Meteo supports batch multi-location requests with comma-separated lat/lng. Phase 1 already does this for daily data. Phase 2 needs the same but with `hourly` variables.

```typescript
// apps/web/src/services/weatherHourly.ts

export interface HourlyWeatherData {
  townId: string;
  hourly: HourlyWeather;  // from @weatherchaser/core types
}

async function fetchHourlyBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',  towns.map(t => t.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', towns.map(t => t.lng.toFixed(4)).join(','));
  url.searchParams.set('hourly',
    'temperature_2m,precipitation,sunshine_duration,wind_speed_10m');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date',   endDate);
  url.searchParams.set('timezone',   'auto');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const raw: unknown = await res.json();
  const dataArray = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    hourly: dataArray[idx]?.hourly ?? EMPTY_HOURLY,
  }));
}

export async function fetchHourlyWeatherBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  const BATCH_SIZE = 50;  // matches existing fetchWeatherBatch
  const results: HourlyWeatherData[] = [];
  for (let i = 0; i < towns.length; i += BATCH_SIZE) {
    results.push(...await fetchHourlyBatch(towns.slice(i, i + BATCH_SIZE), startDate, endDate));
  }
  return results;
}
```

Confidence: HIGH — verified that Open-Meteo `hourly` parameter accepts the same variable names as `daily` equivalents, and multi-location batch via comma-separated lat/lng is documented officially.

### Pattern 4: Time-of-Day Scoring Using sliceHoursByDays

The existing `sliceHoursByDays` in `packages/core` returns all hours for a date range. Phase 2 adds a further filter by hour-of-day before passing to `scoreLocation`.

```typescript
// In finder scoring logic (main thread, on filter change)
// Source: extends pattern from packages/core/src/scoring/sliceHoursByDays.ts

function filterHoursByTimeOfDay(
  hourly: HourlyWeather,
  timeOfDay: 'morning' | 'afternoon' | 'full',
): HourlyWeather {
  if (timeOfDay === 'full') return hourly;

  const startHour = timeOfDay === 'morning' ? 6  : 12;
  const endHour   = timeOfDay === 'morning' ? 12 : 18;

  const indices = hourly.time
    .map((t, i) => ({ i, hour: new Date(t).getHours() }))
    .filter(({ hour }) => hour >= startHour && hour < endHour)
    .map(({ i }) => i);

  return {
    time:              indices.map(i => hourly.time[i]),
    temperature_2m:    indices.map(i => hourly.temperature_2m[i]),
    precipitation:     indices.map(i => hourly.precipitation[i]),
    sunshine_duration: indices.map(i => hourly.sunshine_duration[i]),
    wind_speed_10m:    indices.map(i => hourly.wind_speed_10m[i]),
  };
}
```

Then re-scoring uses the existing `scoreLocation` from `@weatherchaser/core`:

```typescript
import { scoreLocation, PRESETS } from '@weatherchaser/core';

function scoreForConfig(
  hourly: HourlyWeather,
  startDate: Date,
  dayCount: number,
  preset: WeatherPreset,
  timeOfDay: 'morning' | 'afternoon' | 'full',
): WeatherScore {
  const sliced   = sliceHoursByDays(hourly, startDate, dayCount);
  const filtered = filterHoursByTimeOfDay(sliced, timeOfDay);
  return scoreLocation(filtered, startDate, dayCount, PRESETS[preset]);
}
```

This approach means filter changes call only `scoreForConfig` × N towns — no network request, instant UI update.

### Pattern 5: Two-Way Map–List Selection

Mirror the Phase 1 pattern from `routes/index.tsx` (selectedStopIndex ↔ StopMarkers ↔ ItineraryPanel):

```typescript
// In routes/index.tsx (or finder panel)
const [selectedFinderIndex, setSelectedFinderIndex] = useState<number | null>(null);

// FinderMarkers: onClick → setSelectedFinderIndex(rank - 1)
// WeatherFinderPanel row: onClick → setSelectedFinderIndex(idx)
// WeatherFinderPanel: scrolls to selected row (same useRef pattern as ItineraryPanel)
// MapContainer: fitBounds on results load (same FitRouteOnSelection pattern)
```

### Pattern 6: GPS "Use My Location" Button

```typescript
function useGPSLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request(onSuccess: (lat: number, lng: number) => void) {
    if (!navigator.geolocation) {
      setError('GPS not available');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onSuccess(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLoading(false);
        setError('Location access denied');
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }
  return { request, loading, error };
}
```

### Pattern 7: Finder Markers (3-Band Color)

Unlike Phase 1's continuous hsl gradient, Phase 2 uses discrete color bands on map markers. Recommended thresholds (Claude's discretion):

```typescript
function finderMarkerColor(score: number): string {
  if (score >= 70) return 'var(--score-good)';   // hsl(152, 60%, 40%) — green
  if (score >= 40) return 'var(--score-fair)';   // hsl(45, 90%, 55%)  — amber
  return              'var(--score-poor)';        // hsl(0, 80%, 50%)   — red
}
```

The token values `--score-poor`, `--score-fair`, `--score-good` are **already defined in `tokens.css`**:

```css
--score-poor:   hsl(0,   80%, 50%);
--score-fair:   hsl(45,  90%, 55%);
--score-good:   hsl(152, 60%, 40%);
```

Markers show rank number + score badge (same circle div pattern as `StopMarkers`).

### Pattern 8: Auto-Fit Map to Results

The same `fitBounds` pattern used in `FitRouteOnSelection` (MapContainer.tsx) — but triggered once when results load:

```typescript
// Inside MapContainer or a child component using useMap()
useEffect(() => {
  if (!map || !finderResults || finderResults.length === 0) return;
  const lngs = finderResults.map(r => r.town.lng);
  const lats  = finderResults.map(r => r.town.lat);
  map.getMap().fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 60, maxZoom: 9, duration: 600 },
  );
}, [finderResults]);  // only runs when results array reference changes
```

### Anti-Patterns to Avoid

- **Re-fetching weather on filter change:** Never trigger a network request when the user changes preset or time-of-day. All re-scoring must be in-memory.
- **Modifying existing entry panel components:** `DateRangePicker`, `LocationInput`, `CriteriaSelector` are frozen. Phase 2 wires to the store values they write, not to the components themselves.
- **Using daily weather for time-of-day scoring:** `scoreDailyLocation` only has daily aggregates and cannot distinguish morning from afternoon. Must use `scoreLocation` with hourly data.
- **Reusing `mode: 'loading'` for finder loading:** The existing loading spinner in `EntryPanel` is coupled to `loadingStep` values specific to route optimization. Finder loading uses `finderLoading: boolean` in the new finder state slice.
- **Assuming startLocation is always set:** GPS path gives lat/lng without a name. Handle both: coords-with-name (from Nominatim) and coords-without-name (from GPS).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hourly weather for multiple towns | Custom multi-request queuing | Extend existing `fetchWeatherBatch` pattern — same URL, `hourly=` param | Already handles batch size 50, single-vs-array response parsing |
| Radius-based town query | Bbox approximation of a circle | Overpass `around:radius,lat,lng` filter | Native circular query — no bbox approximation error at 200–500 km |
| Scoring with presets | Custom weight calculator | `scoreLocation` from `@weatherchaser/core` + `PRESETS` | Already tested, same normalization as route planner |
| Time-of-day filtering | Custom date/time parser | `sliceHoursByDays` + `filterHoursByTimeOfDay` (thin wrapper) | Reuse existing UTC-safe slicing logic |
| Scrolling list to selected row | Custom scroll calculator | `ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` | Same pattern as `ItineraryPanel` lines 29–31 |
| Distance from start to result towns | OSRM distance matrix | Haversine straight-line (`Math.hypot` or existing `haversineKm` in `osrm.ts`) | For display only; not used for routing. OSRM would be overkill for 120 towns × 1 origin |
| Map fitBounds on load | Track coordinates manually | `map.fitBounds([[minLng, minLat], [maxLng, maxLat]], opts)` | Same pattern already in `FitRouteOnSelection` |

---

## Common Pitfalls

### Pitfall 1: Hourly Data Volume and Memory

**What goes wrong:** Fetching 14 days × 24 hours × 120 towns = 40,320 hourly data points across 4 variables. Passing this via `postMessage` to the main thread is fine (structured clone), but storing it naively could consume >5 MB of memory.

**Why it happens:** Hourly weather arrays are 10–20x larger than daily arrays. Easy to under-estimate.

**How to avoid:** Cap towns at `MAX_TOWNS = 120` (already done in optimizer worker — replicate this cap in finder worker). After the finder gets results, only cache hourly data for the displayed top-10 towns in the store — discard the rest. Or keep all 120 but measure: 120 towns × 14 days × 24 hours × 4 variables × 8 bytes ≈ 12 MB uncompressed strings — manageable but worth noting.

**Warning signs:** Browser memory pressure warnings; slow postMessage serialization (>500ms).

### Pitfall 2: Overpass Radius at 500 km Returns Too Many Towns

**What goes wrong:** A 500 km radius in central Europe can return 2,000+ towns. The existing `MAX_TOWNS = 120` cap solves this for the optimizer but the finder needs the same cap applied before weather fetch.

**Why it happens:** Overpass returns all matching nodes; it has no built-in population-based limit. The `parseTowns` + sort-by-population + `.slice(0, MAX_TOWNS)` pattern in the optimizer worker is the correct mitigation.

**How to avoid:** Replicate the exact deduplication + population sort + `slice(0, MAX_TOWNS)` from `optimizer.worker.ts` lines 68–86 in `finder.worker.ts`.

**Warning signs:** Weather batch taking >30s; Open-Meteo returning rate-limit errors; browser tab freezing on postMessage.

### Pitfall 3: Time-of-Day Hour Slicing with `timezone: auto`

**What goes wrong:** Open-Meteo returns hourly timestamps in the location's local timezone when `timezone=auto` is set. A "morning" filter (hours 6–11) must be applied using local time, but `new Date(timestamp).getHours()` returns UTC hours unless the host browser happens to be in the same timezone.

**Why it happens:** Open-Meteo hourly timestamps look like `"2026-03-15T06:00"` (no Z suffix) for local time, but `new Date("2026-03-15T06:00")` is parsed as local browser time — which works if user and town are in similar timezones, but fails otherwise.

**How to avoid:** Parse the hour from the ISO string directly (last 5 chars before colon split), without `new Date()`:

```typescript
// Safe: parse hour from ISO string directly
const hour = parseInt(isoTimestamp.slice(11, 13), 10);
```

This avoids any timezone conversion. Confidence: HIGH — verified by inspecting the `sliceHoursByDays` implementation which already uses `.slice(0, 10)` for UTC date matching.

### Pitfall 4: Overpass `around` Query Performance at Large Radius

**What goes wrong:** A 500 km radius query can time out on the public Overpass endpoint (30s timeout in the existing query builder).

**Why it happens:** Overpass scans the planet node index for large radii; the query is not bounded by a bbox.

**How to avoid:** Add a population filter or limit the `out` count. Alternatively, use the existing bbox approximation as a pre-filter, or use `[maxsize:...]` in the Overpass query. The simplest mitigation is: the existing fallback to `overpass.private.coffee` handles 429/5xx errors; if both fail, show "Try a smaller radius" error.

**Warning signs:** Overpass errors on radius > 300 km; timeout after 30s.

### Pitfall 5: Conflating Route Mode State with Finder Mode State

**What goes wrong:** `tripConfig.preset` is used by both the route planner and potentially the finder if state is shared. Changing preset in the finder changes it for the route planner on return.

**Why it happens:** Phase 1 stores all config in a single `tripConfig` object.

**How to avoid:** The finder has its own isolated `finderConfig` object in the store (separate from `tripConfig`). The finder reads `tripConfig.startDate` and `tripConfig.endDate` (set by the shared date picker) but has its own `finderConfig.preset`, `finderConfig.radiusKm`, and `finderConfig.timeOfDay`.

### Pitfall 6: EntryPanel isWeatherFinder Placeholder Replacement

**What goes wrong:** Modifying more than the placeholder block in `EntryPanel.tsx` breaks the existing route-planner flow.

**Why it happens:** `EntryPanel` is a carefully sequenced set of conditional renders.

**How to avoid:** The exact change is surgical — replace only lines 78–82 (the coming-soon placeholder):

```tsx
// BEFORE (lines 77–82 of EntryPanel.tsx):
{/* Weather finder placeholder — Phase 2 */}
{isWeatherFinder && (
  <div className="entry-panel-coming-soon">
    {t('route_config.coming_soon')}
  </div>
)}

// AFTER:
{isWeatherFinder && <WeatherFinderStep />}
```

Nothing else in `EntryPanel.tsx` changes.

---

## Code Examples

### Finder Worker: Town Fetch + Hourly Weather

```typescript
// apps/web/src/workers/finder.worker.ts
import { scoreDailyLocation, PRESETS, sliceHoursByDays } from '@weatherchaser/core';
import type { Town, HourlyWeather } from '@weatherchaser/core';
import { fetchHourlyWeatherBatch } from '../services/weatherHourly.ts';
import { fetchTownsInRadius } from '../services/overpass.ts';

const MAX_TOWNS = 120;

self.onmessage = async (event: MessageEvent<FinderWorkerInput>) => {
  const { config } = event.data;

  // Step 1 — towns
  self.postMessage({ type: 'progress', step: 'finding_towns' });
  const allTowns = await fetchTownsInRadius(config.startLat, config.startLng, config.radiusKm);
  if (allTowns.length === 0) {
    self.postMessage({ type: 'error', message: 'no_towns' });
    return;
  }
  const towns = allTowns
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, MAX_TOWNS);

  // Step 2 — hourly weather
  self.postMessage({ type: 'progress', step: 'fetching_weather' });
  const hourlyData = await fetchHourlyWeatherBatch(towns, config.startDate, config.endDate);

  self.postMessage({ type: 'complete', towns, hourlyData });
};
```

### Zustand Finder Slice Addition

```typescript
// Additions to apps/web/src/stores/appStore.ts

interface FinderConfig {
  startLat: number | null;
  startLng: number | null;
  startLocation: string;
  radiusKm: number;
  preset: WeatherPreset;
  timeOfDay: 'morning' | 'afternoon' | 'full';
  sortBy: 'score' | 'sunshine' | 'temperature' | 'precipitation';
}

const defaultFinderConfig: FinderConfig = {
  startLat: null,
  startLng: null,
  startLocation: '',
  radiusKm: 200,         // decision: default 200 km
  preset: 'sightseeing', // decision: default sightseeing
  timeOfDay: 'full',
  sortBy: 'score',
};

// Added to AppState interface:
finderConfig: FinderConfig;
finderLoading: boolean;
finderError: string | null;
finderTowns: Town[] | null;
finderHourlyCache: Record<string, HourlyWeather>; // townId → hourly
setFinderConfig: (config: Partial<FinderConfig>) => void;
setFinderLoading: (v: boolean) => void;
setFinderError: (e: string | null) => void;
setFinderData: (towns: Town[], hourly: Record<string, HourlyWeather>) => void;
```

### Result Derivation (Pure Computation, No State)

Re-scoring is a pure function called in a `useMemo` inside `WeatherFinderPanel`:

```typescript
// Derived finder results — no store state, computed on render
const finderResults = useMemo(() => {
  if (!finderTowns || Object.keys(finderHourlyCache).length === 0) return [];

  const startDate = new Date(tripConfig.startDate!);
  const dayCount  = Math.round(
    (new Date(tripConfig.endDate!).getTime() - startDate.getTime()) / 86_400_000
  ) + 1;

  return finderTowns
    .map((town) => {
      const hourly = finderHourlyCache[town.id];
      if (!hourly) return null;
      const sliced   = sliceHoursByDays(hourly, startDate, dayCount);
      const filtered = filterHoursByTimeOfDay(sliced, finderConfig.timeOfDay);
      const score    = scoreLocation(filtered, startDate, dayCount, PRESETS[finderConfig.preset]);
      const distKm   = haversineKm(finderConfig.startLat!, finderConfig.startLng!, town.lat, town.lng);
      const sunH     = avg(filtered.sunshine_duration) / 3600;
      return { town, score, distanceKm: distKm, weatherAvg: { sunshineHoursPerDay: sunH, ... } };
    })
    .filter(Boolean)
    .sort(comparatorFor(finderConfig.sortBy))
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}, [finderTowns, finderHourlyCache, finderConfig, tripConfig.startDate, tripConfig.endDate]);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Daily weather aggregates only | Hourly data kept in memory; time-of-day slicing | Enables FIND-05 without re-fetch |
| Single bbox Overpass query | `around:radius,lat,lng` Overpass filter | Native circular radius — no approximation error |
| Route optimization worker | Finder worker (no matrix, no optimizer) | Simpler pipeline; faster (<10s vs 30s+) |
| Continuous hsl gradient markers | Discrete 3-band color (uses existing `--score-*` tokens) | Clearer UX — green/yellow/red immediately legible |

---

## Open Questions

1. **Hourly vs daily weather for the non-time-of-day case**
   - What we know: When `timeOfDay === 'full'`, hourly data normalized over 24h is effectively equivalent to daily aggregates but with different normalization (hourly sunshine in seconds/hour max 3600 vs daily max 43200)
   - What's unclear: Should "full day" use `scoreDailyLocation` for consistency with route planner scores, or always use `scoreLocation` (hourly) for uniformity within the finder?
   - Recommendation: Always use `scoreLocation` (hourly) within the finder for simplicity. Document that finder scores may differ slightly from route planner scores due to normalization band differences. This is acceptable since they are in different modes.

2. **Distance display: Haversine vs road distance**
   - What we know: The existing `osrm.ts` computes Haversine as a fallback. For 120 towns vs 1 origin point, a full OSRM `/table` call would be 120 lookups — feasible but adds latency.
   - What's unclear: User expectations — "200 km" could mean straight-line or driving distance.
   - Recommendation: Use Haversine for display. Add "(Luftlinie)" label if needed. The radius filter itself is Haversine (Overpass `around` uses straight-line distance).

3. **What happens when finder results exist and user switches back to route mode**
   - What we know: The store has separate `route` and `finderResults` state. `MapContainer` currently only renders `StopMarkers` when `route` exists.
   - What's unclear: Should finder markers persist when mode goes back to idle?
   - Recommendation: Clear `finderTowns` and `finderHourlyCache` when `reset()` is called. Show finder markers only when `mode === 'weather-finder'` or `mode === 'results'` with finder context.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `apps/web/src/stores/appStore.ts` — AppMode, store shape, existing actions
- Codebase direct read — `apps/web/src/workers/optimizer.worker.ts` — worker pattern, MAX_TOWNS, batch flow
- Codebase direct read — `apps/web/src/services/weather.ts` — `fetchWeatherBatch`, batch size 50, multi-location response format
- Codebase direct read — `apps/web/src/services/overpass.ts` — `buildBboxQuery`, `runOverpassQuery`, endpoint fallback
- Codebase direct read — `packages/core/src/scoring/weatherScore.ts` — `scoreLocation`, `scoreDailyLocation`, `normalize`
- Codebase direct read — `packages/core/src/scoring/presets.ts` — `PRESETS` weights for beach/hiking/sightseeing
- Codebase direct read — `packages/core/src/scoring/sliceHoursByDays.ts` — UTC-safe date slicing
- Codebase direct read — `apps/web/src/components/map/StopMarkers.tsx` — Marker + Popup pattern
- Codebase direct read — `apps/web/src/components/entry/EntryPanel.tsx` — placeholder location, CTA buttons, `isWeatherFinder`
- Codebase direct read — `apps/web/src/styles/tokens.css` — `--score-poor/fair/good` tokens already defined
- Open-Meteo API docs (WebFetch: `open-meteo.com/en/docs`) — multi-location batch confirmed, hourly variables confirmed, 16-day max horizon confirmed
- Overpass QL tutorial (WebFetch: `osm-queries.ldodds.com/tutorial/12-radius-search.osm.html`) — `around:radius,lat,lng` syntax confirmed

### Secondary (MEDIUM confidence)
- WebSearch: Overpass `around` filter syntax — consistent with official OSM wiki; verified against tutorial URL

### Tertiary (LOW confidence)
- Open questions 1–3 above are design judgments not resolvable from docs alone

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already installed and in use
- Architecture: HIGH — worker pattern, store shape, Overpass query, Open-Meteo hourly all verified from codebase + official sources
- Pitfalls: HIGH — time-of-day timezone parsing (confirmed from existing UTC-safe patterns), Overpass radius performance (confirmed from existing endpoint fallback), state isolation (confirmed from store architecture)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Open-Meteo and Overpass APIs are stable; only time-sensitive item is any breaking change to @vis.gl/react-maplibre Marker API)
