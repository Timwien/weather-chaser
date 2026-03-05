# Phase 3: Backend + Auth + Production Hosting - Research

**Researched:** 2026-03-05
**Domain:** Supabase Auth, Vercel Serverless Functions, API proxy/caching, GDPR German market, Turborepo monorepo production deployment
**Confidence:** HIGH (core stack verified via official docs; platform limits confirmed; GDPR guidance from authoritative legal sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth entry point**
- Small account/settings icon at the **bottom of the entry panel** (not the header)
- The icon serves as the single entry point for both account and settings
- Tapping it opens a **full-screen modal overlay**
- The modal has 3 tabs: **Account | Saved | Settings**
- For logged-in users: shows name/avatar in Account tab, saved items in Saved tab, app preferences in Settings tab

**Auth flow behavior**
- Sign-in/sign-up happens entirely within the modal
- OAuth providers: Google, Apple, email+password (all three)
- After signing in mid-session: modal closes, current route/state is preserved unchanged — no reload, no disruption
- No post-login save prompt — seamless background event

**Saved routes**
- Save button visible in **both** the itinerary share bar AND as a dedicated button in the itinerary panel
- For guests: save button is **visible but slightly dimmed** — clearly actionable but gated
- Tapping save as a guest opens the inline sign-in prompt (not the full modal)
- Routes are **auto-named** from stops: e.g. "München → Berchtesgaden → Salzburg" — no name dialog
- Saved routes shown as **cards** in the Saved tab: stop names + date range per card

**Saved finder searches**
- Finder searches (best weather search config) can also be saved
- Shown in the Saved tab alongside routes

**Favorited places**
- **Heart icon** on finder result cards to favorite a location
- Favorites appear as **suggestions in the 'Wo?' input** for future trip planning
- Favorites also listed in the Saved tab of the account modal

**Guest-to-account nudge**
- **No unprompted nudges** for guests who haven't tried a gated action
- **One-time hint only**: after a guest generates their first route, a subtle one-time prompt appears: "Save this route — sign in" (fires once, never again)
- When a guest taps a gated action (save, favorite): a **small inline prompt** appears: "Sign in to save — it's free" with Google / Apple / Email buttons — not the full modal
- After signing up via inline prompt: the **action that triggered sign-up completes automatically** — user doesn't have to repeat it

**Production hosting stack**
- **Frontend:** Vercel (free Hobby plan, platform subdomain for MVP — e.g. weatherchaser.vercel.app)
- **API server:** Vercel serverless functions (free, zero-ops for MVP — migrate to Railway EU when traffic justifies)
- **Auth + DB:** Supabase Frankfurt (EU region, free tier — 50k MAU, 500MB DB)
- No custom domain in Phase 3 — platform subdomain is acceptable for MVP

**GDPR**
- Claude's discretion — implement the correct legal minimum for the German market
- At minimum expected: right to erasure (delete account in Settings), EU data residency already covered by Supabase Frankfurt, privacy policy and ToS links accessible from the app

### Claude's Discretion
- GDPR UI implementation details (cookie banner wording, consent flows, privacy policy content structure)
- Exact settings content in the Settings tab (beyond account management)
- Loading/error states within the account modal
- Account modal animation and transition details

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Backend API handles auth, user data persistence, weather proxy + cache, Overpass proxy + cache | Vercel serverless functions in `apps/web/api/` folder; Cache-Control headers for Vercel CDN; Supabase for auth + DB |
| INFRA-02 | Web app is publicly hosted (Vercel or equivalent) | Vercel Hobby plan; monorepo Root Directory = `apps/web`; `vercel.json` with SPA rewrite |
| INFRA-03 | All production API usage complies with provider ToS — no use of public demo endpoints | Nominatim public endpoint prohibits auto-complete and bulk use → proxy with 1 req/s + debounce; OSRM demo prohibits production → proxy to self-hosted or use `router.project-osrm.org` only during dev; Overpass public → proxy |
| INFRA-04 | Backend hosted in EU region (GDPR compliance for EU user data) | Supabase Frankfurt (fra1) confirmed available; Vercel Hobby CAN set functions to fra1 (changelog confirmed); note: API proxy functions may tolerate US region for non-personal data |
| WTHR-02 | Weather fetching routed through backend proxy with caching (~6h TTL) — no direct client-to-Open-Meteo | Vercel serverless function as proxy; `Cache-Control: s-maxage=21600` header for Vercel CDN edge caching |
| AUTH-01 | App fully functional without login — guest users can plan routes, view results, share links | No auth gating on API routes; Supabase client can be used unauthenticated for proxy routes |
| AUTH-02 | User can create a free account with email/password | Supabase `signUp()` + `signInWithPassword()`; email confirmation required (dashboard setting) |
| AUTH-03 | User can sign in with OAuth (Google, Apple) — Apple Sign-In required for iOS App Store | Supabase `signInWithOAuth({ provider: 'google' })` and `{ provider: 'apple' }`; Apple requires 6-month key rotation |
| AUTH-04 | User session persists across app restarts (free account) | Supabase persists session in localStorage by default; `onAuthStateChange` with `INITIAL_SESSION` event |
| AUTH-05 | Free account user can save and name planned routes | `saved_routes` table with RLS; auto-named from stops string |
| AUTH-06 | Free account user can favorite/bookmark specific locations | `favorites` table with RLS; favorites surface as suggestions in 'Wo?' input |
| AUTH-07 | Free account user can save weather preferences and home region | Covered by saved finder searches table + user preferences in `user_profiles` or similar |
| PLAT-01 | Web app released as v1 | Vercel deployment of `apps/web` with all proxy endpoints live |
</phase_requirements>

---

## Summary

Phase 3 builds three largely independent technical layers on top of the Phase 1+2 React SPA: (1) a Vercel serverless function API that proxies and caches all external API calls (Open-Meteo, Overpass, Nominatim), (2) Supabase Auth with three sign-in methods (email/password, Google OAuth, Apple OAuth) and a PostgreSQL schema for user data (saved routes, finder searches, favorites), and (3) a production Vercel deployment with the correct `vercel.json` configuration for the Turborepo monorepo.

The locked hosting stack (Vercel Hobby + Supabase Frankfurt free tier) is confirmed viable for MVP. Supabase Frankfurt (`fra1`) is confirmed available for free-tier projects. Vercel Hobby plan CAN configure functions to run in `fra1` (Frankfurt) since Vercel opened region selection to Hobby customers (changelog 2024). The free tier hard limits that matter for planning: Supabase pauses inactive projects after 7 days of no API requests (prevent with a keep-alive cron job), and Vercel Hobby provides 1M function invocations/month with 300s max duration (via Fluid Compute, enabled by default for new projects as of April 2025). The critical OSRM self-hosting issue from Phase 1 research is addressed in Phase 3 by building a proxy, but OSRM still requires a server — this can be deferred to Railway EU in Phase 3 MVP by using a community-hosted Overpass/OSRM proxy, but must be resolved before any public launch per INFRA-03.

For GDPR in the German market: the legal minimum is a privacy policy, ToS, and user deletion capability. The German DSK (Data Protection Conference) requires cookie consent only for non-essential cookies. This SPA uses no third-party tracking cookies (no analytics, no advertising), so cookie consent banners are NOT required in Phase 3. The key GDPR implementation requirement is: (a) delete account endpoint that calls Supabase admin `deleteUser()` and cascades user data deletion via DB triggers, (b) accessible privacy policy and ToS links, and (c) EU data residency (already achieved via Supabase Frankfurt).

**Primary recommendation:** Put all Vercel serverless functions in `apps/web/api/` (not `apps/api/`); use Supabase JS SDK v2 with `onAuthStateChange` for session management; store all user data in Supabase with Row Level Security; set `"regions": ["fra1"]` in `apps/web/vercel.json`; use Vercel CDN `Cache-Control` headers for the weather/location proxies.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.97.0 (latest) | Supabase client: auth, DB queries | Official SDK; handles session persistence, token refresh, and OAuth flows |
| Supabase Auth | hosted (Frankfurt) | Email+password, Google OAuth, Apple OAuth | Locked decision; 50k MAU free tier; RLS-native auth.uid() in policies |
| Vercel Functions | platform (Node.js) | Serverless API proxy for weather/location/Overpass | Zero-ops for MVP; Fluid Compute gives 300s max duration on Hobby |
| Supabase PostgreSQL | hosted (Frankfurt) | User data: saved routes, favorites, finder searches | Co-located with auth; RLS policies enforce per-user access |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | latest | Server-side Supabase client helpers | NOT needed — this is a pure SPA with no SSR |
| node-cache / in-memory Map | N/A | In-memory cache for warm function instances | Secondary cache layer within serverless functions for burst scenarios |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel serverless functions | Express on Railway EU | Railway costs money immediately; Vercel is free for MVP; migrate later |
| Supabase Auth | Auth.js (next-auth) | Auth.js requires a server/database you manage; Supabase includes auth + DB as one managed service |
| Supabase PostgreSQL | PlanetScale / Neon | Supabase is locked decision; already includes auth; Frankfurt region confirmed |

**Installation:**
```bash
# apps/web
pnpm add @supabase/supabase-js
```

---

## Architecture Patterns

### Recommended Project Structure

The API serverless functions live inside `apps/web/api/` so Vercel's monorepo deployment (Root Directory = `apps/web`) automatically picks them up. The `apps/api` directory (currently empty) is not used for Vercel functions in this setup.

```
apps/web/
├── api/                          # Vercel serverless functions (auto-discovered)
│   ├── proxy/
│   │   ├── weather.ts            # Open-Meteo proxy with 6h cache
│   │   ├── overpass.ts           # Overpass proxy with 24h cache
│   │   ├── nominatim.ts          # Nominatim proxy with 1h cache
│   │   └── osrm-table.ts         # OSRM table proxy (self-hosted URL from env)
│   └── user/
│       ├── delete.ts             # GDPR: delete account + cascade user data
│       └── saved-routes.ts       # GET/POST saved routes (optional — can use Supabase directly)
├── src/
│   ├── components/
│   │   ├── account/              # NEW: account modal (3 tabs)
│   │   │   ├── AccountModal.tsx
│   │   │   ├── AccountTab.tsx
│   │   │   ├── SavedTab.tsx
│   │   │   └── SettingsTab.tsx
│   │   ├── auth/                 # NEW: inline sign-in prompt
│   │   │   └── InlineSignInPrompt.tsx
│   │   └── [existing components...]
│   ├── lib/
│   │   └── supabase.ts           # NEW: Supabase client singleton
│   ├── stores/
│   │   ├── appStore.ts           # existing
│   │   └── authStore.ts          # NEW: auth state (user, session, loading)
│   └── [existing structure...]
├── vercel.json                   # SPA rewrite + function region
└── package.json
```

### Pattern 1: Vercel serverless function as caching proxy (WTHR-02, INFRA-01)

**What:** A Vercel function forwards requests to the upstream API, then returns the response with `Cache-Control: s-maxage` headers so Vercel's edge CDN caches the response. Subsequent requests hit the CDN without invoking the function.

**When to use:** All four proxied APIs (Open-Meteo, Overpass, Nominatim, OSRM).

```typescript
// Source: Vercel docs — https://vercel.com/docs/functions
// apps/web/api/proxy/weather.ts

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const lat = url.searchParams.get('latitude');
    const lng = url.searchParams.get('longitude');
    const days = url.searchParams.get('forecast_days') ?? '16';

    if (!lat || !lng) {
      return new Response('Missing required parameters', { status: 400 });
    }

    const upstreamUrl = new URL('https://api.open-meteo.com/v1/forecast');
    upstreamUrl.searchParams.set('latitude', lat);
    upstreamUrl.searchParams.set('longitude', lng);
    upstreamUrl.searchParams.set('forecast_days', days);
    upstreamUrl.searchParams.set(
      'hourly',
      'temperature_2m,precipitation,sunshine_duration,wind_speed_10m'
    );
    upstreamUrl.searchParams.set('timezone', 'Europe/Berlin');

    // Add Open-Meteo commercial API key if present
    const apiKey = process.env.OPEN_METEO_API_KEY;
    if (apiKey) upstreamUrl.searchParams.set('apikey', apiKey);

    const upstream = await fetch(upstreamUrl.toString());
    const data = await upstream.text();

    return new Response(data, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        // 6-hour CDN cache; stale for 1h while revalidating
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

### Pattern 2: vercel.json for Turborepo monorepo + SPA + EU region

**What:** The `vercel.json` in `apps/web/` configures three things: SPA fallback routing (all non-API paths → `index.html`), function region (`fra1` Frankfurt), and Fluid Compute.

```json
// apps/web/vercel.json
// Source: Vercel docs — https://vercel.com/docs/project-configuration/vercel-json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "fluid": true,
  "regions": ["fra1"],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

**Critical:** The SPA rewrite `/((?!api/).*)` uses a negative lookahead to pass `/api/*` requests through to the serverless functions and rewrite everything else to `index.html`.

### Pattern 3: Supabase client singleton

**What:** Create the Supabase client once and export it. Import this singleton everywhere.

```typescript
// Source: Supabase docs — https://supabase.com/docs/guides/auth/quickstarts/react
// apps/web/src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts'; // generated types

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

**Environment variables needed (Vercel project settings + local .env):**
```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Server-side only (user deletion)
OPEN_METEO_API_KEY=<key>                        # Commercial plan key
OSRM_BASE_URL=<self-hosted-or-dev-url>
```

### Pattern 4: Zustand auth store with Supabase session

**What:** A Zustand store holds the auth state. It initializes from `onAuthStateChange` which fires `INITIAL_SESSION` on mount (loading the persisted session from localStorage), then fires on every sign-in/sign-out event. The store is the single source of truth for `user` and `session`.

```typescript
// Source: Supabase docs — https://supabase.com/docs/reference/javascript/auth-onauthstatechange
// apps/web/src/stores/authStore.ts

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => () => void;  // Returns unsubscribe fn
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        });
      }
    );
    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithApple: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
