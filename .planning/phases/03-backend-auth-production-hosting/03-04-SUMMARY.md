---
phase: 03-backend-auth-production-hosting
plan: "04"
subsystem: auth
tags: [react, zustand, supabase, css, modal, typescript, auth-ui]

# Dependency graph
requires:
  - phase: 03-backend-auth-production-hosting plan 02
    provides: "useAuthStore with signInWithGoogle/Apple/Email, signUpWithEmail, signOut, user state; supabase singleton"

provides:
  - AccountModal full-screen overlay with Konto/Gespeichert/Einstellungen tabs (apps/web/src/components/account/AccountModal.tsx)
  - AccountTab sign-in forms (email+password, Google OAuth, Apple OAuth) and logged-in profile view (apps/web/src/components/account/AccountTab.tsx)
  - SavedTab empty state placeholder for Plan 03-05 (apps/web/src/components/account/SavedTab.tsx)
  - SettingsTab with Datenschutz/ToS links and delete account flow calling DELETE /api/user/delete (apps/web/src/components/account/SettingsTab.tsx)
  - InlineSignInPrompt compact card with Google/Apple/E-Mail buttons and inline email form (apps/web/src/components/auth/InlineSignInPrompt.tsx)
  - AccountModal trigger at EntryPanel footer — account icon for guests, initials avatar for logged-in users
