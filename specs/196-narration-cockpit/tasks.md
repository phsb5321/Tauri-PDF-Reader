# Tasks: Narration cockpit and synchronized reader motion

## Phase 1 — Red-capable contracts

- [ ] T001 Add pure failing normalization tests for EN/PT-BR `2022`, `91,000`, decimals, percentages, currency, clock time, invalid grouping/version/ID rejection, UTF-16 partitions, and spoken-byte bounds.
- [ ] T002 Add the real page-19 geometry fixture and failing planner assertion that superscript `1 2 3 4 5` produces no narration run below 12 bytes while body numbers remain.
- [ ] T003 Add failing read-along motion tests for in-band no-op, above/below absolute target, clamp, coalescing, and reduced-motion invariance.
- [ ] T004 Add failing TtsWordHighlight race test: A schedules delayed repaint, cursor advances to B, delayed A runs, registry still contains exactly B.
- [ ] T005 Add failing render-ready continuation tests for exact page success, timeout-visible-error, Stop/manual-page/provider cancellation, and exactly-once start.
- [ ] T006 Add failing selection tests for outside endpoint and effective whole-page rejection plus legitimate multi-line excerpt/Read-from-here pass.
- [ ] T007 Add failing cockpit UI tests for four tabs, roving keyboard/Home/End, Escape focus return, active-panel-only mounting, and real Delivery/Selection controls.

## Phase 2 — Source-aligned speech correctness

- [ ] T008 Implement `speech-normalization.ts` pure number-to-words/replacement grammar with no dependency or ambient locale.
- [ ] T009 Refactor `prosody-plan.ts` to merge replace/insert/delete edits, accept normalization/language options, preserve exact source mapping, and bump planner revision.
- [ ] T010 Extend structured PDF source with segments and suppress only geometry-backed superscript numeric markers; make the page-19 oracle green.
- [ ] T011 Extend AI-TTS preference state/persistence to v4 with follow, number normalization, and narration language; migrate/sanitize without secrets.
- [ ] T012 Pass selected/explicit narration language and normalization preference through ReaderView/AiPlaybackBar into every page/selection plan.

## Phase 3 — Single cursor, scroll, and page authority

- [ ] T013 Implement pure read-along scroll and page-ready helpers with generation cancellation and bounded timeout.
- [ ] T014 Refactor `TtsWordHighlight` to one setup observer, tracked callbacks, delete-before-set singleton range, and range-driven coalesced follow scroll.
- [ ] T015 Mark PdfViewer render readiness only after canvas/text/annotation commit; reset page scroll and add reduced-motion-safe page/zoom visual transitions.
- [ ] T016 Replace the fixed 500 ms auto-page continuation with exact ready wait; surface `TTS_PAGE_NOT_READY` and clear stale queue/highlight on failure.
- [ ] T017 Enforce excerpt-only selection in PdfViewer and provide a public warning without breaking ordinary copy/highlight/Read from here.

## Phase 4 — Narration cockpit

- [ ] T018 Add `NarrationDeliverySettings` with speed, follow, auto-page, normalization/language, and Responsive/Balanced/Continuous controls; remove profile ownership from telemetry.
- [ ] T019 Add the accessible docked `NarrationCockpit` tabs and embedded Voice/Performance/Selection panels using existing controls.
- [ ] T020 Recompose AiPlaybackBar into transport / growing truthful status-progress / quick controls, remove the isolated modal, auto-page icon, broken scroll query, and duplicate CSS.
- [ ] T021 Add wide/narrow/reduced-motion geometry and design-token assertions at 1920/1440/767/640 widths.

## Phase 5 — User gate and delivery

- [ ] T022 Extend seeded fuzz actions/state assertions for follow, normalization/language, tab changes, page-ready cancellation, and selection limits; retain seed/replay.
- [ ] T023 Add deterministic two-page number/read-along fixture, `e2e/narration-cockpit.e2e.mjs`, and fail-closed `scripts/e2e-narration-cockpit.sh` with stale-receipt deletion.
- [ ] T024 Run targeted lint/typecheck/tests, bridge contracts, fuzz seed `20260828`/2,000, and packaged public-control journey; retain exact-head receipts and screenshots.
- [ ] T025 Run full `pnpm verify`, Gitleaks controls, alignment/harness, and the existing real Magpie packaged journey to catch playback/provider regressions.
- [ ] T026 Obtain a capable different-family exact-head review; repair every BLOCKER/MAJOR and rerun affected executable gates.
- [ ] T027 Update issue #196, #195, fleet row, `docs/agent-backlog-state.md`, and durable save-state with exact evidence and reversal path.
- [ ] T028 Push a draft stacked PR; merge only when CI, review, parent-chain, and safe-class rules permit. Confirm final remote state rather than asserting delivery.