```

Initialize in `main.tsx` or `App.tsx`:
```typescript
// In App component:
useEffect(() => {
  const unsubscribe = useAuthStore.getState().initialize();
  return unsubscribe;
}, []);
```

### Pattern 5: Supabase database schema with RLS

**What:** Four tables with `user_id` foreign keys and Row Level Security policies. All policies use `auth.uid()` to scope access to the authenticated user.

```sql
-- Source: Supabase RLS docs — https://supabase.com/docs/guides/database/postgres/row-level-security

-- ── saved_routes ────────────────────────────────────────────────────
create table saved_routes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,               -- auto-generated: "München → Berchtesgaden"
  stops_json  jsonb not null,              -- serialized stop array
  date_from   date,
  date_to     date,
  created_at  timestamptz default now()
);
alter table saved_routes enable row level security;
create policy "Users can CRUD own routes"
  on saved_routes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── saved_finder_searches ────────────────────────────────────────────
create table saved_finder_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,               -- e.g. "Bayern, 3 Tage, Hiking"
  config_json jsonb not null,              -- serialized FinderConfig
  created_at  timestamptz default now()
);
alter table saved_finder_searches enable row level security;
create policy "Users can CRUD own finder searches"
  on saved_finder_searches for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── favorites ────────────────────────────────────────────────────────
