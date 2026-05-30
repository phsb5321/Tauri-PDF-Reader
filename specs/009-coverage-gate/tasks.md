# Tasks 009 — Coverage Gate

- [x] T001 Worktree `009-coverage-gate` off origin/main (7c5de09).
- [x] T002 Measure real baseline: `pnpm test:coverage` -> lines/stmts 42.44, functions 53.82, branches 87.96 (29 files / 486 tests).
- [x] T003 Inspect gate wiring: `vitest.config.ts` (flat 80); CI `ci.yml:62` runs `test:coverage` as a hard step; `verify.sh` uses `test:run` (no local coverage gate).
- [x] T004 Ratchet `vitest.config.ts` thresholds to floors (lines 42, statements 42, functions 53, branches 80) + inline rationale.
- [x] T005 Add `docs/coverage-budget.md` (policy: ratchet up only; baseline; prioritized modules; how-to).
- [x] T006 Spec `specs/009-coverage-gate/{spec,tasks,checklist}.md`.
- [x] T007 Verify: `pnpm test:coverage` rc=0, 486 passed, 0 threshold errors.
- [ ] T008 Codex adversarial review -> `.claude/reviews/009-*`.
- [ ] T009 Update `docs/agent-backlog-state.md`.
- [ ] T010 Commit on `009-coverage-gate` (no push without authorization).
