# Tasks: Fleet Alignment Recovery

**Input**: Design documents from `/specs/079-fleet-alignment-recovery/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Executable acceptance is mandatory. Test/oracle tasks are fail-first and must retain bounded negative controls.

**Organization**: Tasks are grouped by user story. Foundry Orch sequences landings; Product proposes/classifies; each slice has one writer/worktree; QA and Control own independent executable gates.

## Phase 1: Setup — Preserve Before Reconciliation

**Purpose**: Make the recovery graph durable and install deterministic contract inputs before any remaining PR mutation.

- [x] T001 Verify the completed 23-ref preservation set under `origin/preserve/20260820-*` covers the 19 tips in `/tmp/lectrice-local-only-tips-20260820.tsv` plus 122/125/143 and deleted local 145, then record the correction input for `docs/alignment-recovery-branch-ledger.md`
- [x] T002 Enumerate **every local ref** dynamically, prove remote containment for each tip, then record tree equality only for 122/125, common-base combined-patch/range-diff equality (not whole-tree identity) for stale-base 143, other classifications/stale branches/dirty-worktree exclusions, and the #147/#152 merge-tree result in `docs/alignment-recovery-branch-ledger.md`
- [ ] T003 [P] Add the receipt data contract from `specs/079-fleet-alignment-recovery/contracts/recovery-receipt.md` as a dependency-free schema in `docs/alignment-recovery-receipt.schema.json`
- [ ] T004 [P] Create fail-first synthetic-repository fixtures for wrong parent, extra envelope path, missing prompt, open PR, failed journey, and stale state in `scripts/test-oracle-alignment-recovery.sh`

**Checkpoint**: Preservation is complete at T001, correcting the false three-tip report; no graph cleanup or #152 branch update is allowed until T002 proves the complete-ref inventory/classification.

---

## Phase 2: Foundational — Recovery Authority

**Purpose**: Create the machine gate and durable ownership state required by every story.

- [ ] T005 Implement distinguishable fail-closed checks for 079 artifacts, ten Pi prompts, Constitution hash, complete dispositions, seat goals, PR terminal state, state references, receipt schema, and the `A -> R` invariant in `scripts/oracle-alignment-recovery.sh`
- [ ] T006 Run `scripts/test-oracle-alignment-recovery.sh` and record each negative control's non-zero result plus the clean-fixture pass in `docs/alignment-recovery-branch-ledger.md`
- [ ] T007 Record #147's pre-079 merge (`511f70d` -> `6b3fa9e`), its later accepted oracle findings/no-revert decision, and #152's early refresh to `2c525f96` while still OPEN/UNSTABLE in `docs/agent-backlog-state.md`
- [ ] T008 Set and machine-verify role-specific durable goals for Product, Orch, QA, and Control, then record only their identifiers/status (not transcript prose) in `docs/alignment-recovery-branch-ledger.md`

**Checkpoint**: Recovery authority is executable. No model-authored PASS can mark done.

---

## Phase 3: User Story 1 — Complete the First-Reader Loop (Priority: P1) 🎯 MVP

**Goal**: Prove one packaged first-time reader can open, receive honest no-key setup, narrate after supported fixture setup, close with process termination, restart, and resume without position/highlight loss.

**Independent Test**: `TMPDIR=/tmp bash e2e/run-north-star-journey.sh` passes all nine ordered `NorthStarJourney` steps on one hermetic profile and exact source SHA.

### Fail-first tests for User Story 1

- [ ] T009 [US1] Add a composed packaged actor that uses only public reader controls and observer-only instrumentation in `e2e/north-star-journey.e2e.mjs`
- [ ] T010 [US1] Add negative controls for silent no-key state, Play not crossing the fixture boundary, lingering original process, wrong resumed page/document, and missing highlight in `e2e/north-star-journey.e2e.mjs`

### Implementation for User Story 1

- [ ] T011 [US1] Add the hermetic, lock-serialized, exact-SHA-reporting runner with fail-closed phase sequencing in `e2e/run-north-star-journey.sh`
- [ ] T012 [US1] Reuse existing open/native-play/close/home fixture setup without duplicating product state or allowing observer actions in `e2e/north-star-journey.e2e.mjs`
- [ ] T013 [US1] Prove the no-key setup branch and configured fixture Play branch in the same run, preserving intentional session-only key behavior, in `e2e/north-star-journey.e2e.mjs`

**Checkpoint**: The composed actor discriminates every north-star boundary. Its final exact-`A` run occurs at T023 in Phase 5 after all non-receipt changes land.

---

## Phase 4: User Story 2 — Choose Work by Reader Value (Priority: P2)

**Goal**: Reconcile the remaining queue from immutable evidence without promoting polish or losing unique topology.

**Independent Test**: The branch ledger contains exactly one valid category, owner, next action, falsifier, preservation state, and terminal state for every in-scope item; #152 remains unmerged and is judged on exact refreshed measurements.

- [x] T014 [US2] Repair the merged #147 contrast oracle in `e2e/contrast-sweep.e2e.mjs`: exercise active input value text and enabled shelf submit, and parse `color(srgb)`/`color-mix()` or fail closed instead of silently skipping; retain exact-head negative controls and do not revert token-correct CSS — `CI=true bash scripts/e2e-contrast-sweep.sh`: light/dark 85 painted states, 0 violations, 0 unparseable; embedded active-value/submit negative controls passed
- [x] T015 [US2] Verify early-refreshed #152 head `2c525f96` contains `6b3fa9e`, normally update again after 079 only if behind, and record exact head/base SHAs in `docs/alignment-recovery-branch-ledger.md`
- [ ] T016 [US2] Run `scripts/card-fold-verify.sh` on the refreshed exact #152 head and record all fold/uncropped seed-theme-width results in `docs/alignment-recovery-branch-ledger.md`
- [x] T017 [US2] Require green exact-head checks and independent review, then merge #152 or close it with the failed-harness reason; record terminal state and squash/closed head in `docs/alignment-recovery-branch-ledger.md`
- [x] T018 [US2] Re-evaluate audit gaps #2/#5/#6, spec 078 follow-ons, and credential-free Kokoro against the north star; preserve post-release classifications and falsifiers in `docs/agent-backlog-state.md`
- [x] T019 [US2] Validate any proposed north-star fix against every targeted-fix exemption field and record `eligible` or `requires-new-spec` with evidence in `docs/alignment-recovery-branch-ledger.md`

**Checkpoint**: No recovery PR remains open; duplicate content was not replayed; polish did not outrank a demonstrated north-star failure.

---

## Phase 5: User Story 3 — Recover Delivery Without Losing Work (Priority: P3)

**Goal**: Reconcile durable state, freeze accepted main `A`, land receipt-only child `R`, and let the oracle—not a seat—decide completion.

**Independent Test**: At `R`, `HEAD^` equals the receipt's `accepted_main_sha=A`, `A..R` equals the explicit receipt envelope, and both recovery/fleet oracles exit 0.

- [x] T020 [P] [US3] Update live open-PR, classifications, ownership, sequence-deviation, and next-priority state in `docs/agent-backlog-state.md` before freezing `A`
- [ ] T021 [P] [US3] Update `1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md` in a separate vault worktree/PR to cite current repository facts and accepted-main preparation
- [ ] T022 [US3] Merge all non-receipt Lectrice changes, freeze `A`, and record its full SHA as the candidate in `docs/alignment-recovery-branch-ledger.md`
- [ ] T023 [US3] Run `e2e/run-north-star-journey.sh`, required CI/Sonar/CodeQL checks, and independent exact-head review at `A`; record run/artifact identities in `docs/alignment-recovery-branch-ledger.md`
- [ ] T024 [US3] Generate schema-valid evidence with `accepted_main_sha=A`, exact checks/reviews/journey/dispositions/state refs, and a one-file envelope in `docs/alignment-recovery-receipt.json`
- [ ] T025 [US3] Land `docs/alignment-recovery-receipt.json` as receipt-only child `R` whose first parent is `A`, with no amend/self-SHA loop
- [ ] T026 [US3] Run `scripts/oracle-alignment-recovery.sh` and `scripts/test-oracle-alignment-recovery.sh` at `R`, proving `R^=A` and exact envelope equality
- [ ] T027 [US3] Run `fleet-intel verify lectrice-alignment-recovery` at `R` and move the board row through review/done only on exit 0

**Checkpoint**: Recovery is machine-accepted with no self-referential receipt and no open recovery PR.

---

## Phase 6: Cross-Cutting Validation

- [x] T028 Confirm no credential, private PDF content, live profile path, or model transcript entered `docs/alignment-recovery-receipt.json` or `docs/alignment-recovery-branch-ledger.md`
- [x] T029 Re-run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` and the 079 quickstart contract in `specs/079-fleet-alignment-recovery/quickstart.md`
- [x] T030 Confirm the Constitution hash is still `408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951` and exactly ten `speckit.*.md` files remain in `.pi/prompts/`
- [x] T031 Confirm the 079 landing diff contains only `.pi/`, `.specify/`, and `specs/079-fleet-alignment-recovery/` integration/planning paths by following `specs/079-fleet-alignment-recovery/quickstart.md`

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** preservation T001 completed during planning; after 079 merges, T002 turns the complete all-ref scan into the durable inventory that gates reconciliation.
- **Phase 2** depends on Phase 1 preservation. T003/T004 may be authored in parallel with graph preservation because they touch separate files, but T005 acceptance waits for the contract.
- **Phase 3** actor work may proceed after the foundational contract; heavy packaged runs are serialized.
- **Phase 4** depends on preservation and 079. #152 was refreshed early but stays unmerged; T014 → T015 → T016 → T017 is strictly sequential.
- **Phase 5** depends on #152 terminal and every non-receipt repository change. T020/T021 can use separate repositories/worktrees; T022 → T023 → T024 → T025 → T026 → T027 is strictly sequential.
- **Phase 6** is the final cross-cutting privacy/lifecycle validation.

