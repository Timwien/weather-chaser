---
phase: 03-backend-auth-production-hosting
plan: "06"
subsystem: api
tags: [supabase, gdpr, serverless, vercel, localstorage, react]

# Dependency graph
requires:
  - phase: 03-01
    provides: Vercel Web fetch handler pattern established for serverless functions
  - phase: 03-04
    provides: SettingsTab with delete account UI wired to DELETE /api/user/delete; authStore session

provides:
  - GDPR right to erasure endpoint (apps/web/api/user/delete.ts) using service_role key server-side
  - One-time guest hint banner after first route generation in EntryPanel (localStorage persisted)

affects:
  - 03-07
  - production-deployment

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-step Supabase token validation: anon client verifies JWT, admin client performs privileged operation
    - localStorage one-time flag pattern: HINT_KEY constant + hasShownHint/markHintShown helpers at module level
    - useEffect with [route, user] deps fires hint exactly once when guest first sees a route

key-files:
  created:
    - apps/web/api/user/delete.ts
  modified:
    - apps/web/src/components/entry/EntryPanel.tsx
    - apps/web/src/components/entry/EntryPanel.css

key-decisions:
  - "Two-step deletion: anon client validates token (user can only delete themselves), admin client calls auth.admin.deleteUser — prevents arbitrary user deletion"
  - "SUPABASE_SERVICE_ROLE_KEY without VITE_ prefix: server-side env only, never exposed in client bundle"
  - "ON DELETE CASCADE handles data cleanup automatically — no manual table deletions in endpoint"
  - "localStorage key wc_first_route_hint_shown persists hint state permanently across sessions"
  - "Hint renders in entry panel before footer, above account icon row — subtle but visible to guest users"

patterns-established:
  - "Serverless privileged operations: always two-step (verify identity with anon client, act with admin client)"
  - "Server-only env vars: never use VITE_ prefix for secrets; process.env in api/ functions, import.meta.env only in src/"

requirements-completed:
  - INFRA-04
  - AUTH-07

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 03 Plan 06: GDPR Account Deletion + One-Time Guest Hint Summary

**GDPR right to erasure via service_role server-side deletion endpoint, and one-time localStorage-persisted save hint for guests after first route generation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T11:21:35Z
- **Completed:** 2026-03-06T11:25:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `apps/web/api/user/delete.ts` Vercel serverless function: validates JWT with anon client, deletes user with admin client (service_role), returns 401/200/500 appropriately
- Confirmed SettingsTab `handleDeleteAccount` was already fully wired from Plan 03-04 — sends `DELETE /api/user/delete` with `Authorization: Bearer {token}`
- Added one-time guest save hint to EntryPanel: fires when route appears + user is guest + localStorage flag not yet set; "Jetzt anmelden" opens AccountModal, x dismisses permanently

## Task Commits

Each task was committed atomically:

1. **Task 1: GDPR account deletion serverless endpoint** - `91ecc5b` (feat)
2. **Task 2: One-time guest route save hint in EntryPanel** - `d4ba5fe` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `apps/web/api/user/delete.ts` - Vercel Web fetch handler; GDPR deletion using service_role key server-side; two-step JWT validation
- `apps/web/src/components/entry/EntryPanel.tsx` - Added useEffect hint logic + showRouteHint state + banner JSX; imported useEffect; destructured route from appStore
- `apps/web/src/components/entry/EntryPanel.css` - Added .entry-route-hint, .entry-route-hint-cta, .entry-route-hint-dismiss styles

## Decisions Made

- Two-step token validation in delete endpoint: anon client `getUser(token)` first, admin `deleteUser(id)` second — prevents any user from deleting arbitrary accounts by knowing a UUID
- `SUPABASE_SERVICE_ROLE_KEY` used without `VITE_` prefix — `process.env` in serverless, never `import.meta.env`; verified with grep that key never appears in `apps/web/src/`
- Hint placement: immediately before footer (above account icon) — appears after route result loads, naturally in the user's sight line as they review the route

## Deviations from Plan

None - plan executed exactly as written. SettingsTab was already correctly wired from Plan 03-04 as expected.

## Issues Encountered

None.

## User Setup Required

Server environment variables required (add to Vercel project env):
- `SUPABASE_URL` — same value as `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` — same value as `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard Settings > API > service_role key; NEVER add VITE_ prefix

## Next Phase Readiness

- GDPR deletion capability complete for German market compliance
- Guest-to-signed-in conversion funnel now has a subtle one-time nudge after route generation
- Plan 03-07 (production deployment) can proceed — all auth/account features are complete

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-06*
