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
    - apps/web/src/i18n/locales/de/common.json
    - apps/web/src/i18n/locales/en/common.json
    - apps/web/src/lib/supabase.ts
    - apps/web/src/stores/authStore.ts

key-decisions:
  - "useRef for prevUser tracking in AccountModal and InlineSignInPrompt — plain object literal resets on every render; useRef persists across re-renders without triggering re-render itself"
  - "AccountModal overlay click-outside closes modal — matches standard modal UX pattern; inner panel click propagation stopped naturally by event target check"
  - "InlineSignInPrompt uses showEmailForm toggle to expand inline email fields — avoids nested modal overhead; keeps context visible while signing in"
  - "SettingsTab delete account calls DELETE /api/user/delete (not client-side Supabase) — server-side deletion needed for GDPR compliance; client signOut follows on success"
  - "Entry panel footer uses margin-top: auto — pushes account icon to panel bottom naturally without absolute positioning, compatible with variable content height"
  - "Lazy Supabase init via getSupabase() — returns null when env vars absent; authStore.initialize() guards on null; app loads in guest mode without .env.local"
  - "Tab bar uses CSS grid repeat(3,1fr) — guarantees equal tab widths for both Deutsch and English text lengths"
  - "Language switcher in SettingsTab available to all users (not login-gated) — guest users need language access to read sign-in UI in their preferred language"

patterns-established:
  - "Modal auto-close pattern: useRef(null) for prevUser + useEffect watching user; triggers onClose when null→truthy transition detected"
  - "Component directory structure: account/ for user-data UI, auth/ for auth flow widgets — separate from entry/ panel components"

requirements-completed:
  - AUTH-02
  - AUTH-03
  - AUTH-04

# Metrics
duration: ~90min
completed: 2026-03-06
---

# Phase 3 Plan 04: Account Modal and Auth UI Summary

**Full-screen AccountModal (3 tabs) with Google/Apple/email sign-in in AccountTab, SavedTab placeholder, SettingsTab with GDPR delete flow, InlineSignInPrompt compact widget, and account icon at EntryPanel footer**

## Performance

- **Duration:** ~90 min (including checkpoint verification and post-checkpoint i18n/UX pass)
- **Started:** 2026-03-05
- **Completed:** 2026-03-06
- **Tasks:** 3 of 3 (human-verify checkpoint approved)
- **Files modified:** 13

## Accomplishments

- AccountModal renders over the map with a 3-tab layout — Konto, Gespeichert, Einstellungen — with animated fade-in/slide-up entry
- AccountTab handles all three auth providers plus sign-up/sign-in toggle, loading spinner, error display; logged-in view shows initials avatar + Abmelden button
- InlineSignInPrompt provides a compact "Anmelden zum Speichern" card for gated actions with inline email form expansion
- EntryPanel footer pins a person SVG icon (or initials avatar when logged in) to the bottom of the panel, triggering AccountModal on click
- All auth strings routed through i18n t() with account.* keys in de/en locales — no hardcoded German/English strings in components
- Lazy Supabase init via getSupabase() prevents crash when .env.local is absent; app runs in guest mode without credentials
- Human-verify checkpoint: approved — account icon visible, all 3 tabs render, modal closes without disrupting map/route state

## Task Commits

Each task was committed atomically:

1. **Task 1: AccountModal with 3 tabs and AccountTab sign-in forms** — `313da4d` (feat)
2. **Task 2: InlineSignInPrompt and EntryPanel account icon** — `5619f03` (feat)
3. **Task 3: Verify auth UI in browser** — human-verify checkpoint, paused at `ffe0616`, approved by user
4. **Post-checkpoint fix: i18n, equal-width tabs, language switcher, lazy Supabase init** — `f7051b9` (fix)

## Files Created/Modified

- `apps/web/src/components/account/AccountModal.tsx` — Full-screen modal, 3-tab layout (grid repeat(3,1fr)), auto-close on sign-in via useRef+useEffect, overlay click-to-close; all strings via t()
- `apps/web/src/components/account/AccountModal.css` — All modal, tab bar (grid equal-width), AccountTab, SavedTab, SettingsTab styles using design tokens
- `apps/web/src/components/account/AccountTab.tsx` — Email/password form + Google/Apple OAuth + sign-up toggle + logged-in profile view; all strings via t()
- `apps/web/src/components/account/SavedTab.tsx` — Empty state placeholder with bookmark SVG icon; strings via t()
- `apps/web/src/components/account/SettingsTab.tsx` — Datenschutz/ToS links, delete account (DELETE /api/user/delete), language switcher for all users, guest fallback; all strings via t()
- `apps/web/src/components/auth/InlineSignInPrompt.tsx` — Compact Google/Apple/E-Mail buttons with inline email form toggle; all strings via t()
- `apps/web/src/components/auth/InlineSignInPrompt.css` — Compact card styling for inline usage
- `apps/web/src/components/entry/EntryPanel.tsx` — Added isAccountModalOpen state, account icon footer, AccountModal render, useAuthStore for user avatarInitial
- `apps/web/src/components/entry/EntryPanel.css` — .entry-panel-footer, .entry-panel-account-btn, .entry-panel-avatar styles
- `apps/web/src/i18n/locales/de/common.json` — account.* namespace added (39 keys)
- `apps/web/src/i18n/locales/en/common.json` — account.* namespace added (39 keys)
- `apps/web/src/lib/supabase.ts` — Converted to lazy init; getSupabase() returns null when env vars absent
- `apps/web/src/stores/authStore.ts` — Guards initialize() and all auth actions on null Supabase client

