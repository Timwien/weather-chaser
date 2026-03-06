---
phase: 03-backend-auth-production-hosting
plan: "05"
subsystem: auth
tags: [supabase, react, typescript, userdata, crud, favorites, persistence]

# Dependency graph
requires:
  - phase: 03-04
    provides: InlineSignInPrompt, authStore.pendingAction, useAuthStore hook
  - phase: 03-02
    provides: authStore with user/session state, setPendingAction
  - phase: 03-01
    provides: Supabase client (getSupabase, supabaseConfigured), lazy init pattern
provides:
  - userdata.ts — full Supabase CRUD: saveRoute, getSavedRoutes, deleteSavedRoute, toggleFavorite, getFavorites, saveFinderSearch, getSavedFinderSearches
  - ItineraryPanel save button with guest/logged-in states and pending-action auto-complete
  - ShareBar save button with same guest/logged-in logic
  - FinderResultRow heart/favorite icon with isFavorited toggle
  - WeatherFinderPanel favorites management with optimistic updates
  - LocationInput favorites-as-suggestions feature (heart prefix, above Nominatim results)
  - SavedTab with real data from Supabase (3 sections: Routen, Finder-Suchen, Favoriten)
affects:
  - 03-06 (production hosting — Supabase tables must exist before deploy)
  - 03-07 (any remaining auth/data polish)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy getSupabase() pattern for all CRUD — consistent with auth store; never throws on missing config"
    - "as any cast on Supabase v2.98 .insert() — insert type inference resolves to never without full auto-generated schema"
    - "Optimistic favorite toggle — update local state immediately, let real DB catch up"
    - "Pending action auto-complete — useEffect watching user null→truthy transition"

key-files:
  created:
    - apps/web/src/services/userdata.ts
  modified:
    - apps/web/src/components/account/SavedTab.tsx
    - apps/web/src/components/account/AccountModal.css
    - apps/web/src/components/itinerary/ItineraryPanel.tsx
    - apps/web/src/components/itinerary/ItineraryPanel.css
    - apps/web/src/components/share/ShareBar.tsx
    - apps/web/src/components/share/ShareBar.css
    - apps/web/src/components/finder/FinderResultRow.tsx
    - apps/web/src/components/finder/FinderResultRow.css
    - apps/web/src/components/finder/WeatherFinderPanel.tsx
    - apps/web/src/components/entry/LocationInput.tsx
    - apps/web/src/components/entry/EntryPanel.css
    - apps/web/src/types/database.ts
    - apps/web/src/i18n/locales/de/common.json
    - apps/web/src/i18n/locales/en/common.json

key-decisions:
  - "userdata.ts uses getSupabase() per call (not module-level) — consistent with lazy init pattern; getSupabase() throws if not configured so callers should guard with supabaseConfigured"
  - "as any casts on supabase .insert() — supabase-js v2.98 insert types resolve to never without full auto-generated Database schema (missing PostgrestVersion, Views, Functions, Enums etc.); runtime is correct, types verified via explicit return type annotations"
  - "Database type updated with Relationships:[] per supabase v2.98 GenericTable contract, plus Views/Functions/Enums/CompositeTypes stubs"
  - "buildRouteName uses route.stops[n].town.name (not s.name) — Stop interface has town.name, not direct name property"
  - "Pending save auto-complete: useEffect watching user only fires on null→truthy transition; avoids re-running on every render"
  - "Optimistic favorite toggle: local state updated immediately on success; real IDs replaced when user re-opens panel"
  - "Guest save button: opacity 0.5, cursor pointer — visible but dimmed per plan spec"

patterns-established:
  - "supabaseConfigured guard before any userdata call — features gracefully absent when Supabase not configured"
  - "Per-section empty states in SavedTab: 'Noch keine Routen gespeichert' per section, not just a global empty state"

requirements-completed: [AUTH-05, AUTH-06, AUTH-07]

# Metrics
duration: 36min
completed: 2026-03-06
---

# Phase 03 Plan 05: User Data Persistence Summary

**Supabase CRUD service for saved routes/favorites/searches, with dimmed guest save buttons, inline sign-in prompt, pending-action auto-complete, heart icon on finder results, and SavedTab populated with real data**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-03-06T09:58:46Z
- **Completed:** 2026-03-06T10:34:00Z
- **Tasks:** 2 auto tasks completed, 1 checkpoint pending human verify
- **Files modified:** 14 files

## Accomplishments
- Created `userdata.ts` with full CRUD: saveRoute (auto-name from stop names), getSavedRoutes, deleteSavedRoute, toggleFavorite, getFavorites, saveFinderSearch, getSavedFinderSearches
- Wired save buttons into ItineraryPanel and ShareBar — logged-in users save immediately; guest users see dimmed (opacity 0.5) button + InlineSignInPrompt; pending action auto-completes after sign-in
- Heart icon on every FinderResultRow — filled teal when favorited, outline when not; optimistic toggle
- LocationInput loads favorites on mount and shows them as suggestions (heart icon prefix) above Nominatim results when dropdown is open
- SavedTab completely rewritten with real Supabase data: 3 sections (Routen, Finder-Suchen, Favoriten), loading spinner, per-section empty states, delete button on route cards

