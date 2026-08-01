# Coverage Budget

Lectrice gates frontend coverage in CI (`pnpm test:coverage`, ci.yml). This file
records the policy and the ratchet plan.

## Policy

- Thresholds in `vitest.config.ts` are a **regression floor**, not an aspiration.
- The floor may only move **UP**. Never lower it silently to make CI green —
  that destroys the signal. Lowering requires an explicit, reviewed reason here.
- When you add tests that raise a metric, raise its floor to the new measured
  value in the same PR (ratchet up). Small steps are fine.

## Current floor (062-db-bootstrap, 2026-08-01)

Measured via
`pnpm exec vitest run --coverage --maxWorkers=1 --minWorkers=1`
(v8 provider), 848 tests:

| Metric     | Measured | Floor (CI gate) | Target   |
| ---------- | -------- | --------------- | -------- |
| Lines      | 62.33%   | 62              | 80       |
| Statements | 62.33%   | 62              | 80       |
| Functions  | 67.55%   | 67              | 80       |
| Branches   | 90.90%   | 90              | 80 (met) |

Two things are in this step, and only one of them is 062's. The measured part
that this slice earned is `src/lib/db-init.ts`: 73.72% → **99.27%** statements
and 100% functions, from five tests over `initDatabase`, the bootstrap wrapper
`main.tsx` calls before React mounts. The rest of the movement since 052 was
already sitting on `main` — #59, #60 and #61 added tests without ratcheting, so
the floor had drifted roughly five points below the real number and stopped
being a regression gate in that band. Re-measure before assuming a jump this
size is yours.

The one uncovered line left in `db-init.ts` (353) is the "schema already up to
date" arm of a `console.log` ternary. The behaviour underneath it — a fully
migrated database applying nothing — is asserted in `initSchema`'s own tests; a
test written to colour that line would assert a log string and nothing else.

Floors sit at the integer below the measured value so deterministic runs retain
a small margin. The measurement is worker-count independent: the same commit
reports 62.33 with default workers and with `--maxWorkers=1`, so the flag in the
recipe above is for reproducibility, not correctness.

## History

### 052-sonar-gate (2026-07-30)

| Metric     | Measured | Floor (CI gate) | Target   |
| ---------- | -------- | --------------- | -------- |
| Lines      | 57.52%   | 57              | 80       |
| Statements | 57.52%   | 57              | 80       |
| Functions  | 60.32%   | 60              | 80       |
| Branches   | 89.97%   | 89              | 80 (met) |

The 052 accessibility and interaction tests raised lines/statements by more
than ten points and branches by one point.

### 019-coverage-ratchet (2026-05-31, commit base 8c366d7)

| Metric     | Measured | Floor (CI gate) | Target   |
| ---------- | -------- | --------------- | -------- |
| Lines      | 46.91%   | 46              | 80       |
| Statements | 46.91%   | 46              | 80       |
| Functions  | 59.58%   | 59              | 80       |
| Branches   | 88.72%   | 88              | 80 (met) |

Ratcheted up from the 009 floors below (42/53/80/42) after the merged store
tests raised lines/statements ~42→47, functions ~54→60, and branches ~88→89.

### 009-coverage-gate (2026-05-30, commit base 7c5de09)

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
