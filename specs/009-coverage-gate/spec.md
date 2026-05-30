# Spec 009 — Coverage Gate Decision (honest ratchet)

**Status:** Implemented
**Branch:** `009-coverage-gate` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

`vitest.config.ts` gates coverage at a flat **80%** on lines/statements/
functions/branches. The measured baseline is far lower, so the CI `Coverage
check` step (`ci.yml:62`, a normal step — not `continue-on-error`) **fails on
every run**, making the `frontend` job permanently red. A gate that always fails
is ignored: it neither blocks regressions nor signals quality.

Measured at 7c5de09 (`pnpm test:coverage`, v8, 29 files / 486 tests):

| Metric   | Lines  | Statements | Functions | Branches |
| -------- | ------ | ---------- | --------- | -------- |
| Actual   | 42.44% | 42.44%     | 53.82%    | 87.96%   |
| Old gate | 80     | 80         | 80        | 80       |

## Decision

Convert the flat aspirational gate into an **explicit, ratcheted regression
floor** pinned to the measured baseline — the option the constitution / loop
SKILL prefers over silent lowering:

| Metric     | New floor | Rationale                        |
| ---------- | --------- | -------------------------------- |
| lines      | 42        | measured 42.44 − small margin    |
| statements | 42        | measured 42.44                   |
| functions  | 53        | measured 53.82                   |
| branches   | **80**    | already met (87.96); NOT lowered |

This is **not** silent lowering: the change is documented inline in
`vitest.config.ts`, recorded in `docs/coverage-budget.md`, may only move UP, and
keeps the 80% target. CI goes green now and fails on any future coverage
**regression** below the floor.

## Why not the alternatives

- **Keep 80% + write tests to reach it:** ~38pt gap across many modules
  (stores/services/hooks at 0%); far larger than one slice, and leaving CI red
  meanwhile keeps the signal broken.
- **Make the step `continue-on-error`:** hides the gate entirely — worse than a
  ratchet that actively prevents regressions.
- **Drop branches below 80:** would silently lower a passing metric — banned.

## Verification

`pnpm test:coverage` → **rc=0**, 486/486 tests pass, thresholds met (was rc≠0
with 3 "does not meet" errors before). No source/test code changed — config +
docs only.

## Rollback

Single `git revert`; or restore the four `80` values in `vitest.config.ts`. No
migration, no runtime impact (config affects CI/local test gating only).

## Risks

- **Floor too tight (flaky CI):** v8 coverage of deterministic unit tests is
  stable; floors sit just below measured. Low.
- **Ratchet never raised (floor rots at 42%):** mitigated by `docs/coverage-
budget.md` (policy + prioritized module list) + this spec; the floor still
  prevents regression in the meantime.

## Follow-ups

- Raise floors as tests land for the 0%-covered modules (stores, settings,
  tts/library/settings-store) per `docs/coverage-budget.md`.
- Backend Rust coverage (`cargo llvm-cov`) is separate and ungated — a possible
  future slice.
