# Coverage Budget

Lectrice gates frontend coverage in CI (`pnpm test:coverage`, ci.yml). This file
records the policy and the ratchet plan.

## Policy

- Thresholds in `vitest.config.ts` are a **regression floor**, not an aspiration.
- The floor may only move **UP**. Never lower it silently to make CI green —
  that destroys the signal. Lowering requires an explicit, reviewed reason here.
- When you add tests that raise a metric, raise its floor to the new measured
  value in the same PR (ratchet up). Small steps are fine.

## Baseline (009-coverage-gate, 2026-05-30, commit base 7c5de09)

Measured via `pnpm test:coverage` (v8 provider):

| Metric     | Measured | Floor (CI gate)  | Target |
| ---------- | -------- | ---------------- | ------ |
| Lines      | 42.44%   | 42               | 80     |
| Statements | 42.44%   | 42               | 80     |
| Functions  | 53.82%   | 53               | 80     |
| Branches   | 87.96%   | 80 (already met) | 80     |

Before this change the gate was a flat 80% on all four, so the `frontend` CI job
**failed on every run** — the coverage check was effectively ignored.

## How to ratchet up

The lowest-covered, highest-value areas to test first (from the v8 report):
stores (`src/stores/*`), services (`src/services/*`), hooks (`src/hooks/*`), and
adapters — these hold orchestration logic and currently drag lines/statements down.
Pure domain modules (`src/domain/*`) are already well covered.

Workflow:

1. `pnpm test:coverage` → read `coverage/lcov-report/index.html` for per-file gaps.
2. Add targeted tests for the lowest-coverage modules with real logic.
3. Re-measure; raise the floors in `vitest.config.ts` to the new numbers.
4. Repeat until all four reach 80, then restore the flat 80% gate.

## Note

Backend (Rust) coverage is separate (`cargo llvm-cov`, not gated here).