## Task Commits

Each task was committed atomically:

1. **Task 1: User data service and SavedTab with real data** - `7c6f658` (feat)
2. **Fix: Database type compatibility with supabase-js v2.98** - `b87dbb8` (fix — auto-fix Rule 1)
3. **Task 2: Save buttons, heart favorites, and location suggestions** - `0ba59ae` (feat)
4. **Task 3: Human-verify checkpoint** - pending

## Files Created/Modified
- `apps/web/src/services/userdata.ts` — New: full CRUD service for saved_routes, favorites, saved_finder_searches
- `apps/web/src/components/account/SavedTab.tsx` — Rewritten: real data, 3 sections, loading/empty states, delete
- `apps/web/src/components/account/AccountModal.css` — Extended: saved-tab--loaded layout, saved-section/card CSS
- `apps/web/src/components/itinerary/ItineraryPanel.tsx` — Save button wired with guest/logged-in flow
- `apps/web/src/components/itinerary/ItineraryPanel.css` — Save button styles
- `apps/web/src/components/share/ShareBar.tsx` — Save button added alongside share buttons
- `apps/web/src/components/share/ShareBar.css` — share-btn-save styles
- `apps/web/src/components/finder/FinderResultRow.tsx` — Heart icon + isFavorited/onFavoriteToggle props
- `apps/web/src/components/finder/FinderResultRow.css` — finder-result-heart styles
- `apps/web/src/components/finder/WeatherFinderPanel.tsx` — Favorites state loaded on mount, passed to rows
- `apps/web/src/components/entry/LocationInput.tsx` — Favorites loaded + shown as suggestions in dropdown
- `apps/web/src/components/entry/EntryPanel.css` — autocomplete-option--favorite style
- `apps/web/src/types/database.ts` — Added Relationships field + Views/Functions/Enums stubs for supabase v2.98
- `apps/web/src/i18n/locales/de/common.json` — Added saved_not_logged_in key
- `apps/web/src/i18n/locales/en/common.json` — Added saved_not_logged_in key

## Decisions Made
- Used `getSupabase()` per call in userdata.ts — consistent with auth store lazy init pattern
- `as any` cast on `.insert()` calls — supabase-js v2.98 requires full auto-generated schema for proper type inference; runtime behavior is correct
- `buildRouteName` uses `s.town.name` — Stop interface has `town.name`, not a direct `name` field
- Pending auto-complete: `useEffect` watching `user` only; fires once on null→truthy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Supabase v2.98 insert type resolution to `never`**
- **Found during:** Task 1 (userdata.ts creation) — type check failed
- **Issue:** `createClient<Database>` with v2.98 requires `Relationships: []` in each table definition and `Views`, `Functions`, `Enums`, `CompositeTypes` stubs in schema; without these, `.insert()` resolves to `never`
- **Fix:** Updated `database.ts` to add `Relationships: []` + schema stubs; used `as any` on `.insert()` calls for pragmatic compatibility
- **Files modified:** `apps/web/src/types/database.ts`, `apps/web/src/services/userdata.ts`
- **Verification:** `pnpm --filter @weatherchaser/web type-check` exits 0
- **Committed in:** `b87dbb8`

**2. [Rule 1 - Bug] Fixed buildRouteName to use `s.town.name` not `s.name`**
- **Found during:** Task 1 (writing userdata.ts)
- **Issue:** Plan showed `route.stops.map((s) => s.name)` but Stop interface has `town.name`, not a direct `name` property
- **Fix:** Used `route.stops.map((s) => s.town.name)`
- **Files modified:** `apps/web/src/services/userdata.ts`
- **Verification:** Type check passes, route name would be "München → Berchtesgaden" correctly
- **Committed in:** `7c6f658`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — type/API contract bugs)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep.

## Issues Encountered
- supabase-js v2.98.0 has stricter Database generic type requirements vs older versions — required Database type update and `as any` pragmatic casts for insert operations. Runtime behavior unaffected.

## User Setup Required
Supabase tables must be created before features work at runtime. Required SQL:
```sql
create table saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  stops_json jsonb,
  date_from date,
  date_to date,
  created_at timestamptz default now()
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  place_name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

create table saved_finder_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  config_json jsonb,
  created_at timestamptz default now()
);

-- RLS policies (user can only read/write own rows)
alter table saved_routes enable row level security;
create policy "Users own their routes" on saved_routes for all using (auth.uid() = user_id);

alter table favorites enable row level security;
create policy "Users own their favorites" on favorites for all using (auth.uid() = user_id);

alter table saved_finder_searches enable row level security;
create policy "Users own their searches" on saved_finder_searches for all using (auth.uid() = user_id);
```

## Next Phase Readiness
- User data persistence layer complete — AUTH-05/06/07 requirements implemented
- Supabase tables need to be created in the dashboard before testing with real account
- Phase 03-06 (production hosting) can proceed once tables are created and tested
- Human verification checkpoint pending — needs approval before marking plan complete

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-06*