## Decisions Made

- Used `useRef` (not plain object) for `prevUser` tracking — object literal resets on every render cycle; `useRef` persists the previous value correctly across renders for the null→truthy detection pattern
- AccountModal overlay uses `onClick` target check (not a separate transparent backdrop div) — simpler, fewer DOM nodes
- InlineSignInPrompt expands email fields inline on toggle instead of opening a sub-modal — preserves context and is consistent with the "compact" purpose of the component
- SettingsTab calls `DELETE /api/user/delete` (not direct Supabase client deletion) — server-side endpoint needed for GDPR-compliant data deletion across all tables; client-side Supabase `auth.deleteUser` requires service role key
- `margin-top: auto` for entry-panel-footer pushes icon to panel bottom regardless of how much content is above it
- Lazy Supabase init: getSupabase() returns null when env vars absent; authStore guards on null — app loads in guest mode without .env.local
- Tab bar grid repeat(3,1fr): equal widths for all tabs regardless of Deutsch/English text length differences
- Language switcher not login-gated: guests need to change language before they can read sign-in UI in their language

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] i18n all account/auth UI strings**
- **Found during:** Task 3 (human-verify checkpoint review)
- **Issue:** All user-visible strings in AccountModal, AccountTab, SavedTab, SettingsTab, and InlineSignInPrompt were hardcoded German — would break English mode and violate existing i18n pattern established in Phase 02
- **Fix:** Added account.* namespace to de/en common.json (39 keys each); replaced all hardcoded strings with t('account.*') calls across all 5 components
- **Files modified:** all account/* components, auth/InlineSignInPrompt.tsx, de/en common.json
- **Committed in:** f7051b9

**2. [Rule 1 - Bug] Tab bar unequal widths**
- **Found during:** Task 3 (human-verify checkpoint review)
- **Issue:** Tab bar used flex layout — tab widths varied by text length; "Einstellungen" tab was wider than "Konto" tab
- **Fix:** Changed tab container to `display: grid; grid-template-columns: repeat(3, 1fr)`
- **Files modified:** apps/web/src/components/account/AccountModal.css
- **Committed in:** f7051b9

**3. [Rule 2 - Missing Critical] Language switcher accessible to guests**
- **Found during:** Task 3 (human-verify checkpoint review)
- **Issue:** Language switcher was inside SettingsTab but conditionally hidden for non-logged-in users — guest users couldn't change language to use the sign-in UI in their preferred language
- **Fix:** Removed login-gate from language switcher; available to all users regardless of auth state
- **Files modified:** apps/web/src/components/account/SettingsTab.tsx
- **Committed in:** f7051b9

**4. [Rule 3 - Blocking] Lazy Supabase init to allow guest-mode startup**
- **Found during:** Task 3 (human-verify checkpoint review)
- **Issue:** App crashed on load when .env.local was absent because Supabase client was initialized at module level with undefined URL/key
- **Fix:** Wrapped client creation in getSupabase() function that returns null when env vars absent; authStore.initialize() and all auth actions guard on null client
- **Files modified:** apps/web/src/lib/supabase.ts, apps/web/src/stores/authStore.ts
- **Committed in:** f7051b9

---

**Total deviations:** 4 auto-fixed (1 missing critical i18n, 1 UI bug, 1 UX critical, 1 blocking startup crash)
**Impact on plan:** All fixes essential for correctness, usability, and i18n consistency. No scope creep.

## Issues Encountered

- Supabase client initialization at module level caused crash in guest mode without .env.local — resolved by lazy init pattern.
- prevUser ref pattern required to reliably detect user sign-in event across React re-renders without useEffect dependency cycles.

## User Setup Required

None — no additional external service configuration required beyond what Plan 03-02 specified.

## Next Phase Readiness

- AccountModal and all 3 tab components are fully functional; human verification passed
- SavedTab is a placeholder — Plan 03-05 populates it with saved routes
- InlineSignInPrompt is ready for Plan 03-05 to use as a gate before save-route actions
- DELETE /api/user/delete endpoint (SettingsTab calls it) needs to be implemented in Plan 03-07 (production hosting / API endpoints)
- All auth strings are i18n-complete in both de and en; future plans adding auth UI strings should follow the account.* namespace pattern

---
*Phase: 03-backend-auth-production-hosting*
*Completed: 2026-03-06*