create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  place_name  text not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz default now(),
  unique (user_id, lat, lng)
);
alter table favorites enable row level security;
create policy "Users can CRUD own favorites"
  on favorites for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

**Critical:** Enable RLS on every table. Tables without RLS are wide-open to any authenticated user.

### Pattern 6: Pending action queue — complete action after sign-up

**What:** When a guest taps a gated action (save route / favorite place), the action is queued before the inline sign-in prompt is shown. After `SIGNED_IN` fires, the queued action is replayed automatically.

```typescript
// apps/web/src/stores/authStore.ts addition

interface PendingAction {
  type: 'save_route' | 'favorite_place' | 'save_finder_search';
  payload: unknown;
}

// In the store:
pendingAction: PendingAction | null;
setPendingAction: (action: PendingAction | null) => void;

// In onAuthStateChange callback:
if (event === 'SIGNED_IN' && state.pendingAction) {
  // Execute pending action
  executePendingAction(state.pendingAction);
  set({ pendingAction: null });
}
```

### Pattern 7: GDPR — user deletion cascade

**What:** User deletion must remove all personal data. PostgreSQL `ON DELETE CASCADE` on foreign keys handles the cascade. The deletion endpoint uses the `service_role` key (server-side only).

```typescript
// Source: Supabase admin API — https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
// apps/web/api/user/delete.ts

import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return new Response('Unauthorized', { status: 401 });

    // Delete with service role (cascades via ON DELETE CASCADE on all tables)
    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) return new Response(error.message, { status: 500 });
    return new Response('Account deleted', { status: 200 });
  },
};
```

