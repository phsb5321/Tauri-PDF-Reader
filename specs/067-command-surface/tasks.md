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

## Phase 4: verification gate

- [x] **T010** `pnpm exec vitest run src/hooks/useCommandKeys.test.ts
src/hooks/useMenuActions.test.ts` — both green.
- [x] **T011** `pnpm typecheck` and `pnpm lint` (boundaries included) — clean.
      Strict mode's `noUnusedLocals` is what catches a half-finished deletion.
- [x] **T012** `./tools/alignment-gate.sh --changes --base origin/main` —
      0 errors, with the scanned count read rather than assumed.

## Dependencies

T001 → T002 → T003 → T004 → T005. T006/T007 need T003. T008 needs T005 (the
replacement must be mounted before the dead file goes). T009 needs T008. Phase 4
needs everything.

## Out of scope, stated so it is not mistaken for an oversight

- The four menu items with no destination (settings, library, highlights, find)
  stay inert. Fixing them means building the panels.
- `Escape` and `Ctrl+Shift+H` stay with their components.
- No `src-tauri` change, no IPC change, no workflow change.
