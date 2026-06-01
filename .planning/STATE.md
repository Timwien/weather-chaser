# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Show travelers where the best weather is — and for campervan trips, the optimal multi-day route to chase it — through real towns, not dots on a grid
**Current focus:** Phase 3 — Backend + Auth + Production Hosting

## Current Position

Phase: 3.2 complete (executed out of sequence) — Phase 3 and 3.1 still open
Current plan: 03.2-01 complete (dark mode + i18n). Phase 3 still has 03-07 (production deploy, needs user setup); Phase 3.1 (mobile web UX) not started.
Last activity: 2026-06-01 — Phase 3.2 Plan 01 complete (auto dark mode + i18n enforcement)

Progress: [█████████░] 88% (Phases 1, 2, 3.2 complete; Phase 3 at 6/7; Phase 3.1 not started)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~35 min
- Total execution time: ~221 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-algorithm-route-planner-web | 7 | ~221 min | ~31.6 min |

**Recent Trend:**
- Last 7 plans: 01-01 (10 min), 01-02 (3 min), 01-04 (3 min), 01-05 (15 min), 01-03 (30 min), 01-06 (120 min), 01-07 (~40 min)
- Trend: 01-07 included several bug fixes + pipeline implementation across multiple sessions

*Updated after each plan completion*

