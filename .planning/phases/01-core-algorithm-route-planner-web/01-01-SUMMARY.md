---
phase: 01-core-algorithm-route-planner-web
plan: 01
subsystem: infra
tags: [turborepo, pnpm, typescript, vite, react, monorepo]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with pnpm workspaces (packages/* and apps/*)
  - Shared TypeScript config package (@weatherchaser/typescript-config) with base.json and react-library.json
  - packages/core internal library skeleton with shared domain types (Town, WeatherScore, Route, OptimizerInput, etc.)
  - apps/web Vite + React 19 SPA skeleton serving blank landing page
  - apps/mobile and apps/api placeholder directories for future phases
  - pnpm-lock.yaml lockfile and turbo build pipeline
affects:
  - 01-02-PLAN
  - 01-03-PLAN
  - 01-04-PLAN
  - 01-05-PLAN
  - 01-06-PLAN
  - 01-07-PLAN
  - 01-08-PLAN
  - 01-09-PLAN
  - 01-10-PLAN

# Tech tracking
tech-stack:
  added:
    - turbo@2.8.12
    - typescript@5.9.3
    - vite@6.4.1
    - react@19
    - react-dom@19
    - @vitejs/plugin-react@4.x
    - zustand@5.x
    - "@tanstack/react-router@1.x"
    - maplibre-gl@5.19.x
    - "@vis.gl/react-maplibre@8.1.x"
    - i18next@24.x
    - react-i18next@15.x
    - i18next-browser-languagedetector@8.x
    - "@turf/turf@7.x"
    - "@watergis/maplibre-gl-terradraw@latest"
  patterns:
    - Turborepo task graph with build depending on ^build (upstream packages build first)
    - moduleResolution Bundler with ESNext module for all TypeScript packages
    - ESM-first (type: module) across all packages
    - .js extension on imports in TypeScript ESM source files (TS resolves to .ts)
    - apps/web uses allowImportingTsExtensions + noEmit; Vite handles bundling

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - .npmrc
    - tsconfig.json
    - pnpm-lock.yaml
    - packages/typescript-config/package.json
    - packages/typescript-config/base.json
    - packages/typescript-config/react-library.json
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/src/index.ts
    - packages/core/src/types/index.ts
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/vite.config.ts
    - apps/web/index.html
    - apps/web/src/main.tsx
    - apps/web/src/app.tsx
    - apps/mobile/.gitkeep
    - apps/api/.gitkeep
  modified: []

key-decisions:
  - "allowImportingTsExtensions: true added to apps/web tsconfig — required when importing .tsx files by extension with Bundler moduleResolution and noEmit mode; Vite handles actual bundling"
  - "pnpm@9.15.4 pinned in packageManager field for Corepack consistency"
  - "packages/core exports map includes scoring and optimizer sub-paths (./scoring, ./optimizer) for future tree-shaking in Plans 02 and 03"

patterns-established:
  - "tsconfig extends chain: package tsconfig.json -> @weatherchaser/typescript-config/base.json (or react-library.json)"
  - "All workspace packages use workspace:* for internal dependencies"
  - "Domain types live in packages/core/src/types/index.ts and are exported via barrel in packages/core/src/index.ts"

requirements-completed:
  - INFRA-05

# Metrics
duration: 10min
completed: 2026-02-27
---

# Phase 1 Plan 01: Monorepo Scaffold Summary

**Turborepo + pnpm workspaces monorepo with shared TypeScript config, packages/core domain types skeleton, and Vite + React 19 web app that builds cleanly with turbo build**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-27T20:21:28Z
- **Completed:** 2026-02-27T20:31:00Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Turborepo monorepo initialized with pnpm workspaces linking packages/* and apps/*
- Shared TypeScript config package with strict base.json and React-extended react-library.json
- packages/core skeleton with all shared domain types (Town, HourlyWeather, WeatherScore, ScoringWeights, Stop, Route, OptimizerConfig, OptimizerInput) and exports map
- apps/web Vite 6 + React 19 SPA skeleton compiles and builds to dist/ without errors
- turbo build pipeline executes packages/core before apps/web via ^build dependency

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Turborepo monorepo with pnpm workspaces** - `77c2ad5` (chore)
2. **Task 2: Create packages/core skeleton and apps/web Vite + React skeleton** - `bd9a614` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `package.json` - Root workspace package with turbo/typescript devDependencies and build scripts
- `pnpm-workspace.yaml` - Workspace definition linking packages/* and apps/*
- `turbo.json` - Turborepo task graph: build depends on ^build; dev is persistent/uncached
- `.npmrc` - auto-install-peers=true
- `tsconfig.json` - Root TypeScript config (noEmit, extends base.json)
- `pnpm-lock.yaml` - Lockfile with all resolved dependencies
- `packages/typescript-config/base.json` - Strict tsconfig base (Bundler moduleResolution, ES2022 target)
- `packages/typescript-config/react-library.json` - Extends base, adds DOM + react-jsx
- `packages/core/package.json` - @weatherchaser/core internal package with exports map
- `packages/core/tsconfig.json` - Extends typescript-config/base.json; outputs to dist/
- `packages/core/src/types/index.ts` - All shared domain interfaces (Town, Route, WeatherScore, etc.)
- `packages/core/src/index.ts` - Public barrel re-exporting all types
- `apps/web/package.json` - @weatherchaser/web with React 19, MapLibre, Zustand, TanStack Router, i18next
- `apps/web/tsconfig.json` - Extends react-library.json; allowImportingTsExtensions; noEmit
- `apps/web/vite.config.ts` - Vite 6 config with React plugin and ES worker format
- `apps/web/index.html` - SPA entry HTML with #root div
- `apps/web/src/main.tsx` - React 19 createRoot entry point
- `apps/web/src/app.tsx` - Blank App component returning "WeatherChaser — loading..."
- `apps/mobile/.gitkeep` - Phase 5 placeholder
- `apps/api/.gitkeep` - Phase 3 placeholder

## Decisions Made
- Added `allowImportingTsExtensions: true` to apps/web tsconfig.json — required for importing `.tsx` files by full extension when using `moduleResolution: Bundler` and `noEmit: true`; Vite handles bundling so tsc only type-checks
- Pinned `pnpm@9.15.4` in root package.json `packageManager` field for Corepack-managed consistency
- packages/core exports map pre-declares `./scoring` and `./optimizer` sub-paths to support tree-shaking when Plans 02 and 03 fill those modules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added allowImportingTsExtensions to apps/web tsconfig**
- **Found during:** Task 2 (Create packages/core and apps/web skeletons)
- **Issue:** `apps/web/src/main.tsx` imports `./app.tsx` with `.tsx` extension; TypeScript 5.x with `moduleResolution: Bundler` raises TS5097 error unless `allowImportingTsExtensions: true` is set
- **Fix:** Added `"allowImportingTsExtensions": true` to `apps/web/tsconfig.json` compilerOptions
- **Files modified:** `apps/web/tsconfig.json`
- **Verification:** `pnpm turbo build` exits 0 with both packages building successfully
- **Committed in:** `bd9a614` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 TypeScript configuration bug)
**Impact on plan:** Fix required for build correctness; no scope change; Vite/tsc pattern unchanged.

## Issues Encountered
None beyond the tsconfig auto-fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo scaffold complete; all subsequent plans in Phase 1 write into files created here
- packages/core/src/scoring/ and packages/core/src/optimizer/ directories do not exist yet — Plans 02 and 03 create them
- apps/web is a blank page; Plan 04 adds the map; Plan 05 adds routing UI
- apps/mobile and apps/api are placeholder directories only

---
*Phase: 01-core-algorithm-route-planner-web*
*Completed: 2026-02-27*