affects:
  - 03-05 (SavedTab populated; InlineSignInPrompt used for save-route gate)
  - 03-06 (SavedTab populated with finder searches; InlineSignInPrompt for finder gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef to track prevUser across renders — useEffect auto-closes modal when user transitions from null to truthy"
    - "AccountModal accepts initialTab prop — future callers can deep-link to specific tab (e.g., saved routes)"
    - "EntryPanel footer uses margin-top: auto to pin account icon to panel bottom regardless of content height"
    - "InlineSignInPrompt showEmailForm toggle — avoids full-screen modal for gated actions; inline expansion preserves context"

key-files:
  created:
    - apps/web/src/components/account/AccountModal.tsx
    - apps/web/src/components/account/AccountModal.css
    - apps/web/src/components/account/AccountTab.tsx
    - apps/web/src/components/account/SavedTab.tsx
    - apps/web/src/components/account/SettingsTab.tsx
    - apps/web/src/components/auth/InlineSignInPrompt.tsx
    - apps/web/src/components/auth/InlineSignInPrompt.css
  modified:
    - apps/web/src/components/entry/EntryPanel.tsx
    - apps/web/src/components/entry/EntryPanel.css

key-decisions:
  - "useRef for prevUser tracking in AccountModal and InlineSignInPrompt — plain object literal resets on every render; useRef persists across re-renders without triggering re-render itself"
  - "AccountModal overlay click-outside closes modal — matches standard modal UX pattern; inner panel click propagation stopped naturally by event target check"
  - "InlineSignInPrompt uses showEmailForm toggle to expand inline email fields — avoids nested modal overhead; keeps context visible while signing in"
  - "SettingsTab delete account calls DELETE /api/user/delete (not client-side Supabase) — server-side deletion needed for GDPR compliance; client signOut follows on success"
  - "Entry panel footer uses margin-top: auto — pushes account icon to panel bottom naturally without absolute positioning, compatible with variable content height"

patterns-established:
  - "Modal auto-close pattern: useRef(null) for prevUser + useEffect watching user; triggers onClose when null→truthy transition detected"
  - "Component directory structure: account/ for user-data UI, auth/ for auth flow widgets — separate from entry/ panel components"

requirements-completed:
  - AUTH-02
  - AUTH-03
  - AUTH-04

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 3 Plan 04: Account Modal and Auth UI Summary

**Full-screen AccountModal (3 tabs) with Google/Apple/email sign-in in AccountTab, SavedTab placeholder, SettingsTab with GDPR delete flow, InlineSignInPrompt compact widget, and account icon at EntryPanel footer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T15:15:51Z
- **Completed:** 2026-03-05T15:20:24Z
- **Tasks:** 2 of 3 (paused at human-verify checkpoint)
- **Files modified:** 9

## Accomplishments

- AccountModal renders over the map with a 3-tab layout — Konto, Gespeichert, Einstellungen — with animated fade-in/slide-up entry
- AccountTab handles all three auth providers plus sign-up/sign-in toggle, loading spinner, error display; logged-in view shows initials avatar + Abmelden button
- InlineSignInPrompt provides a compact "Anmelden zum Speichern" card for gated actions with inline email form expansion
- EntryPanel footer pins a person SVG icon (or initials avatar when logged in) to the bottom of the panel, triggering AccountModal on click

## Task Commits

Each task was committed atomically:

1. **Task 1: AccountModal with 3 tabs and AccountTab sign-in forms** - `313da4d` (feat)
2. **Task 2: InlineSignInPrompt and EntryPanel account icon** - `5619f03` (feat)

Task 3 is a human-verify checkpoint — awaiting user verification.

## Files Created/Modified

- `apps/web/src/components/account/AccountModal.tsx` - Full-screen modal, 3-tab layout, auto-close on sign-in via useRef+useEffect, overlay click-to-close
- `apps/web/src/components/account/AccountModal.css` - All modal, tab bar, AccountTab, SavedTab, SettingsTab styles using design tokens
- `apps/web/src/components/account/AccountTab.tsx` - Email/password form + Google/Apple OAuth + sign-up toggle + logged-in profile view
- `apps/web/src/components/account/SavedTab.tsx` - Empty state placeholder with bookmark SVG icon and German copy
- `apps/web/src/components/account/SettingsTab.tsx` - Datenschutz/ToS links + delete account with DELETE /api/user/delete + guest fallback
- `apps/web/src/components/auth/InlineSignInPrompt.tsx` - Compact Google/Apple/E-Mail buttons with inline email form toggle
- `apps/web/src/components/auth/InlineSignInPrompt.css` - Compact card styling for inline usage
- `apps/web/src/components/entry/EntryPanel.tsx` - Added isAccountModalOpen state, account icon footer, AccountModal render, useAuthStore for user avatarInitial
- `apps/web/src/components/entry/EntryPanel.css` - .entry-panel-footer, .entry-panel-account-btn, .entry-panel-avatar styles

## Decisions Made

- Used `useRef` (not plain object) for `prevUser` tracking — object literal resets on every render cycle; `useRef` persists the previous value correctly across renders for the null→truthy detection pattern
- AccountModal overlay uses `onClick` target check (not a separate transparent backdrop div) — simpler, fewer DOM nodes
- InlineSignInPrompt expands email fields inline on toggle instead of opening a sub-modal — preserves context and is consistent with the "compact" purpose of the component
- SettingsTab calls `DELETE /api/user/delete` (not direct Supabase client deletion) — server-side endpoint needed for GDPR-compliant data deletion across all tables; client-side Supabase `auth.deleteUser` requires service role key
- `margin-top: auto` for entry-panel-footer pushes icon to panel bottom regardless of how much content is above it

## Deviations from Plan

None - plan executed exactly as written. The `useRef` fix for `prevUserRef` (replacing plain object literal) was a correctness fix caught during implementation before commit, not a post-execution deviation.

## Issues Encountered

None — type-check passed clean on both tasks.

## User Setup Required

None — no additional external service configuration required beyond what Plan 03-02 specified.

## Next Phase Readiness

- AccountModal and all 3 tab components are functional; human verification at Task 3 checkpoint required before plan is marked complete
- SavedTab is a placeholder — Plan 03-05 populates it with saved routes
- InlineSignInPrompt is ready for Plan 03-05 to use as a gate before save-route actions
- DELETE /api/user/delete endpoint (SettingsTab calls it) needs to be implemented in Plan 03-07 (production hosting / API endpoints)

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-05*
