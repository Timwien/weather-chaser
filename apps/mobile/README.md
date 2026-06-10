# @weatherchaser/mobile — Expo scaffold (Phase 5)

Native iOS/Android app sharing `@weatherchaser/core` (scoring + route planner).

## Status

Scaffold only. `App.tsx` runs a deterministic demo route through the shared
core to prove the monorepo wiring (pnpm workspaces + Metro `watchFolders`).

## Run locally

```bash
pnpm install
pnpm --filter @weatherchaser/mobile start   # Expo dev server → scan QR with Expo Go
```

## Phase 5 build-out (planned)

- `@rnmapbox/maps` for the native map (decision from project init — verify
  compatibility with the current Expo SDK before committing, see STATE.md blocker)
- Entry flow + itinerary + finder screens reusing the web's interaction model
- Shared locale package (move `apps/web/src/i18n/locales` → `packages/locales`)
- Supabase auth (expo-auth-session for Google/Apple sign-in)
- EAS Build + Submit (requires Apple Developer + Google Play accounts — USER)

## Blocked on user accounts

- Apple Developer Program membership (App Store distribution + Sign in with Apple)
- Google Play Console account
- Expo EAS account (free tier works to start)
