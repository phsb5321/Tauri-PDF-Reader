# Tasks 202 — Library QoL affordance slice

## A. Executable acceptance first (RED)

- [x] T001. Branch-bound spec chain (`spec.md` / `plan.md` / `tasks.md`) satisfying the harness policy.
- [x] T002. New `src/__tests__/ui/library-202-affordances.test.tsx`: control-state + CSS-contract suite, all RED on the current tree; capture first-red output to evidence.
- [x] T003. Stage mechanical accessible-name updates (`and start reading aloud` → `and read aloud`) for `ResumeSection.test.tsx` + `resume-and-play.test.tsx` — applied in the same commit as the component change (they gate on FR-1 by design).

## B. Smallest implementation (GREEN)

- [x] T004. `ResumeSection.tsx`: labeled read-aloud `Button` in `ResumeLine` + `AlsoInProgress`; `resume-line-bar--empty` modifier at percent 0.
- [x] T005. `ResumeSection.css`: `flex-wrap` on actions; hollow track (transparent bg + inset `--color-border` ring); `--empty::before` accent nub.
- [x] T006. `ShelfSidebar.css`: `.shelf-list` becomes the scroll container (flex:1, min-height:0, overflow-y:auto); sidebar `overflow:hidden` — form pinned.
- [x] T007. `e2e-native-bootstrap.ts`: additive `zero-progress` seed lane (500-page fixture @ page 2 → 0%, stamped most-recent); existing lanes byte-identical. (Lands only AFTER the packaged RED run proves the tripwire.)

## C. Targeted verification (serial, one Vitest worker)

- [x] T008. `pnpm lint`
- [x] T009. `pnpm typecheck`
- [x] T010. Targeted vitest: `library-202-affordances`, `ResumeSection.test`, `resume-and-play.test` (all green; no lowered assertion)
- [x] T011. `pnpm test:fuzz` (record seed + replay command)

## D. Packaged user gate (heavy, flock /tmp/lectrice-heavy-gate.lock, bounded)

- [x] T012. Runner `e2e/run-202-library-journey.sh` (three lanes no-key/key/zero; Xvfb 3200×1400; zero fixture from unique gen script; frontend build on pinned devShell pnpm; cargo build bounded 1500s + reported separately; head+binary identity echoed per lane).
- [ ] T013. Journey `e2e/library-202-journey.e2e.mjs`: public-control actor; 640/1200/2560 overflow probes; labeled-control click → stored page, no page turn; no-key idle + setup signal; key lane `playing`; 0% empty-track probe; shelf-form pinned probe.
- [ ] T014. Run under the shared lock (bounded wait); record build identity + results; BLOCKED (not skip) if the lock/display/driver is unavailable.

## E. Evidence + delivery

- [ ] T015. Early checkpoint in run-root `reports/library.md` (commands + exit statuses) — written before the heavy gate, updated after.
- [ ] T016. `docs/evidence/202-library-qol-20260908/`: first-red capture, fuzz seed/replay, journey outputs, widths matrix.
- [ ] T017. Commit (branch `202-library-qol`), push, draft PR base `177-library-completeness`.
- [ ] T018. fleet-intel attempt recorded on `lectrice-library-legibility-drag-session`.
- [ ] T019. Review packet (exact head, diff range, gate receipts) → `tauri-pdf-eng` for the Codex Sol independent gate; QA seat covers the frozen diff. Keep draft; no merge authority.
