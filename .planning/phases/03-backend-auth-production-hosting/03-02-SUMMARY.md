---
phase: 03-backend-auth-production-hosting
plan: "02"
subsystem: auth
tags: [supabase, zustand, auth, postgres, rls, typescript]

# Dependency graph
requires:
  - phase: 03-backend-auth-production-hosting plan 01
    provides: "@supabase/supabase-js installed as production dependency; Vercel proxy functions in place"
provides:
  - Supabase client singleton typed with Database generics (apps/web/src/lib/supabase.ts)
  - TypeScript database types for all three user data tables (apps/web/src/types/database.ts)
  - Zustand auth store with sign-in (Google/Apple/email), sign-up, sign-out, pending-action queue, and session persistence (apps/web/src/stores/authStore.ts)
  - Auth initialization on app boot via Root wrapper in main.tsx with StrictMode-safe cleanup
  - Database schema SQL with RLS for saved_routes, saved_finder_searches, favorites (apps/web/src/lib/schema.sql)
affects:
  - 03-03 (AccountModal UI consumes useAuthStore)
  - 03-04 (save-route feature uses useAuthStore + saved_routes table)
  - 03-05 (favorites feature uses useAuthStore + favorites table)
  - 03-06 (saved-finder-searches uses useAuthStore + saved_finder_searches table)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase typed client: createClient<Database> generic eliminates runtime type guessing for table queries"
    - "Auth store initialize() returns unsubscribe fn — called in Root useEffect for StrictMode-safe cleanup"
    - "Pending-action queue: PendingAction stored in authStore; UI layer consumes and clears after execution"
    - "Guest users (null user) are a valid state — app fully functional without auth"

key-files:
  created:
    - apps/web/src/lib/supabase.ts
    - apps/web/src/types/database.ts
    - apps/web/src/lib/schema.sql
    - apps/web/src/stores/authStore.ts
  modified:
    - apps/web/src/main.tsx

key-decisions:
  - "Initialize auth in Root wrapper component (not module level) — StrictMode double-invokes effects; returning unsubscribe from initialize() ensures proper cleanup"
  - "pendingAction consumed by UI layer not auth store — store logs SIGNED_IN+pending but does not execute; UI component clears after executing"
  - "VITE_ prefix only on SUPABASE_URL and SUPABASE_ANON_KEY — anon key is designed to be public, RLS enforces row-level access; service_role key must never use VITE_ prefix"

patterns-established:
  - "Auth store pattern: initialize() returns cleanup fn, called in Root useEffect"
  - "Database types: manual interfaces in database.ts matching schema; Database generic wraps all tables"

requirements-completed:
  - AUTH-01
  - AUTH-04

# Metrics
duration: 8min
completed: 2026-03-05
---

# Phase 3 Plan 02: Supabase Auth Foundation Summary

**Supabase typed client singleton + Zustand auth store with Google/Apple/email sign-in, pending-action queue, session persistence via onAuthStateChange, and three-table PostgreSQL schema with RLS**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-05T15:05:07Z
- **Completed:** 2026-03-05T15:13:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Supabase client singleton typed with Database generic — future table queries get full TypeScript inference
- Auth store with all three providers (Google, Apple, email/password) plus pending-action queue for post-signup action replay
- main.tsx updated with Root wrapper component — StrictMode-safe auth initialization via returned unsubscribe function
- Database schema SQL ready to paste into Supabase SQL editor: saved_routes, saved_finder_searches, favorites tables with RLS policies

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase client singleton and TypeScript database types** - `8883a92` (feat)
2. **Task 2: Zustand auth store with pending-action queue and main.tsx initialization** - `07860f4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/src/lib/supabase.ts` - Typed Supabase client singleton exported as `supabase`
- `apps/web/src/types/database.ts` - SavedRoute, SavedFinderSearch, Favorite interfaces + Database wrapper type
- `apps/web/src/lib/schema.sql` - PostgreSQL schema for all three tables with RLS enable + policies
- `apps/web/src/stores/authStore.ts` - useAuthStore with initialize(), sign-in methods, signOut, setPendingAction
- `apps/web/src/main.tsx` - Root wrapper component calling useAuthStore.getState().initialize() in useEffect

## Decisions Made

- Used Root wrapper component in main.tsx rather than module-level init — React StrictMode double-invokes effects in dev; the returned unsubscribe function prevents duplicate subscriptions
- pendingAction state is set by the UI and consumed (cleared) by the UI after execution — the auth store only logs the event; this keeps execution logic in components that know the context
- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY only — anon key is designed to be public and safe in bundles; service_role key must never get VITE_ prefix

## Deviations from Plan

None - plan executed exactly as written. @supabase/supabase-js was already present from Plan 03-01; no install step required.

## Issues Encountered

None — type-check passed clean on both tasks. No package install needed (dependency already in package.json from Plan 03-01).

## User Setup Required

**External services require manual configuration before this plan's code is functional:**

1. Create Supabase project at supabase.com — select Frankfurt (eu-central-1) region at creation (cannot change after)
2. Run `apps/web/src/lib/schema.sql` in Supabase Dashboard -> SQL Editor -> New query
3. Enable Email auth provider: Supabase Dashboard -> Authentication -> Providers -> Email
4. Create `apps/web/.env.local` with:
   ```
   VITE_SUPABASE_URL=<Project URL from Settings > API>
   VITE_SUPABASE_ANON_KEY=<anon public key from Settings > API>
   ```

## Next Phase Readiness

- Auth foundation complete — useAuthStore and supabase singleton ready for Plan 03-03 (AccountModal UI)
- schema.sql ready to run in Supabase dashboard (user action required before any data operations work)
- Guest users return null from useAuthStore().user — app remains fully functional without auth configured

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-05*
