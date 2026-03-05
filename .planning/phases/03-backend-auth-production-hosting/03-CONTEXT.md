# Phase 3: Backend + Auth + Production Hosting - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

API server with proxied/cached external APIs (weather, Overpass, OSRM), user accounts (email + Google + Apple OAuth via Supabase), saved routes, saved finder searches, favorited places, and live public deployment with EU data residency. Guest users retain full functionality — account only required for persistence.

</domain>

<decisions>
## Implementation Decisions

### Auth entry point
- Small account/settings icon at the **bottom of the entry panel** (not the header)
- The icon serves as the single entry point for both account and settings
- Tapping it opens a **full-screen modal overlay**
- The modal has 3 tabs: **Account | Saved | Settings**
- For logged-in users: shows name/avatar in Account tab, saved items in Saved tab, app preferences in Settings tab

### Auth flow behavior
- Sign-in/sign-up happens entirely within the modal
- OAuth providers: Google, Apple, email+password (all three)
- After signing in mid-session: modal closes, current route/state is preserved unchanged — no reload, no disruption
- No post-login save prompt — seamless background event

### Saved routes
- Save button visible in **both** the itinerary share bar AND as a dedicated button in the itinerary panel
- For guests: save button is **visible but slightly dimmed** — clearly actionable but gated
- Tapping save as a guest opens the inline sign-in prompt (not the full modal)
- Routes are **auto-named** from stops: e.g. "München → Berchtesgaden → Salzburg" — no name dialog
- Saved routes shown as **cards** in the Saved tab: stop names + date range per card

### Saved finder searches
- Finder searches (best weather search config) can also be saved
- Shown in the Saved tab alongside routes

### Favorited places
- **Heart icon** on finder result cards to favorite a location
- Favorites appear as **suggestions in the 'Wo?' input** for future trip planning
- Favorites also listed in the Saved tab of the account modal

### Guest-to-account nudge
- **No unprompted nudges** for guests who haven't tried a gated action
- **One-time hint only**: after a guest generates their first route, a subtle one-time prompt appears: "Save this route — sign in" (fires once, never again)
- When a guest taps a gated action (save, favorite): a **small inline prompt** appears: "Sign in to save — it's free" with Google / Apple / Email buttons — not the full modal
- After signing up via inline prompt: the **action that triggered sign-up completes automatically** — user doesn't have to repeat it

### Production hosting stack
- **Frontend:** Vercel (free Hobby plan, platform subdomain for MVP — e.g. weatherchaser.vercel.app)
- **API server:** Vercel serverless functions (free, zero-ops for MVP — migrate to Railway EU when traffic justifies)
- **Auth + DB:** Supabase Frankfurt (EU region, free tier — 50k MAU, 500MB DB)
- No custom domain in Phase 3 — platform subdomain is acceptable for MVP

### GDPR
- Claude's discretion — implement the correct legal minimum for the German market
- At minimum expected: right to erasure (delete account in Settings), EU data residency already covered by Supabase Frankfurt, privacy policy and ToS links accessible from the app

### Claude's Discretion
- GDPR UI implementation details (cookie banner wording, consent flows, privacy policy content structure)
- Exact settings content in the Settings tab (beyond account management)
- Loading/error states within the account modal
- Account modal animation and transition details

</decisions>

<specifics>
## Specific Ideas

- The bottom-of-panel account icon should double as the settings entry point — combining both into one persistent footer element avoids cluttering the panel
- Inline sign-in prompt (for gated actions) should be minimal — "Sign in to save — it's free" + provider buttons — not the full modal
- After sign-up via nudge, the pending action (save route / favorite place) should complete automatically without the user repeating steps
- Favorites in 'Wo?' input feel like a shortcut — familiar places from previous trips surface naturally

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-backend-auth-production-hosting*
*Context gathered: 2026-03-05*
