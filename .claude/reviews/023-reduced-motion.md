# Codex Adversarial Review — 023-reduced-motion (P1 #7 pt.2)

- **Date:** 2026-05-31
- **Commit:** `2e1db32` (branch `023-reduced-motion`, base `origin/main` 8c366d7)
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src/lib/reduced-motion.ts`, `src/components/playback-bar/AiPlaybackBar.tsx`, `src/__tests__/unit/reduced-motion.test.ts`.

## Verdict: PASS (after one revision)

**Round 1 → CHANGES REQUIRED (test gap only).** No BLOCKER/MAJOR/MINOR, but the "SSR-safe" test stubbed `matchMedia=undefined` without exercising the `typeof window === "undefined"` branch (jsdom always defines `window`), so that branch was unasserted.

**Resolution.** Switched the helper to read `globalThis.matchMedia` — the universal global across browser / Node / SSR / worker — collapsing to a single guard (`typeof globalThis.matchMedia !== "function"`). That removes the untestable-in-jsdom branch entirely, and the `matchMedia=undefined` test now fully exercises the lone no-DOM path. Browser behavior is unchanged (`globalThis === window`).

**Round 2 → PASS.** Codex confirmed: the no-DOM branch is now directly covered; browser behavior equivalent; both `AiPlaybackBar` `scrollIntoView` calls use the resolved `behavior`; no new dep / Tauri scope / boundary issue.

Codex could not execute the tests in its read-only sandbox (no `pnpm`/network). Verified here both rounds: `pnpm lint` 0 errors, `pnpm typecheck` exit 0, `pnpm exec vitest run …reduced-motion.test.ts` → 5/5 pass.

Logs: `/tmp/lectrice-023-codex.log` (round 1), `/tmp/lectrice-023-codex2.log` (round 2).
