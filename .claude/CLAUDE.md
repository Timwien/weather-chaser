# Agent Instructions

Read this entire file before starting any task.

## Self-Correcting Rules Engine

This file contains a growing ruleset that improves over time. **At session start, read the entire "Learned Rules" section before doing anything.**

### How it works

1. When the user corrects you or you make a mistake, **immediately append a new rule** to the "Learned Rules" section at the bottom of this file.
2. Rules are numbered sequentially and written as clear, imperative instructions.
3. Format: `N. [CATEGORY] Never/Always do X — because Y.`
4. Categories: `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`, `[OTHER]`
5. Before starting any task, scan all rules below for relevant constraints.
6. If two rules conflict, the higher-numbered (newer) rule wins.
7. Never delete rules. If a rule becomes obsolete, append a new rule that supersedes it.

### When to add a rule

- User explicitly corrects your output ("no, do it this way")
- User rejects a file, approach, or pattern
- You hit a bug caused by a wrong assumption about this codebase
- User states a preference ("always use X", "never do Y")

### Rule format example

```
14. [CODE] Always use `bun` instead of `npm` — user preference, bun is installed globally.
15. [STYLE] Never add emojis to commit messages — project convention.
16. [ARCH] API routes live in `src/server/routes/`, not `src/api/` — existing codebase pattern.
```

---

## Learned Rules

<!-- New rules are appended below this line. Do not edit above this section. -->

1. [PROCESS] **CRITICAL RULE: IDENTICAL CONTENT REQUIRED** — If you are modifying `GEMINI.md`, you MUST make the exact same modifications to `CLAUDE.md`. If you are modifying `CLAUDE.md`, you MUST make the exact same modifications to `GEMINI.md`.
2. [PROCESS] **No Simultaneous Execution** — Claude Code and Gemini (Antigravity) must NEVER be used at the exact same time. This prevents race conditions and ensures we do not overwrite each other's work. Let one AI finish its complete generation/task before interacting with the other.
3. [PROCESS] **Review Before Action** — When starting a new task, always review the latest file states to pick up where the other AI left off.
4. [CODE] **i18n Support Required** — Never use hard-coded strings. Always use translation keys and ensure that both English and German languages are supported when developing anything new.
5. [TOOL] **Gate commits on exit codes, not on grep output** — Never chain `pnpm test | grep ... && git commit`; the grep succeeds on a FAIL summary too. Run each check with its own exit code (e.g. `cmd > log 2>&1 || exit 1`) before committing — because a broken file was committed that way on 2026-10-22.
6. [TOOL] **Work in the clone `~/dev/weather-chaser`, not the iCloud copy** — files under `~/Documents` are iCloud-evicted (`dataless`) and git/pnpm hang there (2026-10-21).
7. [DATA] DWD ICON-EU layers (`…TOTPREC01H/03H`) advertise ~33 h of history in GetCapabilities, but the GeoServer only holds the newest model run — older instants answer HTTP 200 + XML. Probe the first usable instant (`usableFromFirst` in `dwdLayers.ts`) instead of trusting the time extent — found 2026-10-22 while building the past view.
8. [CODE] The WMS gap placeholder (`EMPTY_PNG` in `wmsProtocol.ts`) must decode to alpha 0 — the old constant was an opaque blue pixel and painted every time-series gap as a violet veil; it is now covered by a test that inflates the PNG. Request DWD tiles at 512 px (`WMS_TILE_SIZE`): a quarter of the requests at the same sharpness, and DWD latency is per request.
9. [CODE] `stop.arrivalDate` comes from `addDays(start, n)` = `+ n x 24 h` (core `dateUtils.ts`) and drifts by one hour over a DST change (25 Oct 2026: arrival 25 Oct 23:00 instead of 26 Oct 00:00) — derive the local calendar day by rounding (`date + 12 h`, then local y/m/d) and build clock times with `new Date(y, m, d + n, h)`, never `+ 24 h` arithmetic (`utils/routeSchedule.ts`). Probe failures (abort/429/5xx/network) are not "no data" — only HTTP 200 + non-image is (`hasImage` in `dwdLayers.ts`).
10. [CODE] Test weather playback against a production build with a fresh context and the layer off, not only the dev server — lazy chunks attach later in production: the `CloudOverlay` attached after "Wetterverlauf" had started playing, got no time and never fetched, and playback waited for its status forever (D1, 2026-10-23). A readiness input must come from data that is guaranteed to arrive (the overlay fetches on attach), and `PlaybackEngine` has a 20 s watchdog. Also: MapLibre may fire no `sourcedata` after a flyTo drops the last loading tiles (poll `isSourceLoaded`, `wmsOverlay.ts`); an `OffscreenCanvas` whose pixels are read needs `willReadFrequently` (GPU readback cost ~110 ms per tile, `wmsProtocol.ts`).
11. [ARCH] **No test or helper files directly under `apps/web/api/` except in `_`-prefixed folders** — Vercel deploys every file there as a serverless function (Hobby limit: 12). `api/user/delete.test.ts` broke the deploy on 2026-10-23; `api/_lib/functionLayout.test.ts` now guards this.
