# Feature Specification: One command surface, two ways in

**Feature Branch**: `067-command-surface`
**Created**: 2026-08-01
**Status**: Draft
**Input**: User description: "Bind the keyboard to the same command set the native menu uses, so declared shortcuts actually run"

## The gap this closes

Lectrice advertises the same set of reader commands twice — once as native menu
items (File / View / Playback, exported over AT-SPI to the Linux global menu
bar) and once as keyboard shortcuts, listed in `KEYBOARD_SHORTCUTS` and in the
project's own documentation.

The two halves do not agree. Measured on `main` at `565fe1a`:

| Command              | Menu item | Keyboard                                                                                                             |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| Open a document      | works     | **inert** — `Ctrl+O` does nothing                                                                                    |
| Play / pause reading | works     | works, but through a _different_ binding (`Ctrl+Space`, `AiPlaybackBar`) than the one advertised (`Space`)           |
| Previous / next page | works     | works, but through a _second listener_ (`PdfViewer`) that writes the page directly and skips the stop-playback guard |
| Settings             | inert     | **inert**                                                                                                            |
| Toggle library       | inert     | **inert**                                                                                                            |
| Toggle highlights    | inert     | **inert**                                                                                                            |
| Find                 | inert     | **inert**                                                                                                            |

The keyboard is not one broken surface. It is **four independent `keydown`
listeners**, added at different times, none aware of the others:

| Listener                       | Binds                                                                          | State                                                              |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `useKeyboardShortcuts.ts`      | `Ctrl+O`, `Ctrl+,`, `Ctrl+H`, `Ctrl+B`, `Ctrl+F`, `Escape`, `Space`, page keys | 229 lines, **no call site** — advertised, never mounted, never ran |
| `PdfViewer.tsx`                | `PageUp`/`PageDown`/arrows/`Space`, `Home`/`End`                               | live, but bypasses the menu's stop-playback-first guard            |
| `AiPlaybackBar.tsx`            | `Ctrl+Space`, `Escape`                                                         | live, correct — needs playback state a window listener cannot see  |
| `HighlightCreationHandler.tsx` | `Ctrl+Shift+H`                                                                 | live, correct — needs the pending selection                        |

So `Ctrl+O` is genuinely dead, page navigation works but through the wrong path,
and play/pause works under a chord the documentation does not name. The reason
all three could be true at once is that nothing anywhere asserts which listener
owns a key — a fifth could be added tomorrow and no test would notice.

A person who reads the shortcut list and presses `Ctrl+O` gets silence, with no
error and no clue that the key was never bound. That is the visible bug; the
scattering is why it survived.

## Clarifications

### Session 2026-08-01

Four ambiguities in the description above were resolved against the code rather
than by preference. Each names the evidence.

- **Q: `Space` or `Ctrl+Space` for play/pause?** → `Ctrl+Space`. The advertised
  list says `Space`, but `AiPlaybackBar.tsx:271` already binds `Ctrl+Space` and
  that binding works today. Plain `Space` is not free either: `PdfViewer`
  already binds it to next-page, so "give `Space` to play/pause" would take a
  working navigation key to duplicate a working playback key. The documentation
  moves to match the code (FR-006), and `Space` keeps its live meaning — it
  joins the chord table as next-page so that it goes through the same guard the
  other page keys now do.

  A consequence worth stating: play/pause therefore does **not** enter the
  global chord table. `AiPlaybackBar`'s handler can _start_ playback from idle,
  which the menu's play/pause handler cannot — that one only toggles
  playing ⇄ paused. Binding the same chord globally would fire both listeners
  and downgrade the behaviour to the weaker one. It moves into the table when
  the richer handler does.

- **Q: does the global layer take `Escape`?** → No. `HighlightToolbar.tsx:118`,
  `HighlightContextMenu.tsx:38` and `AiPlaybackBar.tsx:278` each own `Escape`
  for their own dismissal. A global handler would fire alongside them, and
  "close the innermost thing" is not expressible from a window-level listener
  without a modal stack this app does not have. Out of scope; the three
  component handlers stay as they are.
