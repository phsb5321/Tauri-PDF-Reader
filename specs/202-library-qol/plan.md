# Plan 202 — Library QoL affordance slice

Branch `202-library-qol` off `origin/177-library-completeness` @ 951c342.
Generator: GLM-5.3-Flash (bounded recovery); validators deterministic; exact-head
Codex Sol independent review after freeze. No merge authority.

## Technical Context

- **Stack**: React 18 + Zustand 5 + Vitest/jsdom for control-state tests; CSS
  source-contract tests follow the repo's established file-regex pattern
  (`library-legibility.test.ts`); packaged lane is tauri-driver + WebKitGTK
  under Xvfb with software rendering (vimeflow#65 pins: `GDK_BACKEND=x11`,
  `WEBKIT_DISABLE_COMPOSITING_MODE=1`), reusing `scripts/e2e-profile.sh` +
  `scripts/e2e-toolchain.sh` helpers.
- **Test seam**: the shared bootstrap seeds fixed fixtures (5pg @ 20%, 3pg @
  33%) with no public way to reach a 0% in-flight book. Coordinator granted ONE
  narrowly named additive seed lane (`zero-progress`: 250-page fixture at page 2) in `src/e2e-native-bootstrap.ts`; every existing seed lane preserved.
- **Resource constraints**: serial heavy work under flock
  `/tmp/lectrice-heavy-gate.lock` with bounded wait; one Vitest worker;
  `cargo -j1` unavailable here (build is the packaged lane's own); cold Rust
  build observed timing out at 900s for the #200 seat, so the runner bounds and
  reports the build step separately from the journey verdict.
- **Authority**: Flash generator writes code/tests/evidence only; done-state
  and merge stay with the coordinator/delivery; exact-head Codex Sol review
  gates the frozen diff.

## Sequence (speckit-make, no stale pinned runtime)

1. **Spec** — `spec.md` (done, branch-bound).
2. **Executable acceptance first** — write the RED tests before product code:
   - `src/__tests__/ui/library-202-affordances.test.tsx` (new, uniquely named):
     control-state (visible label, accessible names, 0% modifier) + CSS source
     contract (wrap / hollow track / nub / pinned shelf form). Every assertion
     fails against the current tree — capture first-red output.
   - Mechanical name-shape updates queued for the same commit as the component
     change (`ResumeSection.test.tsx`, `resume-and-play.test.tsx`) — they go
     RED only together with FR-1, by design.
3. **Smallest implementation**
   - `ResumeSection.tsx`: `IconButton`→labeled `Button` (both spots); `isEmpty`
     modifier on the track.
   - `ResumeSection.css`: actions wrap; track hollow ring; `--empty::before`
     nub bound to tokens.
   - `ShelfSidebar.css`: list becomes the scroll container; sidebar overflow
     hidden.
   - `e2e-native-bootstrap.ts`: additive `zero-progress` seed lane only.
4. **Targeted verification** (resource-conscious, serial, one Vitest worker):
   `pnpm lint` → `pnpm typecheck` → targeted vitest files → `pnpm test:fuzz`.
5. **Packaged user gate** (heavy: flock `/tmp/lectrice-heavy-gate.lock`,
   bounded wait; Xvfb 3200×1400 for the 2560 width):
   `e2e/run-202-library-journey.sh` builds the packaged debug binary once and
   runs `library-202-journey.e2e.mjs` in two lanes:
   - no-key + `zero-progress` seed: visible/clickable "Read aloud" at
     640/1200/2560, no horizontal overflow, click → stored page 2, no page
     turn, stays idle, setup signal present, 0% empty-track state observed.
   - key + `zero-progress` seed: same control reaches `playing` (fixture TTS).
   - shelf pinning probe: public form creates 12 shelves at a short window;
     form stays in viewport while the list scrolls.
6. **Evidence + report** — `docs/evidence/202-library-qol-20260908/` (first-red
   capture, fuzz seed/replay, journey results, build identity) and run-root
   `reports/library.md`.
7. **Freeze + independent gate** — push branch; draft PR stacked on
   `177-library-completeness`; send exact head/diff/gates to `tauri-pdf-eng`
   for Codex Sol review (never self-judged done). Keep draft until parent
   delivery clears.

## Verification mapping

| Contract           | Deterministic check                                              |
| ------------------ | ---------------------------------------------------------------- |
| FR-1 visible label | jsdom: button contains text "Read aloud"; role+name queries      |
| FR-1 name shape    | jsdom: `Resume {label} and read aloud`; integration name updates |
| FR-2 0% state      | jsdom: `resume-line-bar--empty` at percent 0 only; CSS contract  |
| FR-2 hollow track  | CSS contract: transparent bg + inset ring token                  |
| FR-3 wrap/overflow | CSS contract + packaged scrollWidth probe at 3 widths            |
| FR-4 pinned form   | CSS contract + packaged visibility probe with scrolled list      |
| FR-5 seed lane     | packaged journey renders "Page 2 of 250" + "0%" (additive lane)  |

## Repair budget

Two repair rounds max, then report the precise blocker (common.md hard cap).
Missing driver/display/lock-timeout ⇒ BLOCKED, never a pass.
