# Tasks: One command surface, two ways in

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Branch**: `067-command-surface`

Tests are written with the code they cover, not as a separate phase — every task
below that adds behaviour names the assertion that proves it, and the task is
not done until that assertion runs and passes.

## Phase 1: US1 — the advertised keys do what they say (P1)

- [x] **T001** Add `src/hooks/useCommandKeys.ts` with the `Chord` type,
      `COMMAND_CHORDS` (3 commands, 5 chords), and `resolveChord(event)` as a pure
      function. No React yet.
      → _Proves_: nothing on its own. T002 is where it earns its place.

- [x] **T002** Add `src/hooks/useCommandKeys.test.ts` covering `resolveChord`:
      each chord resolves to its action id; a chord with the wrong modifier state
      resolves to `null`; an unmodified chord inside `input` / `textarea` /
      `contenteditable` resolves to `null` while `Ctrl+O` still resolves there;
      `Ctrl+Shift+H` and `Escape` resolve to `null` (they belong to components).
      → _Proves_: spec AS-4, and the edge cases "typing" and "a key already owned by
      a component".

- [x] **T003** Add the `useCommandKeys(handlers)` hook to the same file: one
      window `keydown` listener, handlers behind a ref, `preventDefault()` then
      `dispatchMenuAction`.
      → _Proves_: with T004, spec AS-1/2/3/5.

- [x] **T004** Extend the test file: render the hook with `renderHook`, dispatch
      real `KeyboardEvent`s at `window`, assert the matching handler fired exactly
      once and unmatched keys fired nothing; assert the listener is removed on
      unmount; assert a handler swapped between renders is the one that runs (no
      stale closure).
      → _Proves_: the hook actually binds, and keeps binding the current handlers.

- [x] **T005** Edit `src/components/reader/ReaderView.tsx`: hoist the inline
      handlers object into `const commandHandlers`, pass it to `useMenuActions` and
      to `useCommandKeys`.
      → _Proves_: FR-001 structurally — one object, two dispatchers. Asserted in
      T007.

## Phase 2: US2 — a command is defined once (P2)

- [x] **T006** Extend the test file with a registry-consistency test: every
      `action` in `COMMAND_CHORDS` is a member of the `MenuAction` union (compile
      time via `satisfies`, runtime via the dispatch table), and every chorded
      action dispatches through `dispatchMenuAction` to the same handler the menu
      path would reach.
      → _Proves_: spec AS-US2-1 and SC-002.

- [x] **T007** In the same test, assert the two dispatchers share handler
      references: build one handlers object, drive it once through
      `dispatchMenuAction(action, handlers)` and once through a dispatched key
      event, and assert the _same_ mock is the one called both times.
      → _Proves_: FR-001 as an assertion rather than a claim about the call site.

## Phase 3: US3 — the shortcut list tells the truth (P3)

- [x] **T008** Delete `src/hooks/useKeyboardShortcuts.ts` (229 lines, no call
      site, no importer of `KEYBOARD_SHORTCUTS`). Update the three comments that
      name it: `useOpenPdf.ts:7`,
      `HighlightCreationHandler.tsx:17` and `:52`.
      → _Proves_: FR-007, SC-004. The advertised-but-unbound list is gone because
      the only list is now the bound one.

- [x] **T009** Update the "Keyboard Shortcuts" section of `CLAUDE.md` to the
      chords that are actually bound, and drop the "declared but inert" list it
      currently carries.
      → _Proves_: SC-001 for the documentation half — the file that told a reader
      `Ctrl+O` exists now matches the code.

## Phase 4: one key, one owner — the defect the adversarial pass surfaced

The review round on this branch reported that deleting `useKeyboardShortcuts`
removed working shortcuts. It did not — that file had no call site. But checking
the claim turned up a listener neither the spec nor the review had accounted
for, and that one _was_ live.

- [x] **T013** Remove the page-key cases (`ArrowLeft`/`ArrowRight`/`PageUp`/
      `PageDown`/`Space`) from `PdfViewer.tsx`'s `window` `keydown` listener, and
      drop `currentPage` from its dependency array. Keep `Home`/`End` with the
      reason inline.
      → _Proves_: FR-008 for the one overlap that existed. Two listeners no longer
      answer `PageDown`.

- [x] **T014** Add `{ action: "next-page", key: " " }` to `COMMAND_CHORDS`,
      preserving the live `Space` → next-page binding `PdfViewer` owned, now with
      the stop-playback guard and the full typing-suppression rule.
      → _Proves_: no behaviour is lost to T013. Asserted in the resolver tests.

