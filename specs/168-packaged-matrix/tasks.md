# Tasks: Packaged Matrix Reliability

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

## Phase 1 — Fail-first contract

- [x] T001 Extend `src/__tests__/integration/e2e-toolchain-contract.test.ts` to reject private lane package lists, undeclared SQLite, and process observers not using the shared app identity.
- [x] T002 Extend `src/__tests__/integration/wdio-app-path-contract.test.ts` to pin the shared observer identity.

## Phase 2 — Shared root fix

- [x] T003 Export one Cargo-derived app path from `scripts/e2e-toolchain.sh` and consume it in WebdriverIO and process observers.
- [x] T004 Route `e2e/run-highlight-journey.sh` through the shared toolchain.
- [x] T005 Declare SQLite in `flake.nix` for observer queries.
- [x] T006 Make `scripts/e2e-profile.sh` create profiles under the cross-shell Linux temp root.

## Phase 3 — Verification and delivery

- [x] T007 Run syntax checks, targeted contracts, and tool-availability probes.
- [x] T008 Run packaged highlight and reader journeys.
- [x] T009 Replay the close journey, retain timing failures, and obtain one complete four-phase pass.
- [x] T010 Obtain a different-family exact-head review and resolve findings — Anthropic-over-OpenAI ALLOW at `b048acb0d20a1b1074b87fe7668e30dcbf69a1a4` after DeepSeek Pro exited 143 without output.
- [x] T011 Push, pass required checks plus the full packaged matrix, squash-merge, and verify merged `main` — PR #168 merged as `c7cda43db6847bb31642a9b39bb9a1ebf7ec9e88`; exact-head full-matrix job `97108248709` passed all eight lanes.