### User story dependencies

- **US1** supplies the product acceptance actor but does not mutate product behavior.
- **US2** can classify/reconcile independently of US1 implementation, but its terminal state is required before the final US1 run at `A`.
- **US3** consumes US1 exact-`A` evidence and US2 terminal dispositions; it cannot begin the receipt phase early.

### Parallel opportunities

- T001/T002 versus T003/T004 use independent graph and control worktrees.
- T009/T010 can be authored together only if one writer owns their shared file; they are marked parallel by logical test case, but the one-file writer rule wins.
- T020 (Lectrice repo) and T021 (vault repo) use separate worktrees and can proceed in parallel.
- No two heavy packaged/CI runs execute concurrently on vm103.

---

## Requirement Coverage

| Requirements                 | Tasks                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| FR-001–FR-005; SC-001        | T009–T013, T023                                                                           |
| FR-006–FR-009; SC-002–SC-003 | T001–T002, T007, T014–T019                                                                |
| FR-010–FR-011; SC-004        | T005, T029–T030                                                                           |
| FR-012–FR-013; SC-007        | T007–T008, T020–T022, T027                                                                |
| FR-014–FR-015                | T019                                                                                      |
| FR-016                       | T001–T002, T007, T020–T024                                                                |
| FR-017                       | T031                                                                                      |
| FR-018; SC-006               | T003–T006, T022–T026                                                                      |
| SC-005                       | Spec Kit analysis before this task plan is accepted; T029 revalidates lifecycle artifacts |

## Implementation Strategy

1. **Contract first**: merge 079 only after analysis and independent review.
2. **Preserve before mutate**: make topology durable; do not replay duplicate content.
3. **Settle existing work**: refresh/re-measure #152, then terminalize it.
4. **Prove the user outcome**: run one composed exact-`A` journey.
5. **Receipt last**: `A -> R`, one enumerated receipt-only diff, deterministic oracle.

## Notes

- `[P]` means separate files/worktrees can proceed; it never authorizes two writers in one file or concurrent heavy runs.
- Every task retains normal repository merge ownership and genuinely gated surfaces.
- PR #147 is already merged out of order; these tasks record it and never create revert churn for sequence theater.
- A task touching product behavior after a failed journey must pass T019 or receive a new spec.