### Anti-Patterns to Avoid

- **Putting `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` environment variables:** Vite inlines `VITE_*` env vars into the client bundle. The service role key has admin privileges — it must ONLY be used in server-side functions (no `VITE_` prefix).
- **Not enabling RLS on tables:** Supabase tables are publicly accessible to all authenticated users unless RLS is explicitly enabled. 83% of exposed Supabase DBs in a 2025 audit were missing RLS.
- **Calling Supabase DB directly from serverless proxies without auth validation:** For user-owned data operations, always validate the user via their JWT before any DB writes.
- **Using Supabase client `deleteUser` from the browser:** `deleteUser` requires `service_role` key — must be called server-side only.
- **Missing Apple key rotation reminder:** Apple OAuth requires regenerating the secret key every 6 months. Missing it causes all Apple sign-ins to fail silently.
- **Building the SPA rewrite without the API route exclusion:** A simple `{ "source": "/(.*)", "destination": "/index.html" }` rewrite will intercept `/api/*` requests and return the HTML app instead of calling the serverless function. Use the negative lookahead pattern.
- **Deploying OSRM proxy without a backing OSRM server:** The OSRM proxy function requires a self-hosted OSRM URL in `process.env.OSRM_BASE_URL`. Phase 3 MVP should either (a) use a Railway EU instance of OSRM or (b) acknowledge the limitation with a fallback to air-distance only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth (email, OAuth, session management) | Custom JWT + session storage | Supabase Auth | Token refresh, PKCE flow, provider-specific edge cases (Apple 6-month rotation), email verification — all handled |
| Row-level data access control | Custom user_id filter on every query | Supabase RLS with `auth.uid()` | Policies enforced in the DB; can't be bypassed even if application code has bugs |
| API route caching | Redis / in-memory state | Vercel CDN `Cache-Control: s-maxage` header | Vercel automatically caches function responses at the edge; no infrastructure to manage |
| Password reset flow | Custom email + token generation | Supabase `resetPasswordForEmail()` | Handles token generation, expiry, email delivery |
| User data cascade deletion | Manual delete calls to each table | PostgreSQL `ON DELETE CASCADE` + Supabase admin `deleteUser` | DB cascade is atomic and reliable; application-level cascade misses edge cases |
| Session persistence across page reloads | Manual localStorage token | Supabase SDK default behavior | `@supabase/supabase-js` stores and restores session from localStorage automatically |

