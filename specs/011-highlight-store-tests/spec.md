# Spec 011 — TTS Highlight Store Tests

**Status:** Implemented
**Branch:** `011-highlight-store-tests` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

`src/stores/tts-highlight-store.ts` — the Zustand state machine that drives
word-by-word karaoke highlighting (start/stop/pause/resume, current word index,
derived selectors) — was **0% covered** (per the spec-009 baseline). It is core
to the marquee feature (paired with the `chars_to_words` algorithm tested in
spec 010), and its guard logic (pause only when active + not already paused;
resume only when paused; out-of-range word selection) is easy to regress.

## Goal

Add focused unit tests for every action, guard, and selector. Test-only;
follows through on spec 009's "raise floors as tests land" commitment by
covering one of the 0%-covered stores.

## Non-goals

- No production code change.
- No `vitest.config.ts` threshold change — the coverage gate / ratchet is owned
  by spec 009 (unmerged, off a different branch). Bumping the floor to credit
  this store's new coverage should happen once 009 lands (noted as follow-up).

## Tests (15)

start (active + timings + text + page + index 0), stop (clears playback),
pause (records elapsed), pause no-ops (inactive / already-paused /
playbackStartTime null), resume (asserts the exact `now - pausedAtTime`
re-anchor via a stubbed `performance.now`), resume no-op when not paused,
updateCurrentWord (subscription proves it emits only on change),
setPlaybackStartTime, reset; selectors: selectCurrentWord (active /
out-of-range / stopped) and selectIsHighlighting (active && !paused).

## Verification

`pnpm exec vitest run tts-highlight-store` (15 pass), `pnpm typecheck`. No mocks
needed (`performance.now()` is provided by jsdom). No production code touched →
no runtime risk.

## Note on branch independence

Off `origin/main`, touches only a new test file + this spec → merges cleanly
with 008/009/010. The coverage GATE in this worktree is still the pre-009 flat
80% (so `pnpm test:coverage` would fail as it does on main today); this slice is
verified with a targeted test run, not the global gate.

## Rollback

`git revert` (test-only).
