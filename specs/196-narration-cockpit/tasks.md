# Tasks: Narration cockpit and synchronized reader motion

## Phase 1 — Red-capable contracts

- [x] T001 Add pure failing normalization tests for EN/PT-BR `2022`, `91,000`, decimals, percentages, currency, clock time, invalid grouping/version/ID rejection, UTF-16 partitions, and spoken-byte bounds.
- [x] T002 Add the real page-19 geometry fixture and failing planner assertion that superscript `1 2 3 4 5` produces no narration run below 12 bytes while body numbers remain.
- [x] T003 Add failing read-along motion tests for in-band no-op, above/below absolute target, clamp, coalescing, and reduced-motion invariance.
- [x] T004 Add failing TtsWordHighlight race test: A schedules delayed repaint, cursor advances to B, delayed A runs, registry still contains exactly B.
- [x] T005 Add failing render-ready continuation tests for exact page success, timeout-visible-error, Stop/manual-page/provider cancellation, and exactly-once start.
- [x] T006 Add failing selection tests for outside endpoint and effective whole-page rejection plus legitimate multi-line excerpt/Read-from-here pass.
- [x] T007 Add failing cockpit UI tests for four tabs, roving keyboard/Home/End, Escape focus return, active-panel-only mounting, and real Delivery/Selection controls.

## Phase 2 — Source-aligned speech correctness

- [x] T008 Implement `speech-normalization.ts` pure number-to-words/replacement grammar with no dependency or ambient locale.
- [x] T009 Refactor `prosody-plan.ts` to merge replace/insert/delete edits, accept normalization/language options, preserve exact source mapping, and bump planner revision.
- [x] T010 Extend structured PDF source with segments and suppress only geometry-backed superscript numeric markers; make the page-19 oracle green.
- [x] T011 Extend safe preference persistence to v4 with number normalization and narration language; retain follow read-along in its existing canonical persisted settings store and sanitize without secrets.
- [x] T012 Pass selected/explicit narration language and normalization preference through ReaderView/AiPlaybackBar into every page/selection plan.

## Phase 3 — Single cursor, scroll, and page authority

- [x] T013 Implement pure read-along scroll and page-ready helpers with generation cancellation and bounded timeout.
- [x] T014 Refactor `TtsWordHighlight` to one setup observer, tracked callbacks, delete-before-set singleton range, and range-driven coalesced follow scroll.
- [x] T015 Complete real PDF zoom after 30/08 user falsification: one exact label, startup settings hydration, hard 8192 px canvas side, exact committed page/zoom readiness, pointer/centre anchor restoration, safe oversized-page centring, and no stale overlay geometry.
- [x] T016 Replace the fixed 500 ms auto-page continuation with exact ready wait; surface `TTS_PAGE_NOT_READY` and clear stale queue/highlight on failure.
- [x] T017 Finish excerpt-only selection and structural paragraph actions with a pure first-line layout, non-overlapping 44 px targets, paper-safe tick/chip styling, individual hover/focus, visible outline, and exact source offsets at 100–400% zoom.

## Phase 4 — Narration cockpit

- [x] T018 Add `NarrationDeliverySettings` with speed, follow, auto-page, normalization/language, and Responsive/Balanced/Continuous controls; remove profile ownership from telemetry.
- [x] T019 Add the accessible docked `NarrationCockpit` tabs and embedded Voice/Performance/Selection panels using existing controls.
- [x] T020 Recompose AiPlaybackBar into transport / growing truthful status-progress / quick controls, remove the isolated modal, auto-page icon, broken scroll query, and duplicate CSS.
- [x] T021 Add wide/narrow/reduced-motion and 100/200/280/330/400% geometry assertions: one selected zoom label, canvas/page/text ratios, ≤8192 backing sides, anchor retention, reachable edges, paragraph/text non-intersection, focus outline, and paper-token contrast.

## Phase 5 — User gate and delivery

- [x] T022 Extend seeded fuzz actions/state assertions for follow, normalization/language, tab changes, page-ready cancellation, and selection limits; retain seed/replay.
- [x] T023 Extend the deterministic prosody fixture and reused fail-closed local-TTS packaged lane to prove all tabs, selection replacement, professional paragraph action, real committed zoom/anchor/overflow, immediate page-two Play, and Stop (no duplicate runner/spec).
- [x] T024 Run targeted lint/typecheck/tests, bridge contracts, fuzz seed `20260830`/2,000, and packaged public-control journeys; retain exact-head receipts and screenshots.
- [x] T025 Re-run full `pnpm verify`, Gitleaks controls, alignment/harness, and the existing real Magpie packaged journey on the repaired exact head.
- [x] T026 Obtain a capable different-family exact-head review; repair every BLOCKER/MAJOR and rerun affected executable gates.
- [x] T027 Update issue #196, #195, fleet rows, `docs/agent-backlog-state.md`, and durable save-state with exact evidence/reversal; retry Plane once and retain a fail-closed zero-mutation receipt while VM105/server is offline.
- [x] T028 Push draft stacked PR #200 and confirm the remote head; retain draft state while the #194 → #193 → #178 → Pedro-gated #181 parent chain blocks delivery.
- [ ] T029 Replay the stable Plane LECT parent/child identities idempotently after VM105/server recovers; do not infer tracker completion from source evidence.