**Key insight:** Supabase is a managed platform — trust it for auth, session, and data access control. The only custom code needed is the API proxy functions and the UI components.

---

## Common Pitfalls

### Pitfall 1: Supabase Free Tier Auto-Pause (CRITICAL for production)
**What goes wrong:** Supabase free tier pauses the project if no API requests are received for 7 consecutive days. The app goes offline and returns errors until manually resumed from the dashboard.
**Why it happens:** Free tier cost optimization; only affects projects with zero activity.
**How to avoid:** Configure a Vercel cron job that pings a no-op Supabase endpoint every 3 days:
```json
// In apps/web/vercel.json, add under "crons":
{ "path": "/api/keepalive", "schedule": "0 12 */3 * *" }
```
And implement `apps/web/api/keepalive.ts` that does a lightweight `supabase.from('saved_routes').select('count').limit(0)`.
**Warning signs:** App returns 503 or auth errors after a vacation/holiday period of no users.

### Pitfall 2: RLS Disabled by Default
**What goes wrong:** Developer creates a table in Supabase dashboard and can read/write to it from any authenticated user. Data from user A is visible to user B.
**Why it happens:** RLS is `DISABLED` by default in PostgreSQL and in Supabase's dashboard table creator.
**How to avoid:** Always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` before launching. Add this as a required checklist step before deployment.
**Warning signs:** Any authenticated user can read other users' saved routes by changing the user_id filter.

### Pitfall 3: OAuth Redirect URL Mismatch
**What goes wrong:** Google or Apple OAuth returns an error: "redirect_uri_mismatch" or "invalid redirect". This happens when the `redirectTo` URL doesn't match an authorized redirect URI.
**Why it happens:** OAuth providers require redirect URIs to be pre-registered. The Vercel preview deployment URL changes per deployment; the `vercel.app` production subdomain must be the registered one.
**How to avoid:** Register exactly `https://weatherchaser.vercel.app` as the authorized redirect URI in Google Cloud Console and Apple Developer Portal. The Supabase dashboard callback is always `https://<project-id>.supabase.co/auth/v1/callback` — register this in the OAuth provider too.
**Warning signs:** OAuth sign-in fails only on the production deployment but works locally.