- [x] **T015** Read `currentPage` and `playbackState` from the store inside
      `goToPageBy`/`handleMenuPlayPause` instead of capturing them per render.
      → _Proves_: a held navigation key advances once per press rather than once
      per re-render.

- [x] **T016** Make `resolveChord` return `null` for an already-prevented event,
      and assert it: an element-level `onKeyDown` (`useRovingTabindex`) runs
      first, so the flag is the signal that a narrower binding already answered.
      → _Proves_: FR-005's second clause, which was previously only a comment.

- [x] **T017** Add `src/__tests__/architecture/global-key-listeners.test.ts`:
      scan production source for global `keydown` registrations, fail on any file
      with no declared reason, fail on a stale declaration, and fail if the scan
      matches nothing.
      → _Proves_: FR-008 in general, and SC-004. It found `HighlightToolbar` and
      the unmounted `PlaybackBar` on its first run.

## Phase 5: the ordering bug round 2 found

Round 2 of the adversarial pass was told what round 1 had covered and pointed at
the surfaces round 1 never read. It landed one real MAJOR: `goToPageBy` read the
page _before_ awaiting `aiTtsStop()`, so the comment claiming it had fixed the
stale-read bug was false for exactly the window the guard opens.

- [x] **T018** Move page navigation out of `ReaderView` into
      `src/hooks/usePageNavigation.ts`, reading the page **after** the stop
      completes. The extraction is not tidying: a function in a component body
      has no seam to assert the ordering through, which is why the bug survived
      T015.
      → _Proves_: nothing alone. T019 is the assertion.

- [x] **T019** Add `src/hooks/usePageNavigation.test.ts`, including "advances
      once per call when repeats arrive during the stop": hold `aiTtsStop`
      unresolved, start two navigations, release, assert the page moved by two.
      → _Proves_: the ordering. **Falsified before acceptance** — re-introducing
      the read-before-await made exactly this test fail with `expected 6 to be 7`
      while the other eight passed, so it is specific to the defect rather than
      a tautology.

- [x] **T020** Record the textual-scan ceiling on `GLOBAL_KEYDOWN` in the
      architecture test: a match inside a comment counts, an aliased `window`
      does not. Both fail in the safe direction; the upgrade path (TypeScript
      compiler API, already a dependency) is named rather than taken.
      → _Proves_: nothing. It stops the next reader mistaking a known limit for
      an oversight.

## Phase 6: verification gate

- [x] **T010** `pnpm exec vitest run src/hooks/useCommandKeys.test.ts
src/hooks/useMenuActions.test.ts src/__tests__/architecture/` — green.
- [x] **T011** `pnpm typecheck` and `pnpm lint` (boundaries included) — clean.
      Strict mode's `noUnusedLocals` is what catches a half-finished deletion.
- [x] **T012** `./tools/alignment-gate.sh --changes --base origin/main` —
      0 errors, with the scanned count read rather than assumed.

## Dependencies

T001 → T002 → T003 → T004 → T005. T006/T007 need T003. T008 needs T005 (the
replacement must be mounted before the dead file goes). T009 needs T008.
T013 needs T014 (the replacement binding must exist before the old one goes).
T017 is independent and was written last, which is why it caught what the
hand audit did not. T018 → T019. Phase 6 needs everything.

## Out of scope, stated so it is not mistaken for an oversight

- The four menu items with no destination (settings, library, highlights, find)
  stay inert. Fixing them means building the panels.
- `Escape` and `Ctrl+Shift+H` stay with their components.
- `Home`/`End` stay in `PdfViewer`: no `MenuAction` id exists for first/last
  page, and adding one the backend never emits would be a dead registry entry.
- **The dead `PlaybackBar` subtree.** `components/playback-bar/PlaybackBar.tsx`
  is the pre-ElevenLabs playback bar. It binds `Ctrl+Space` and `Escape` exactly
  as `AiPlaybackBar` does and is reachable only through
  `components/playback-bar/index.ts`, which nothing imports — the same defect as
  the deleted `useKeyboardShortcuts`. It is not deleted here because the dead
  subtree is eight files (`PlaybackBar`, `VoiceSelector`, `SpeedSlider`,
  `ChunkNavigation` and their CSS) plus four barrel lines, and that is a
  different change with a different reason to revert. It is declared as dead in
  the listener test rather than allowlisted as an owner, so the debt is visible
  in code and the entry cannot outlive the file.
- No `src-tauri` change, no IPC change, no workflow change.
