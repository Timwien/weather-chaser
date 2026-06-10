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