### Pitfall 4: Apple OAuth 6-Month Key Expiry
**What goes wrong:** Apple Sign-In stops working completely across the entire app. All Apple authentication fails with a generic error. This happens 6 months after the signing key was generated.
**Why it happens:** Apple requires web OAuth flows to use a signed JWT as the client secret. This JWT must be regenerated every 6 months using the original `.p8` signing key.
**How to avoid:** Set a calendar reminder at the time of initial setup for 5.5 months from now. Store the `.p8` file securely (encrypted, not in git). Update the `Client Secret` in Supabase dashboard immediately when regenerated.
**Warning signs:** All new Apple sign-ins fail; existing sessions may still work.

### Pitfall 5: Vercel `VITE_*` Variables Exposed in Bundle
**What goes wrong:** Developer names a sensitive key `VITE_SUPABASE_SERVICE_ROLE_KEY`. Vite inlines all `VITE_*` environment variables into the JavaScript bundle at build time. The service role key is now publicly visible to anyone who inspects the bundle.
**Why it happens:** `VITE_*` is the Vite convention for "expose this to the client". Keys without this prefix are NOT included in the bundle.
**How to avoid:** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` should use the `VITE_` prefix. The anon key is intentionally public (protected by RLS). All other keys (`SUPABASE_SERVICE_ROLE_KEY`, `OPEN_METEO_API_KEY`, `OSRM_BASE_URL`) are serverless-only — no `VITE_` prefix.
**Warning signs:** Bundle inspector (Vite Bundle Analyzer) shows secret keys in the output.

### Pitfall 6: Nominatim Proxy Without Debounce → Still Rate-Limited
**What goes wrong:** The Nominatim proxy removes the per-user rate limit but introduces a shared rate limit. If 3 users search simultaneously, the proxy sends 3 concurrent requests to Nominatim, potentially exceeding 1 req/s from the shared proxy IP.
**Why it happens:** The proxy is a shared IP address making all Nominatim requests.
**How to avoid:** Keep the 500ms debounce in the frontend search input. Add a simple request queue in the proxy function if needed. For production scale, switch to a self-hosted Nominatim instance.
**Warning signs:** Geocoding returns `{"error": "usage limit reached"}` even through the proxy.

### Pitfall 7: OSRM Not Available for Production Launch (INFRA-03)
**What goes wrong:** Phase 3 completes but OSRM proxy points to `router.project-osrm.org` (demo server), violating INFRA-03 which requires no production use of public demo endpoints.
**Why it happens:** OSRM self-hosting requires a server (Railway EU, Hetzner, etc.) and significant preprocessing (Germany OSM extract requires 12-16 GB RAM during preprocessing; runtime needs ~4-8 GB RAM).
**How to avoid:** Either (a) provision a Railway EU instance with Docker before public launch, or (b) document the OSRM limitation and replace the route distance matrix with air-distance fallback for Phase 3 MVP, planning OSRM self-hosting as a Phase 3.5 task.
**Warning signs:** OSRM table requests fail or are rate-limited during production traffic.

### Pitfall 8: Supabase Hobby Project Region (fra1 not guaranteed until configured)
**What goes wrong:** Supabase project is created in the US region by default, not Frankfurt.
**Why it happens:** Default region selection at project creation.
**How to avoid:** When creating the Supabase project, explicitly select `Frankfurt (eu-central-1)`. Cannot be changed after creation.
**Warning signs:** Supabase project settings show region as `us-east-1` or similar non-EU region.

---

## Code Examples

Verified patterns from official sources:

### Supabase sign-up / sign-in (email + password)

```typescript
// Source: https://supabase.com/docs/guides/auth/passwords

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    emailRedirectTo: window.location.origin,
  },
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// Password reset (step 1: send email)
await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: `${window.location.origin}/reset-password`,
});

// Password reset (step 2: update after redirect)
await supabase.auth.updateUser({ password: 'new_password' });
```

### Supabase Google / Apple OAuth

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signinwithoauth

// Google
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin },
});

// Apple
await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: { redirectTo: window.location.origin },
});
```

### Session initialization (onAuthStateChange + INITIAL_SESSION)

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

// INITIAL_SESSION fires immediately on subscribe, providing the persisted session
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === 'SIGNED_OUT') {
      setSession(null);
    } else if (session) {
      setSession(session);
    }
    setLoading(false);
  }
);

return () => subscription.unsubscribe();
```

### RLS user-owned data policy

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Single "all operations" policy for user-owned data
CREATE POLICY "Users own their favorites"
  ON favorites
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

### Vercel proxy function with CDN caching (cache-control pattern)

```typescript
// Source: Vercel Functions docs — https://vercel.com/docs/functions