| Phase/Plan | Duration | Tasks | Files |
|-----------|---------|-------|-------|
| Phase 01 P06 | 120 min | 3 tasks | 10 files |
| Phase 01 P09 | 15 | 2 tasks | 10 files |
| Phase 02 P01 | 15 min | 2 tasks | 3 files |
| Phase 02-weather-finder-mode P02 | 7 | 2 tasks | 2 files |
| Phase 02-weather-finder-mode P03 | 12 | 2 tasks | 8 files |
| Phase 02-weather-finder-mode P04 | 8 | 2 tasks | 3 files |
| Phase 02-weather-finder-mode P05 | 2 | 2 tasks | 2 files |
| Phase 02-weather-finder-mode P06 | 30 | 2 tasks | 7 files |
| Phase 03 P01 | 6 min | 2 tasks | 7 files |
| Phase 03 P02 | 8 min | 2 tasks | 5 files |
| Phase 03 P03 | 3 min | 2 tasks | 6 files |
| Phase 03-backend-auth-production-hosting P04 | ~90 min | 3 tasks | 13 files |
| Phase 03-backend-auth-production-hosting P06 | 4 min | 2 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 4 added: Mobile Web UX — map-first layout with compact search bar and bottom sheet panels (former Phase 4 Freemium → 5, former Phase 5 Native Apps → 6)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Full rebuild — not incremental patching. Static HTML/JS MVP is proof-of-concept only.
- [Init]: Turborepo monorepo with packages/core (pure TS algorithm), apps/web, apps/mobile, apps/api
- [Init]: MapLibre GL JS on web, @rnmapbox/maps on native — two distinct map implementations, not shared
- [Init]: Route optimizer runs client-side (fast, deterministic, no server round-trip)
- [Init]: Supabase (Frankfurt region) for auth + Postgres + GDPR compliance
- [01-01]: allowImportingTsExtensions: true added to apps/web tsconfig — required for .tsx imports with Bundler moduleResolution + noEmit; Vite handles bundling
- [01-01]: packages/core exports map pre-declares ./scoring and ./optimizer sub-paths for Plans 02 and 03
- [01-02]: vitest@4.0.18 chosen for packages/core test framework — native ESM, zero-config
- [01-02]: Precipitation uses totalPrecipMm (sum over stay window) not average — better reflects multi-day accumulation
- [01-02]: Date matching by UTC YYYY-MM-DD prefix on ISO timestamps — aligns with Open-Meteo API format
- [01-02]: sliceHoursByDays extracted to own file when weatherScore.ts exceeded 80 lines (per plan REFACTOR rule)
- [01-04]: createRoute (with getParentRoute) used instead of createFileRoute in TanStack Router v1 — createFileRoute requires Vite codegen plugin for correct types in manual route tree construction
- [01-04]: MapLibre demotiles.maplibre.org used as dev tile style — no token required; production tile provider is Phase 3
- [01-04]: Zustand store fully shaped from day one — all Phase 1 UI plans can use useAppStore without store changes
- [01-05]: MaplibreTerradrawControl (IControl) used — plan referenced fictional MaplibreGlTerradraw class; drawing activated via getTerraDrawInstance().setMode('polygon')
- [01-05]: useMap() destructured as { current: map } — hook returns { current?: MapRef } not { map: MapRef }
- [01-05]: Phase 1 uses public Nominatim and Overpass endpoints directly — Phase 3 adds server-side proxy
- [01-03]: distanceMatrix is km (per type definition // km distances NxN) — no /1000 conversion in assignStops
- [01-03]: addDays extracted to optimizer/dateUtils.ts when assignStops.ts exceeded 100 lines
- [01-03]: Must-visit anchoring is two-stage: NN 2x-threshold preference + post-2-opt explicit swap to boundary
- [Phase 01]: Petrol teal #0E7490 chosen as primary accent — Cyan-700 reads premium without being turquoise-bright
- [Phase 01]: Calendar popover built custom (no library) — 2-month grid in ~150 lines avoids dependency for Phase 1
- [Phase 01]: CartoDB Positron GL replaces demotiles.maplibre.org — free, no API key, clean Google Maps aesthetic
- [Phase 01]: searchAreas[] array added alongside legacy searchArea in store — polygon draw callbacks use legacy; Plan 07 migrates
- [01-07]: @vis.gl/react-maplibre MapRef only proxies functions — handler objects (dragPan, scrollZoom, etc.) require map.getMap() to access the native maplibre-gl Map instance
- [01-07]: CartoDB Positron GL labels switched to German via setLayoutProperty on all symbol layers in onLoad callback using ['coalesce', ['get', 'name:de'], ['get', 'name']]
- [01-07]: OSRM /table endpoint used with 8s AbortSignal timeout; Haversine fallback at 70 km/h average driving speed when OSRM unavailable
- [01-07]: Towns capped at MAX_TOWNS=120, sorted by population desc before cap — ensures most relevant towns fit
- [01-07]: Dev search area defaults (6 Bavarian/Austrian/Swiss places) gated behind import.meta.env.DEV; requires vite-env.d.ts triple-slash reference
- [Phase 01-09]: createRoute (with getParentRoute) used for /trip route — consistent with index.tsx pattern; createFileRoute requires Vite codegen plugin
- [Phase 01-09]: btoa(encodeURIComponent(JSON.stringify(payload))) encoding for share URLs — handles Unicode town names (e.g. München, Zürich) that plain btoa would fail on
- [Phase 01-09]: ItineraryPanel created as stub here (Plan 09) with ShareBar included — Plan 08 expands it without import conflicts
- [02-01]: HourlyWeather imported from @weatherchaser/core instead of redefined locally — core type matches Open-Meteo hourly response shape exactly
- [02-01]: fetchTownsInRadius reuses runOverpassQuery with endpoint fallback — no code duplication, same retry/timeout behavior as existing fetchTownsInArea
- [02-01]: FinderTimeOfDay and FinderSortBy exported as union types so UI components can type-check without reaching into store internals
- [Phase 02-weather-finder-mode]: finder.worker.ts has no scoring step — all filter/preset/sort changes re-applied in memory; worker only runs on initial search
- [Phase 02-weather-finder-mode]: useFinder does not auto-run on mount — explicit run() call required (WeatherFinderStep in Plan 03 triggers it)
- [Phase 02-weather-finder-mode]: searchPlace() used instead of searchNominatim() — plan referenced non-existent export; nominatim.ts exports searchPlace() returning NominatimResult[]
- [Phase 02-weather-finder-mode]: onMouseDown used for suggestion selection in WeatherFinderStep — prevents input blur from collapsing dropdown before click fires
- [02-04]: HourlyWeather type matches @weatherchaser/core exactly — no as any casts needed in WeatherFinderPanel useMemo
- [02-04]: scoreLocation called with already-sliced+time-filtered data; internal re-slice safe (date prefix matching valid on time-filtered subset)
- [02-04]: filterHoursByTimeOfDay uses t.slice(11,13) for hour parsing — avoids UTC conversion bug with Open-Meteo local-time timestamps
- [02-04]: FinderResultData carries lat/lng fields for downstream marker highlighting (Plan 05)
- [02-05]: FinderMarkers receives pre-scored results as prop — no re-scoring inside the component
- [02-05]: FitFinderBounds prevLengthRef guard fires fitBounds only once when results first load, not on sort/filter changes
- [02-05]: mode read from useAppStore() inside MapContainer — no prop drilling; StopMarkers+RouteLayer suppressed in weather-finder mode
- [02-06]: Finder origin unified with Wo? location: searchAreas[0].lat/lng is single source — WeatherFinderStep is now a confirmation step, not an input step
- [02-06]: Finder radius unified with Wo? radius slider: searchRadiusKm drives both use cases — FinderFilterBar no longer has its own distance slider
- [02-06]: WeatherFinderPanel.tsx useMemo deps include searchAreas and searchRadiusKm so results refilter instantly when radius slider changes
- [02-06-fixes]: Three finder modes: around (1 place), polygon (drawn polygon), multi-place (>1 places — Overpass skipped)
- [02-06-fixes]: Continuous hsl score gradient replaces 3-band color coding everywhere in finder (matches StopMarkers)
- [02-06-fixes]: FinderTimeOfDay: 'afternoon' replaced with 'evening' (17:00–21:59); order: full | morning | evening
- [02-06-fixes]: selectedDay field in FinderConfig drives per-day slicing in panel without re-fetch; day picker UI in FinderFilterBar
- [02-06-fixes]: windAvgKmh in FinderResultData; sunshine formula: sum(seconds)/3600/dayCount for true per-day hours
- [03-01]: Vercel Web fetch handler format (export default { async fetch(request: Request): Promise<Response> }) used — modern preferred format for Edge/Node runtimes
- [03-01]: apps/web tsconfig.json include extended to add 'api' so serverless function files are type-checked by pnpm type-check
- [03-01]: @supabase/supabase-js added to apps/web production dependencies for keepalive.ts serverless function
- [03-01]: Overpass proxy forwards raw POST body verbatim — client sends data=<encoded query> as form-urlencoded, proxy passes through unchanged
- [03-01]: OPEN_METEO_API_KEY optional in weather proxy — appended as apikey param only if set, allowing free-tier use without config
- [03-02]: Auth store initialize() returns unsubscribe fn — called in Root wrapper useEffect for StrictMode-safe cleanup; not module-level init
- [03-02]: pendingAction consumed by UI layer (not auth store) — store logs SIGNED_IN+pending event but does not execute; UI clears after executing
- [03-02]: VITE_ prefix only on SUPABASE_URL and SUPABASE_ANON_KEY — anon key is designed public/safe in bundles; service_role key must never get VITE_ prefix
- [03-03]: import.meta.env.PROD ternary pattern for service base URLs — PROXY = '/api/proxy/X', DIRECT = 'https://...', base = PROD ? PROXY : DIRECT; URL built with new URL(base, window.location.origin)
- [03-03]: weather.ts (daily) and weatherHourly.ts (hourly) kept as separate services — different return types (DailyWeather vs HourlyWeather), different callers (optimizer.worker vs finder.worker)
- [03-03]: Weather proxy extended to forward start_date, end_date, daily params — batch services use date-range mode; original proxy only supported forecast_days+hourly
- [03-03]: !import.meta.env.PROD guard for OSRM public demo server — production goes configured OSRM URL → Haversine fallback, never touching demo server
- [Phase 03-04]: useRef for prevUser tracking in AccountModal/InlineSignInPrompt — plain object literal resets on every render; useRef persists across re-renders for null→truthy user transition detection
- [Phase 03-04]: SettingsTab delete account calls DELETE /api/user/delete (not direct Supabase client) — server-side endpoint needed for GDPR-compliant deletion across all tables; service_role key must never be in client bundle
- [Phase 03-04]: Lazy Supabase init via getSupabase() — returns null when env vars absent; authStore.initialize() guards on null; app loads in guest mode without .env.local
- [Phase 03-04]: Tab bar uses CSS grid repeat(3,1fr) — guarantees equal tab widths for both Deutsch and English text lengths
- [Phase 03-04]: Language switcher in SettingsTab available to all users (not login-gated) — guest users need language access to read sign-in UI in their preferred language
- [Phase 03-05]: userdata.ts uses getSupabase() per call — consistent lazy init, throws if not configured, callers guard with supabaseConfigured
- [Phase 03-05]: as any casts on supabase v2.98 .insert() — insert types resolve to never without full auto-generated Database schema; runtime correct, guarded by explicit return type annotations
- [Phase 03-05]: buildRouteName uses s.town.name (not s.name) — Stop interface has town.name, not a direct name property
- [Phase 03-05]: Guest save button: opacity 0.5, cursor pointer — visible and clickable but visually dimmed; clicking opens InlineSignInPrompt inline below button
- [Phase 03-06]: Two-step deletion: anon client validates token (getUser), admin client deletes user (auth.admin.deleteUser) — prevents arbitrary user deletion attacks
- [Phase 03-06]: SUPABASE_SERVICE_ROLE_KEY without VITE_ prefix — process.env in serverless api/ functions only; verified never in apps/web/src/
- [Phase 03-06]: localStorage key wc_first_route_hint_shown persists one-time guest hint permanently; useEffect deps [route, user] fire exactly once when guest first generates a route
- [Phase 03.2]: Plan re-scoped before execution — typography/glassmorphism/micro-animations already existed ad-hoc; plan built only the two missing parts (auto dark mode + i18n enforcement)
- [Phase 03.2]: Dark mode = [data-theme] attr on <html> + single [data-theme=dark] token override block in tokens.css; all token-driven components adapt automatically (no per-component dark styles)
- [Phase 03.2]: Theme source of truth = localStorage key wc-theme (plain zustand store, not persist middleware); pre-paint inline script in index.html reads it before first paint to prevent flash; initTheme() matchMedia listener re-applies only while mode==='system'
- [Phase 03.2]: Theme DB-sync deferred — no user-preferences table exists; localStorage-only persistence
- [Phase 03.2]: i18n gap was larger than the attribute-only audit suggested — SavedTab had 6 hardcoded German strings + DateRangePicker 'Clear'; all moved to keys. Brand names (Google/Apple) and language self-names (Deutsch/English) intentionally left untranslated. EN/DE parity: 170/170 keys
- [Phase 03.2]: First executor run crashed (API ConnectionRefused) after Task 1 code but before commit; recovered by verifying Task 1, completing Task 2, committing both atomically

### Pending Todos

- [pre-launch] Finder-Suchen: add save button in the finder UI so users can save searches (currently the SavedTab section is always empty — no UI to create entries)
- [pre-launch] Email delivery: configure Resend custom SMTP (already in memory file)

### Blockers/Concerns

- [Phase 1]: @rnmapbox/maps + current Expo SDK compatibility must be verified before committing to map stack (research flag from SUMMARY.md)
- [Phase 1]: Open-Meteo free tier commercial use policy must be verified — may require commercial plan from launch
- [Phase 1]: Nominatim/OSRM demo server production policies must be confirmed; self-hosting/proxying is the answer regardless
- [Phase 3]: OSRM self-hosting requirements (memory, disk, EU OSM extract update cadence) need verification

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 03-06-PLAN.md — GDPR deletion endpoint (api/user/delete.ts, service_role server-side), one-time guest save hint in EntryPanel (localStorage persisted)
Resume file: None
