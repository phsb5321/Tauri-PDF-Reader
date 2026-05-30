# Codex Adversarial Review — Spec 011 (TTS Highlight Store Tests)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Final verdict (round 2):** Sound — 0 BLOCKER, 0 MAJOR.

## Round 1

No BLOCKER. **MAJOR:** the resume test asserted only `playbackStartTime != null`,
so a regression to `playbackStartTime = performance.now()` would still pass —
the re-anchor formula (`now - pausedAtTime`) wasn't actually protected.
MINORs: missing pause-guard branch (active + `playbackStartTime === null`);
`updateCurrentWord` no-op not proven; spec said "15 pass" vs 14 tests.

## Fixes

- Resume test now stubs `performance.now` (start@1000, pause@1500→pausedAtTime
  500, resume@2000) and asserts `playbackStartTime === 1500` — a `now()`
  regression yields 2000 and fails.
- Added pause no-op test for active + null start time (via `setState`).
- `updateCurrentWord` test now uses a store subscription counter: `updateCurrentWord(0)`
  (unchanged) emits 0, `updateCurrentWord(1)` emits 1.
- Spec/tasks counts corrected to 15.

## Round 2

> BLOCKER none. MAJOR none — resume test catches the `now()` regression.
> MINOR: restore mocks in `afterEach` so a mid-test failure can't pollute later
> tests. VERDICT: **Sound** (guards non-tautological; `setState` reset by beforeEach).

MINOR addressed: added `afterEach(() => vi.restoreAllMocks())`.

15 tests pass; `pnpm typecheck` clean. Test-only; no production code changed.
