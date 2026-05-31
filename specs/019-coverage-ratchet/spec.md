# Spec 019 — Coverage Gate Ratchet (P0#4)

## Problem

The frontend coverage floors in `vitest.config.ts` were set by Spec 009
(2026-05-30) to the then-measured baseline: `lines 42 / functions 53 /
branches 80 / statements 42`. Specs 010–015 then added store/domain tests and
merged into `origin/main` (now `8c366d7`), raising real coverage well above
those floors. A regression gate pinned below current coverage lets a regression
slip in silently. 009 explicitly deferred: "raise floors after the test branches
land." They have landed.

## Decision

Re-measure and ratchet the floors UP to just under the measured values. Never
lower a floor (that destroys the signal). This is a CI-governance change only —
no product code, no Tauri scope, no new dependency.

Measured (`pnpm test:coverage`, v8, origin/main 8c366d7):

| Metric     | Measured | Old floor | New floor |
| ---------- | -------- | --------- | --------- |
| Lines      | 46.91%   | 42        | 46        |
| Statements | 46.91%   | 42        | 46        |
| Functions  | 59.58%   | 53        | 59        |
| Branches   | 88.72%   | 80        | 88        |

Integer floor just below measured (0.58–0.91pp margin); the suite is
deterministic (no flaky coverage), so the tight margin is safe. Target remains
80 across the board. Policy + history: `docs/coverage-budget.md`.

## Scope

- `vitest.config.ts` — `coverage.thresholds` + comment.
- `docs/coverage-budget.md` — new current-floor section; 009 kept as history.

Out of scope: adding tests, touching product code, raising toward 80 (future
iterations as coverage rises).

## Verification

- `pnpm test:coverage` passes the new floors — run twice (baseline measure +
  post-raise), exit 0, 555 tests / 33 files.
- `pnpm typecheck` clean (config file excluded from `tsc`); `pnpm lint` 0 errors;
  `git diff --check` clean.
- Codex adversarial review: VERDICT PASS, no findings
  (`.claude/reviews/019-coverage-ratchet.md`).

## Rollback

Revert commit `42e5825`. The floors return to 009's values (42/53/80/42); CI
still passes (measured coverage is above both). No data/migration impact.

## Checklist

- [x] Hexagonal boundaries: N/A (no product code).
- [x] No direct `invoke()`: N/A.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none in diff (Codex-scanned).
- [x] Offline behavior: unaffected.
- [x] Frontend tests: full suite run with coverage, pass new gate.
- [x] Backend tests: N/A (Rust coverage is separate, not gated).
- [x] Build/bundle smoke: N/A (config-only).
- [x] Accessibility impact: none.
- [x] Rollback: documented above.
- [x] Codex review: PASS.