export default {
  async fetch(request: Request): Promise<Response> {
    const upstream = await fetch('https://api.external.com/data');
    const body = await upstream.text();

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        // Cache at Vercel edge for 6 hours; allow stale for 1 hour
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

### Overpass proxy example

```typescript
// apps/web/api/proxy/overpass.ts

export default {
  async fetch(request: Request): Promise<Response> {
    const body = await request.text(); // Overpass QL query body

    const upstream = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WeatherChaser/1.0 (weatherchaser.vercel.app)',
      },
    });

    const data = await upstream.text();

    return new Response(data, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        // Town/village data changes rarely — 24h cache is safe
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

### Turborepo deploy configuration for Vercel (monorepo setup)

```
Vercel Project Settings:
  Root Directory: apps/web
  Framework Preset: Vite
  Build Command: cd ../.. && turbo build --filter=@weatherchaser/web
  Output Directory: dist
  Install Command: pnpm install
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel Functions with 10s Hobby limit | Fluid Compute gives 300s on Hobby | April 23, 2025 (enabled by default) | Proxy functions no longer at risk of timeout |
| Vercel Hobby functions always in iad1 (US) | Hobby can now select region (fra1 available) | 2024 Vercel changelog | API functions CAN run in EU on free plan |
| Supabase session via `getSession()` | Session via `onAuthStateChange` + `INITIAL_SESSION` event | SDK v2.x | More reliable; INITIAL_SESSION fires sync on subscribe |
| Manual OAuth state management | Supabase SDK handles PKCE + token exchange | SDK v2.x | No custom callback handling needed |
| Apple OAuth with permanent client secret | Apple OAuth requires 6-month key rotation | Apple policy (ongoing) | Must set calendar reminder; blocking if missed |

**Deprecated/outdated:**
- Vercel `functions.maxDuration` limit of 10s on Hobby: Superseded by Fluid Compute (300s default for new projects)
- Supabase `getSession()` as primary session source: Replaced by `onAuthStateChange` with `INITIAL_SESSION` event which is more reliable and works without async race conditions

---

## Open Questions

1. **OSRM production hosting for Phase 3 MVP**
   - What we know: OSRM self-hosting requires 12-16 GB RAM for Germany preprocessing; Railway EU is the planned migration path; public OSRM demo is prohibited for production use
   - What's unclear: Whether to include OSRM self-hosting in Phase 3 or document it as a known blocker and use air-distance fallback for MVP
   - Recommendation: Use air-distance matrix (already in the algorithm as fallback from Phase 1) for Phase 3 MVP with a note in the UI. Create a Phase 3 sub-task for OSRM Railway EU deployment that can be done independently without blocking other Phase 3 work.

2. **Vercel Hobby commercial use restriction**
   - What we know: Vercel Hobby plan states "non-commercial, personal use only" in fair use guidelines
   - What's unclear: Whether a free-to-use travel planning app constitutes "commercial use" before any monetization
   - Recommendation: For Phase 3 MVP (no revenue, no Premium tier, no paywalls), Hobby plan is acceptable. Plan migration to Pro (~$20/month) when Phase 4 (monetization) is implemented.

3. **Apple Sign-In availability in web-only Phase 3**
   - What we know: Apple Sign-In via OAuth works in web browsers; the 6-month key rotation applies to web OAuth flows
   - What's unclear: Whether Apple's developer program membership is required before implementing the OAuth flow, and whether the Apple Developer account setup needs to happen before starting development
   - Recommendation: Set up the Apple Developer account and create the Services ID at the start of Phase 3 — this is a prerequisite for testing Apple OAuth locally and cannot be done at the last minute.

4. **Supabase Hobby auto-pause and public launch**
   - What we know: Free tier pauses after 7 days of zero API activity
   - What's unclear: Whether the keep-alive cron pattern is reliable enough for an MVP launch, or whether the Pro plan ($25/month) is needed from day one
   - Recommendation: Use the Vercel cron keep-alive for Phase 3 MVP. Switch to Supabase Pro when monthly active users exceed 1,000 or revenue is generated in Phase 4.

---

## Sources

### Primary (HIGH confidence)
- Supabase Auth official docs — https://supabase.com/docs/guides/auth — auth methods, session management
- Supabase `onAuthStateChange` reference — https://supabase.com/docs/reference/javascript/auth-onauthstatechange — event types, React pattern
- Supabase `signInWithOAuth` reference — https://supabase.com/docs/reference/javascript/auth-signinwithoauth — OAuth method signature
- Supabase email+password guide — https://supabase.com/docs/guides/auth/passwords — signUp, signInWithPassword, resetPasswordForEmail
- Supabase Apple OAuth guide — https://supabase.com/docs/guides/auth/social-login/auth-apple — 6-month key rotation requirement
- Supabase Google OAuth guide — https://supabase.com/docs/guides/auth/social-login/auth-google — redirect URI setup
- Supabase RLS docs — https://supabase.com/docs/guides/database/postgres/row-level-security — auth.uid(), policy patterns
- Supabase React quickstart — https://supabase.com/docs/guides/auth/quickstarts/react — client setup, session initialization
- Supabase admin deleteUser reference — https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — GDPR deletion, service_role requirement
- @supabase/supabase-js npm — v2.97.0 confirmed current (Feb 18, 2026)
- Vercel Functions docs — https://vercel.com/docs/functions — serverless function structure, Web Signature fetch handler
- Vercel Functions Limits — https://vercel.com/docs/functions/limitations — 2GB memory, 300s duration (Fluid), 4.5MB payload
- Vercel Hobby Plan docs — https://vercel.com/docs/plans/hobby — 1M invocations/month, 4 CPU-hrs, non-commercial use
- Vercel Fluid Compute docs — https://vercel.com/docs/fluid-compute — 300s default/max on Hobby with Fluid; enabled by default April 23, 2025
- Vercel Project Configuration / vercel.json — https://vercel.com/docs/project-configuration/vercel-json — rewrites, regions, functions, crons
- Vercel Regions — https://vercel.com/docs/regions — fra1 = Frankfurt (eu-central-1), default iad1
- Vercel Function Regions — https://vercel.com/docs/functions/configuring-functions/region — region selection
- Vercel Turborepo deployment — https://vercel.com/docs/monorepos/turborepo — Root Directory pattern, build command
- Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/ — 1 req/s max, auto-complete prohibited, commercial caution

### Secondary (MEDIUM confidence)
- Vercel Hobby region selection changelog — https://vercel.com/changelog/hobby-customers-can-now-select-their-preferred-region-for-serverless — confirms Hobby can select fra1; exact date of changelog not captured
- Frankfurt fra1 pricing is Pro-only — https://vercel.com/docs/pricing/regional-pricing/fra1 — PRICING is Pro-only, but the region can still be selected on Hobby (confirmed via changelog)
- Supabase free tier auto-pause confirmed — multiple community sources + official troubleshooting docs
- OSRM Germany preprocessing RAM: 12-16 GB — derived from multiple GitHub issues and blog posts (no single authoritative source)
- GDPR German market requirements — https://usercentrics.com/knowledge-hub/ and German DSK guidelines: no cookie banner needed for first-party functional cookies only

### Tertiary (LOW confidence)
- Vercel Hobby commercial use enforcement: unclear whether "non-commercial" is strictly enforced for pre-revenue open web apps — flag for Phase 4 planning
- German Consent Management Ordinance (April 2025): voluntary compliance, no certified CMPs yet as of Feb 2025 — monitoring recommended but no action required for Phase 3

---

## Metadata

**Confidence breakdown:**
- Standard stack (Supabase + Vercel): HIGH — all versions and limits verified via official docs
- Supabase Auth patterns: HIGH — verified via official quickstarts and API reference
- Vercel serverless proxy pattern: HIGH — verified via official docs; Web Signature format confirmed
- Vercel Hobby region selection (fra1): MEDIUM-HIGH — confirmed via changelog; fra1 pricing doc only mentions Pro plan billing rates, not Hobby access restriction
- Supabase free tier auto-pause: HIGH — confirmed via official troubleshooting docs
- OSRM self-hosting requirements: MEDIUM — RAM estimates from multiple community sources, no single authoritative number
- GDPR German market requirements: MEDIUM — based on DSK guidelines and legal analysis; recommend legal review for final privacy policy text
- Apple OAuth 6-month rotation: HIGH — official Supabase Apple OAuth documentation

**Research date:** 2026-03-05
**Valid until:** 2026-06-05 (90 days; re-verify Supabase SDK version before planning)
