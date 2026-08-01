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

Only the menu half runs. Measured on `main` at `565fe1a`:

| Command              | Menu item | Keyboard                                                                                                                  |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Open a document      | works     | **inert** — `Ctrl+O` does nothing                                                                                         |
| Play / pause reading | works     | works, but through a _different_ binding (`Ctrl+Space`, registered by the playback bar) than the one advertised (`Space`) |
| Previous / next page | works     | **inert** — `PageUp`/`PageDown`/arrows do nothing                                                                         |
| Settings             | inert     | **inert**                                                                                                                 |
| Toggle library       | inert     | **inert**                                                                                                                 |
| Toggle highlights    | inert     | **inert**                                                                                                                 |
| Find                 | inert     | **inert**                                                                                                                 |

The keyboard half is inert for one reason: `src/hooks/useKeyboardShortcuts.ts`
is 229 lines with **no call site**. It registers nothing because nothing mounts
it. The four inert _menu_ items are a different problem — they have no
destination yet — and stay out of scope here.

A person who reads the shortcut list and presses the key gets silence, with no
error and no clue that the key was never bound. That is the whole bug.

## Clarifications

### Session 2026-08-01

Four ambiguities in the description above were resolved against the code rather
than by preference. Each names the evidence.

- **Q: `Space` or `Ctrl+Space` for play/pause?** → `Ctrl+Space`. The advertised
  list says `Space`, but `AiPlaybackBar.tsx:271` already binds `Ctrl+Space` and
  that binding works today. Plain `Space` is also the browser's page-scroll key
  inside a scrolling document view, so taking it globally would cost a
  navigation gesture to gain a duplicate. The documentation moves to match the
  code (FR-006).

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
  narrower purpose.
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

- **SC-001**: Advertised-but-inert shortcuts go from **12 of 12** to **0**,
  asserted by a test comparing the advertised set to the bound set in both
  directions. Commands whose destination does not exist are withdrawn from the
  advertised list rather than bound to a no-op.
- **SC-002**: Adding a reader command requires editing **one** registry entry. A
  command added with no handler fails the suite rather than shipping inert.
- **SC-003**: Every P1 acceptance scenario is asserted headlessly against the
  store, with no manual step and no visual check.
- **SC-004**: Production lines fall. The 229-line unmounted hook is removed and
  the replacement is ~130 lines, a net reduction of roughly 100 lines of
  shipped code, against ~230 lines of new test — the ratio a feature whose
  whole point is "this is now asserted" should have.