- **Q: what happens to the four commands with no destination** (settings,
  library, highlights, find)? → Withdrawn from the advertised shortcut list, not
  bound to a no-op (FR-003). Their **menu items stay**: removing them means
  editing the native menu in `src-tauri`, which is a separate surface and a
  separate change. This spec does not make the menu worse and does not pretend
  to fix it — `useMenuActions` already documents those three as inert, and that
  stays true until the panels exist.
- **Q: `Ctrl` `+` / `Ctrl` `-` zoom, listed but never implemented?** →
  Withdrawn. No handler for it exists anywhere in the tree; there is nothing to
  bind. Advertising a zoom control the app does not have is the same defect as
  advertising a shortcut that is not wired.
- **Q: what stops a fifth listener being added next month?** → A test, not a
  convention. `src/__tests__/architecture/global-key-listeners.test.ts` scans
  the source for `window`/`document` `keydown` registrations and fails on any
  file that is not in a declared list, with the reason it is not in the command
  registry written beside it. Every previous instance of this bug was added by
  someone who had no way to know the other listeners existed; the failure
  message is that way to know. It found two the initial audit missed
  (`HighlightToolbar`, and the unmounted legacy `PlaybackBar`).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The advertised keys do what they say (Priority: P1)

Someone reading a long PDF keeps both hands on the keyboard. They press
`PageDown` to turn the page, `Ctrl+O` to open the next document, `Ctrl+Space`
to start and stop the reading voice. Each key does the same thing the
equivalent menu item does — because it _is_ the same command, reached a second
way.

**Why this priority**: it is the entire user-visible defect. Delivered alone it
turns a documented-but-dead feature into a working one, and it needs nothing
that does not already exist — every command in it is already implemented and
already reachable from the menu.

**Independent Test**: mount the reader, dispatch each key event, assert the same
observable state change the menu path produces (page number moved, playback
state transitioned, open-document flow entered). No pixels involved; the store
is the oracle.

**Acceptance Scenarios**:

1. **Given** a document open at page 3 of 10, **When** `PageDown` is pressed,
   **Then** the current page becomes 4 — the same result as choosing
   Playback → Next page.
2. **Given** a document open at page 1, **When** `PageUp` is pressed, **Then**
   the current page stays 1, clamped exactly as the menu path clamps it.
3. **Given** reading is playing and the page changes by keyboard, **When** the
   navigation runs, **Then** playback is stopped first — the same guard the menu
   path applies.
4. **Given** the caret is inside a text input, **When** `PageDown` or an arrow
   key is pressed, **Then** no command fires and the input receives the key.
5. **Given** any document state, **When** `Ctrl+O` is pressed, **Then** the
   open-document flow starts, identically to File → Open.

---

### User Story 2 - A command is defined once (Priority: P2)

A contributor adds a reader command. They write what it does in one place, and
it is reachable from both the menu and its key without them wiring a second
dispatch table — and without the two drifting into doing different things.

**Why this priority**: it is what stops this bug from returning. The reason the
keyboard died silently is that it was a _parallel_ implementation — its own
file-open logic, its own store wiring, its own copy of the command list — so
nothing broke when it was left unmounted. One registry makes an unbound command
a test failure instead of a silence.

**Independent Test**: assert that every command id in the registry has a
handler and, where one is advertised, a chord; and that the menu dispatcher and
the keyboard dispatcher resolve the same id to the same function.

**Acceptance Scenarios**:

1. **Given** the command registry, **When** the menu emits an action id and the
   keyboard matches a chord for that same id, **Then** both invoke the same
   handler reference.
2. **Given** a command id present in the registry with no handler wired, **When**
   the test suite runs, **Then** it fails naming that id.

---

### User Story 3 - The shortcut list tells the truth (Priority: P3)

The list of shortcuts the app carries matches the keys that are bound. Nothing
is advertised that does not run; nothing runs that is not advertised.

**Why this priority**: lower than the binding itself, but it is the part a user
actually reads. Today the list claims `Ctrl` `+`/`-` zoom, which no handler has
ever implemented, and claims `Space` for play/pause when the live binding is
`Ctrl+Space`.

**Independent Test**: there is exactly one array. `COMMAND_CHORDS` carries the
human-readable label alongside the binding, so the advertised list _is_ the
bound list and cannot disagree with it. Assert that every entry has a label and
that no chord is declared twice.

