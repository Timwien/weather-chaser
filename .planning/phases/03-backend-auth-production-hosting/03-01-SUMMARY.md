---
phase: 03-backend-auth-production-hosting
plan: "01"
subsystem: infra
tags: [vercel, serverless, open-meteo, overpass, nominatim, supabase, proxy, cdn-cache]

# Dependency graph
requires: []
provides:
  - Vercel serverless proxy for Open-Meteo with 6h CDN cache
  - Vercel serverless proxy for Overpass API with 24h CDN cache
  - Vercel serverless proxy for Nominatim with 1h CDN cache
  - Keepalive endpoint to prevent Supabase free-tier auto-pause
  - vercel.json with fra1 region, SPA rewrite, Fluid Compute, cron config
affects: [03-03, 03-04, 03-05, 03-06, 03-07]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js (apps/web dependency for keepalive.ts)"]
  patterns:
    - "Vercel Web fetch handler format: export default { async fetch(request: Request): Promise<Response> }"
    - "CDN cache via Cache-Control s-maxage header on serverless function responses"
    - "Negative-lookahead SPA rewrite: /((?!api/).*) -> /index.html passes /api/* to functions"

key-files:
  created:
    - apps/web/api/proxy/weather.ts
    - apps/web/api/proxy/overpass.ts
    - apps/web/api/proxy/nominatim.ts
    - apps/web/api/keepalive.ts
    - apps/web/vercel.json
  modified:
    - apps/web/tsconfig.json
    - apps/web/package.json

key-decisions:
  - "Vercel Web fetch handler format (export default { async fetch }) used instead of Express-style req/res — Vercel's preferred modern handler format for Edge/Node runtimes"
  - "apps/web tsconfig.json include extended to add 'api' so serverless function files are type-checked by pnpm type-check"
  - "@supabase/supabase-js added to apps/web (not a devDependency) — required at runtime by keepalive.ts serverless function"
  - "Overpass proxy forwards raw POST body verbatim — client sends data=<encoded query> as form-urlencoded, proxy passes it through unchanged"
  - "OPEN_METEO_API_KEY optional env var in weather proxy — appended as apikey param only if set, allowing free-tier use without config"

patterns-established:
  - "Serverless proxy pattern: validate params -> build upstream URL -> fetch with policy headers -> return with Cache-Control"
  - "Graceful keepalive: Supabase client only created if env vars present; DB errors swallowed — 200 returned regardless"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, WTHR-02]

# Metrics
duration: 6min
completed: 2026-03-05
---

# Phase 03 Plan 01: Vercel Serverless Proxies Summary

**Four Vercel Web fetch handler proxies (Open-Meteo 6h, Overpass 24h, Nominatim 1h, Supabase keepalive) with fra1 region config and SPA rewrite in vercel.json**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T14:54:51Z
- **Completed:** 2026-03-05T15:01:36Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Four serverless function files created: weather, overpass, nominatim proxies + keepalive endpoint
- vercel.json configures fra1 region, Fluid Compute, SPA rewrite with negative lookahead, and keepalive cron (every 3 days at noon)
- @supabase/supabase-js installed in apps/web for the keepalive endpoint
- tsconfig.json updated to include `api/` directory so all proxy files are fully type-checked

## Task Commits

Each task was committed atomically:

1. **Task 1: Create weather and Overpass proxy functions** - `9b60d29` (feat)
2. **Task 2: Create Nominatim proxy, keepalive endpoint, and vercel.json** - `54ab84d` (feat)

**Plan metadata:** committed with SUMMARY.md update

## Files Created/Modified
- `apps/web/api/proxy/weather.ts` - Open-Meteo proxy; GET handler with lat/lng/forecast_days/hourly params; 6h CDN cache (s-maxage=21600)
- `apps/web/api/proxy/overpass.ts` - Overpass API proxy; POST handler forwarding raw QL body; 24h CDN cache (s-maxage=86400)
- `apps/web/api/proxy/nominatim.ts` - Nominatim geocoding proxy; GET handler with User-Agent/Referer policy headers; 1h CDN cache (s-maxage=3600)
- `apps/web/api/keepalive.ts` - Supabase keepalive ping; returns 200 regardless of DB result
- `apps/web/vercel.json` - Vite framework, fra1 region, Fluid Compute, SPA rewrite with negative lookahead, keepalive cron
- `apps/web/tsconfig.json` - Added `api` to include array
- `apps/web/package.json` - Added @supabase/supabase-js dependency

## Decisions Made
- Used Vercel Web fetch handler format (`export default { async fetch(request: Request): Promise<Response> }`) instead of Express-style `(req, res)` — this is Vercel's modern preferred format for Edge and Node runtimes
- Extended `apps/web/tsconfig.json` include to cover `api/` directory so all serverless function files participate in `pnpm type-check`
- `@supabase/supabase-js` added as a production dependency in apps/web (not devDependency) since keepalive.ts imports it at runtime in the serverless function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `api` to apps/web tsconfig include**
- **Found during:** Task 1 (creating weather and overpass proxy files)
- **Issue:** `apps/web/tsconfig.json` only included `src` and `vite.config.ts`; api/ files would be excluded from type-checking
- **Fix:** Added `"api"` to the include array so `pnpm type-check` covers serverless functions
- **Files modified:** apps/web/tsconfig.json
- **Verification:** `pnpm --filter @weatherchaser/web type-check` exits 0
- **Committed in:** 9b60d29 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for type-checking correctness. No scope creep.

## Issues Encountered
None — plan executed cleanly. @supabase/supabase-js installation was planned in the task spec.

## User Setup Required
**External services require manual configuration before deployment.**

Vercel requires the following environment variables:
- `VITE_SUPABASE_URL` — Supabase Dashboard -> Project Settings -> API -> Project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase Dashboard -> Project Settings -> API -> anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard -> Project Settings -> API -> service_role secret
- `SUPABASE_URL` — Same as VITE_SUPABASE_URL (server-side, for keepalive.ts)
- `SUPABASE_ANON_KEY` — Same as VITE_SUPABASE_ANON_KEY (server-side, for keepalive.ts)

Dashboard steps:
1. Create Vercel project linked to GitHub repo (vercel.com -> Add New Project)
2. Set Root Directory to `apps/web`
3. Set Build Command to: `cd ../.. && pnpm turbo build --filter=@weatherchaser/web`
4. Add all env vars listed above under Settings -> Environment Variables

Optional: `OPEN_METEO_API_KEY` — only required if using Open-Meteo commercial plan

## Next Phase Readiness
- All proxy functions ready for Plan 03-03 (service layer migration from direct API calls to proxy endpoints)
- vercel.json fully configured; project deployable once Vercel dashboard setup is complete
- Supabase keepalive will activate once SUPABASE_URL and SUPABASE_ANON_KEY are set

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-05*
