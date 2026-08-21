# Tasks: Goal and Spec Kit Enforcement

**Input**: `specs/080-goal-speckit-enforcement/spec.md`, `plan.md`

## Phase 1 — Executable policy

- [x] T001 Implement committed+working change discovery and branch-bound chain validation in `tools/harness-policy.sh`.
- [x] T002 Add Pi-seat goal validation without affecting ordinary human shells in `tools/harness-policy.sh`.
- [x] T003 Add reject/reject/allow coverage in `tools/test/harness-policy-negative-control.sh`.

## Phase 2 — Thin entry points

- [x] T004 Add `harness-check`, `harness-staged`, `harness-status`, and `goal-set` targets in `Makefile`.
- [x] T005 Expose Make targets through `package.json`.
- [x] T006 Invoke the policy before expensive checks in `.husky/pre-commit` and `scripts/verify.sh`.
- [x] T007 Compose the policy into `tools/alignment-gate.sh` so the existing required PR check enforces it without a workflow change.

## Phase 3 — Verification and delivery

- [x] T008 Run shell syntax, negative-control, Make, package, TypeScript, and alignment checks.
- [ ] T009 Obtain different-family exact-head review and resolve every finding.
- [ ] T010 Push, pass required checks, squash-merge, and verify the command from merged `main`.