**Acceptance Scenarios**:

1. **Given** a chord is added or removed, **When** the change lands, **Then** the
   advertised list changes with it — there is no second list to forget to
   update. The old defect was two lists; the fix is one, not a reconciliation
   test between two.
2. **Given** `COMMAND_CHORDS`, **When** the suite runs, **Then** every entry has
   a non-empty label and no key+modifier pair appears twice.

---

### Edge Cases

- **Typing**: a chord must not fire while the caret is in an `input`,
  `textarea`, or `contenteditable`. Modifier chords (`Ctrl+O`) are the exception
  a text field does not own; unmodified keys (`PageDown`, arrows) are not.
- **A key already owned by a component**: `Escape` is handled today by the
  highlight toolbar, the context menu and the playback bar, and `Ctrl+Shift+H`
  by the highlight creation handler. A global binding must not steal a key a
  focused component is already using for a narrower purpose.
- **A command with no destination**: settings, library, highlights and find have
  no UI to open. They must not be advertised as bound. An inert menu item is a
  visible affordance that does nothing; that is the same defect this spec is
  closing, and it is closed by _removing the claim_, not by adding a no-op.
- **No document open**: page navigation and play/pause with nothing loaded must
  be a no-op, not an error.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The keyboard MUST invoke reader commands through the same handler
  set the native menu invokes. Two dispatchers, one set of handlers.
- **FR-002**: Every command the application advertises as having a shortcut MUST
  be bound at runtime. An advertised-but-unbound command is a test failure, not
  a silent no-op.
- **FR-003**: The application MUST NOT advertise a shortcut for a command whose
  destination does not exist.
- **FR-004**: Keyboard page navigation MUST apply the same page clamping and the
  same stop-playback-first guard as menu navigation.
- **FR-005**: Global chords MUST NOT fire while the user is typing into a text
  field, and MUST NOT override a key a focused component has already bound for a
  narrower purpose. Enforced, not merely intended: a component handler that has
  called `preventDefault` runs before the event reaches `window`, and the global
  resolver treats an already-prevented event as not matching.
- **FR-008**: Exactly one listener MUST own a given key. A second global
  `keydown` registration is a test failure naming the file, whether or not the
  keys it binds happen to overlap today.
- **FR-006**: The play/pause chord MUST be a single documented chord. Where the
  documented chord and the live chord disagree today, the live one wins and the
  documentation is corrected — changing a working key would break a habit for no
  gain.
- **FR-007**: Dead code left behind by this change MUST be deleted, not left
  unmounted. An unreferenced parallel implementation is how this defect
  survived.

### Key Entities

- **Command**: one thing the reader can be asked to do. Has a stable id (the
  same id the native menu already emits), a handler, and optionally a chord and
  a human-readable label.
- **Chord**: a key plus its modifiers, and whether it is suppressed while typing.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Advertised-but-inert shortcuts go to **0**. Every entry in the
  advertised list is an entry in the bound list, because they are the same
  array. Commands whose destination does not exist are withdrawn rather than
  bound to a no-op.
- **SC-002**: Adding a reader command requires editing **one** registry entry. A
  command added with no handler fails the suite rather than shipping inert.
- **SC-003**: Every P1 acceptance scenario is asserted headlessly against the
  store or against a pure function, with no manual step and no visual check.
- **SC-004**: Global `keydown` listeners in production code go from **8
  undeclared** to **8 declared with a reason** — one the command registry, six
  component-owned for state a window listener cannot see, one recorded as dead.
  A ninth fails the suite. (Counted, not estimated: the same scan the test runs,
  at `565fe1a` and at HEAD. An earlier draft of this criterion said six, which
  was a hand count taken before the test found `HighlightToolbar` and
  `PlaybackBar`.)
- **SC-005**: Shipped code does not grow. Against `565fe1a`, production lines are
  **+269 / −286**, a net **−17** — the 229-line unmounted hook and the duplicate
  page handling in `PdfViewer` pay for the registry and the navigation module.
  Test lines are **+548**. A feature whose point is "this is now asserted"
  should spend its lines on assertions, not on the thing being asserted.
