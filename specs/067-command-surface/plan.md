# Implementation Plan: One command surface, two ways in

**Branch**: `067-command-surface` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/067-command-surface/spec.md`

## Summary

The native menu already has a command registry: `MenuActionHandlers` (eight
optional handlers keyed by the action ids `src-tauri` emits) plus
`dispatchMenuAction`, a pure id → handler lookup. It is mounted once at
`ReaderView.tsx:60`.

The keyboard gets a second dispatcher into that same registry — a pure
chord → action-id resolver and a window listener that hands the result to
`dispatchMenuAction`. The handlers object is passed to both hooks at the same
call site, so "the menu and the keyboard run the same code" is structural, not a
convention someone has to maintain.

`src/hooks/useKeyboardShortcuts.ts` is deleted. It is a parallel implementation
of the same commands — its own file dialog wiring, its own store writes, its own
copy of the shortcut list — with no call site and no importers of anything it
exports. Its own docstring in `useOpenPdf.ts:7` describes it as one of three
copies of the open-document flow.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict; `noUnusedLocals`,
`noUnusedParameters`)
**Primary Dependencies**: React 18.3, Zustand 5 — no new dependency
**Storage**: N/A (no persisted state added)
**Testing**: Vitest + jsdom, single-run (`pnpm exec vitest run <file>`)
**Target Platform**: Tauri 2.x desktop; the native menu path is Linux/AT-SPI but
the keyboard path is platform-independent
**Project Type**: single (React frontend + Rust backend; this change is frontend
only)
**Performance Goals**: one window-level `keydown` listener for the app's
lifetime, matching the one `menu-action` subscription that already exists
**Constraints**: no new Tauri command, no IPC change, no `.github/workflows`
change, no `src-tauri` change at all
**Scale/Scope**: 8 command ids, 3 of which get a chord; 2 files added, 1 file
deleted, 1 call site edited

## Constitution Check

Checked against the amended constitution (v2.0.0) landing in PR #66. This branch
was cut from `565fe1a`, which predates it, so it rebases onto the amended
document before merge. Each principle below is checked against the amended text.

| Principle                                            | Status           | Evidence                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Hexagonal boundaries                              | PASS             | UI layer only. Hooks call existing services (`useOpenPdf`) and existing IPC wrappers (`aiTtsPause`/`aiTtsResume`/`aiTtsStop` via `lib/tauri-invoke`). No new adapter, no domain change, no port. `pnpm lint:boundaries` covers it. |
| II. Typed Tauri IPC, ratcheted                       | PASS (untouched) | No command added or removed. `COMMANDS_OUTSIDE_THE_TYPED_SURFACE` stays at 53 and `MAX_UNTYPED_COMMANDS` stays at 53 — this feature adds no IPC.                                                                                   |
| III. Coverage floors (62/67/90/62, may only move up) | PASS             | Both new modules are pure functions plus a thin hook, tested directly. Net lines fall (SC-004), and the removed 229-line file was 0% covered, so the measured figure moves up rather than down. No floor is changed.               |
| IV. Resource-conscious verification                  | PASS             | Targeted `vitest run` on the touched files; no full suite, no watch mode, no `cargo` run (nothing in `src-tauri` changes).                                                                                                         |
| V. Design tokens / no ad-hoc styling                 | N/A              | No CSS, no component markup.                                                                                                                                                                                                       |
| VI. Verification Discipline                          | PASS             | Every claim in the spec is asserted headlessly against the store or against a pure function. Pixels are not the oracle. No manual step is deferred.                                                                                |

No violations, so **Complexity Tracking** is empty and omitted.

## Design

### Where the registry already is

`src/hooks/useMenuActions.ts` holds:

- `MenuAction` — the eight ids `src-tauri` emits (`open`, `settings`,
  `toggle-library`, `toggle-highlights`, `find`, `play-pause`, `prev-page`,
  `next-page`), imported from `lib/api/menu`.
- `MenuActionHandlers` — one optional handler per id.
- `dispatchMenuAction(action, handlers): boolean` — pure, synchronous, already
  exported "for unit testing", already covered by `useMenuActions.test.ts`.

Nothing about that is menu-specific except the name. It is the command registry
this feature needs, so the feature does not build a second one.

### What gets added

`src/hooks/useCommandKeys.ts`:

- `COMMAND_CHORDS` — the chord table, `readonly Chord[]`, each entry
  `{ action, key, ctrl, label }`. Three commands get chords: `open` (`Ctrl+O`),
  `prev-page` (`PageUp`, `ArrowLeft`), `next-page` (`PageDown`, `ArrowRight`).
  The four ids with no destination (`settings`, `toggle-library`,
  `toggle-highlights`, `find`) get no entry — spec FR-003 — and `play-pause` is
  left with `AiPlaybackBar`, which already binds `Ctrl+Space` to a handler that
  can start from idle. Two window listeners on one chord would toggle twice.
- `resolveChord(event): MenuAction | null` — pure. Reads `key`, `ctrlKey`,
  `metaKey`, `shiftKey`, `altKey`, and the event target's tag /
  `isContentEditable`. Returns the id or `null`. This is the whole matching
  rule, and it is testable without a DOM listener.
- `useCommandKeys(handlers)` — one `window` `keydown` listener registered once
  (empty dep list, handlers read through a ref: the exact pattern
  `useMenuActions` already uses to avoid stale closures). On a match it calls
  `event.preventDefault()` then `dispatchMenuAction(action, handlersRef.current)`.

### What gets deleted

`src/hooks/useKeyboardShortcuts.ts`, whole file. Verified unreferenced:
`grep -rn "useKeyboardShortcuts" src/` returns only three comment mentions
(`useOpenPdf.ts:7`, `HighlightCreationHandler.tsx:17,52`), and
`grep -rn "KEYBOARD_SHORTCUTS" src/` returns nothing outside the file itself.
The comments are updated to name the surviving module.

### What gets edited

`src/components/reader/ReaderView.tsx` — the handlers object currently written
inline at the `useMenuActions` call is hoisted into a `const` and passed to both
hooks. Same object, same references, two dispatchers.

Its page handler also stops reading `currentPage` and `playbackState` from the
render closure and reads them from the store at call time. A held `PageDown`
fires `keydown` faster than React re-renders, so a captured page number makes
every repeat in a burst compute the same target and the page advances once for
several presses. The store is the only value that is current when the handler
actually runs. This also leaves the callback with an empty dependency list.

`src/components/PdfViewer.tsx` — its `window` `keydown` listener loses the four
page keys and `Space`, which move into `COMMAND_CHORDS`. `Home`/`End` stay:
there is no `MenuAction` id for first/last page, the native menu has no such
item, and inventing an id `src-tauri` never emits would put a dead entry in the
registry. They collide with nothing.

This is the substantive correction to the original draft of this plan, which
recorded page navigation as inert. It was not — `PdfViewer` was binding it all
along, one component away from the hook that was found dead. The consequence is
that the feature is a consolidation, not only a binding: two window listeners
answering `PageDown` is the same defect class as `Ctrl+Space` being answered
twice, which this design already refused to introduce.

### What stops the next one

`src/__tests__/architecture/global-key-listeners.test.ts` scans production
source for `window`/`document` `keydown` registrations and fails on any file
without a declared reason. Written after the audit above missed two listeners
that a literal grep for `addEventListener("keydown"` could not see — both use
single quotes. A test that reads the source is the only form of this check that
does not depend on the auditor's grep being lucky.

### Why page navigation is its own module

`navigatePageBy` could have stayed a `useCallback` in `ReaderView`, and did for
two rounds. It moved because the ordering inside it is the part that can be
wrong — stop playback, _then_ read the page, _then_ write — and a closure in a
700-line component body offers nowhere to assert that from. The first version
read the page before the `await`, so during the stop window every repeat of a
held key computed the same target; the comment above it claimed the opposite.
Extraction is not tidying here. It is what made the bug expressible as a failing
test, and the test was checked by re-introducing the bug and watching it fail.

### The keys that stay where they are

`Escape` (three component-local handlers), `Ctrl+Shift+H` (highlight creation)
and `Ctrl+Space` (play/pause) are not moved into the registry. Each needs state
a window-level listener cannot see: which panel is innermost, what the pending
selection is, and the page text needed to start playback from idle. Recorded in
the spec's Clarifications.

## Project Structure

### Documentation (this feature)

```text
specs/067-command-surface/
├── spec.md              # /speckit.specify + /speckit.clarify output
├── plan.md              # this file
└── tasks.md             # /speckit.tasks output
```

No `research.md` — there is nothing to research; the registry, the handlers and
every command they call already exist and were read directly. No `data-model.md`
— no entity is persisted. No `contracts/` — no IPC surface changes.

### Source code

```text
src/
├── hooks/
│   ├── useCommandKeys.ts          # NEW — chord table, resolveChord, hook
│   ├── useCommandKeys.test.ts     # NEW — resolver + registry-consistency tests
│   ├── useMenuActions.ts          # unchanged (the registry)
│   ├── useMenuActions.test.ts     # unchanged
│   ├── useOpenPdf.ts              # comment update only
│   └── useKeyboardShortcuts.ts    # DELETED (229 lines, no call site)
└── components/
    ├── reader/ReaderView.tsx      # hoist handlers, mount useCommandKeys
    └── pdf-viewer/HighlightCreationHandler.tsx  # comment update only
```

**Structure Decision**: single project, frontend only. The feature lives
entirely in `src/hooks/` because that is where the existing dispatcher lives;
introducing a `src/application/commands/` layer for eight ids and five chords
would add an indirection the boundary rules do not require and the
ESLint boundaries config would have to learn about.
