# Feature Specification: Complete Library Home

**Feature Branch**: `177-library-completeness`
**Created**: 24/08/2026
**Last amended**: 25/08/2026
**Status**: Draft

## Outcome

A returning reader sees a complete library home: Settings is always reachable, every known readable book can paint its real first-page cover without being picked again, and every card keeps a visible and accessible name. Controls remain legible at a larger default type scale, and dropping one PDF creates and activates a reading session around that book. Missing books and invalid drops remain honest errors rather than disappearing or widening filesystem authority.

## User Scenarios & Testing

### User Story 1 — Open Settings from anywhere (P1)

As a reader, I can open Settings from the shared toolbar whether I am on the library home or inside a document.

**Independent test**: launch the packaged app on the library home, activate the visible Settings action using its public accessible name, and observe the existing Settings dialog.

**Acceptance scenarios**:

1. Given the library home, the toolbar exposes a keyboard-reachable action named “Settings”.
2. Given an open document, the same action remains available and opens the same dialog.
3. Closing Settings returns focus to the ordinary application surface without changing the open book.

### User Story 2 — Recover covers for known books (P1)

As a returning reader with books added before file grants were persisted, I see real first-page covers for files that still exist without re-picking every book.

**Independent test**: seed a hermetic legacy library with one readable PDF outside the app data directory and no persisted file scope, launch the packaged app, and prove its card reaches real-cover state and a narrow file grant is persisted.

**Acceptance scenarios**:

1. A registered, existing regular PDF receives only its own file-read authorization before its card attempts cover generation.
2. Its first page is rendered and cached by the existing bounded, content-bound cover pipeline.
3. On relaunch, the retained narrow grant and cached raster avoid another picker or fallback.

### User Story 3 — Keep missing books truthful and named (P1)

As a reader, I can still identify a missing or unreadable book and distinguish it from books whose covers loaded.

**Independent test**: seed one readable row and one missing row; the readable row reaches real-cover state, the missing row stays in deterministic fallback state, and both visible titles and accessible card names are non-empty.

### User Story 4 — Read the whole card at any desktop width (P1)

As a reader, I can identify every book and its progress in ordinary, narrow, and ultrawide windows without card content being clipped or stretched into dead space.

**Independent test**: launch a multi-book packaged profile, resize through 640×800, 1200×800, and 2560×1080, and assert every title/content box remains inside its card while the ultrawide grid keeps readable bounded columns.

### User Story 5 — Read every library control comfortably (P1)

As a reader, I can read the library controls without pale text disappearing into a native light form-control face, and the default type scale is visibly larger while continuing to respect my browser/OS text-size preference.

**Independent test**: launch the packaged dark and light themes, inspect the painted Search/Sort controls and key body text, and assert a 4.5:1 foreground/background ratio plus the enlarged computed type floor.

### User Story 6 — Drop a PDF to start a reading session (P1)

As a reader, I can drag one PDF from my file manager onto Lectrice and immediately get an active reading session containing that verified book, open at its saved page when known or page 1 when new.

**Independent test**: drag a real PDF from a visible file-manager window into the packaged app, observe the public drop target and success status, then open Sessions and prove the named session is active and contains exactly the dropped book.

## Requirements

- **FR-001** — Settings MUST be an always-visible shared-toolbar action on both library and reader surfaces.
- **FR-002** — The Settings action MUST be keyboard reachable, have the accessible name “Settings”, and open the existing application-wide Settings dialog.
- **FR-003** — Listing the library MUST restore a file-read grant only for each registered path that resolves to an existing regular PDF.
- **FR-004** — Restored authorization MUST be file-specific. Directory, wildcard, parent, sibling, and whole-library-folder grants are forbidden.
- **FR-005** — An already-allowed path MUST NOT be re-added on each list operation.
- **FR-006** — Cover generation MUST retain the existing source-size bound, content-hash check, first-page raster policy, cache validation, and deterministic fallback.
- **FR-007** — Missing, non-PDF, non-regular, or unreadable files MUST NOT gain a grant. Grants remain path-based like the original picker grant: a file replaced at an already-registered path MAY regain that exact path authorization, but the existing content-hash check MUST keep it on fallback and MUST NOT cache it under the old identity.
- **FR-008** — Every document card MUST display a non-empty title and expose a non-empty accessible card name in real-cover and fallback states; decorative grid covers MUST NOT duplicate that announcement.
- **FR-009** — Scope recovery MUST NOT mutate library rows, reading progress, highlights, sessions, or source files.
- **FR-010** — The restored file grants MUST survive restart through the existing persistence mechanism.
- **FR-011** — The packaged acceptance journey MUST begin with no persisted scope and include a missing-file negative control; a pre-authorized fixture or all-ready result is not a pass.
- **FR-012** — Grid rows MUST size to card content rather than stretch to divide the available library height.
- **FR-013** — Every visible grid title, metadata row, and progress indicator MUST remain within its card at 640×800 and 1200×800.
- **FR-014** — A card’s content block MUST end within one spacing token of the card edge; the grid MUST NOT stretch a single row into a large empty card.
- **FR-015** — At 2560×1080 the grid MUST cap column width/count so book titles remain useful instead of packing ten minimally sized columns.
- **FR-016** — List mode MUST remain a single column with each title and content box contained by its row at narrow width.
- **FR-017** — The root type scale MUST render at 112.5% of the user-agent default, using a relative percentage so browser/OS text-size preferences continue to compose rather than being replaced by a fixed pixel root.
- **FR-018** — At the default 16px user-agent root, ordinary library controls and card titles MUST render at least 15.75 CSS px and application body text MUST render at least 18 CSS px.
- **FR-019** — Native Search and Sort controls MUST paint explicit semantic foreground and background colours in light and dark themes, with a measured contrast ratio of at least 4.5:1. The Sort control MUST opt out of a native painted face when that face can diverge from its CSS colours.
- **FR-020** — While one or more files hover over the app, a visible and accessibility-announced drop target MUST say that one PDF will create a reading session.
- **FR-021** — Dropping exactly one existing regular `.pdf` MUST rely on Tauri’s native exact-file drop authorization, then reuse the existing SHA-bound PDF parse and backend-canonicalized library registration flow. Lectrice MUST NOT add a custom arbitrary-path grant or byte-reading command.
- **FR-022** — A successful drop MUST create a reading session named from the verified document title (bounded to the existing 100-character session-name limit), activate it, open the verified document, and expose a dismissible public success status.
- **FR-023** — A known dropped document MUST preserve its existing row identity and saved page. A fresh dropped document MUST start on page 1. Neither case may duplicate the library document.
- **FR-024** — Zero-PDF, multi-file, directory, missing, or non-PDF drops MUST show a public error and MUST NOT create a session, library row, or visible document. Lectrice MUST perform no additional scope mutation: Tauri/plugin-fs grants native dropped paths before emitting the frontend event, an upstream behavior that predates this listener.
- **FR-025** — Repeated drop-listener mounts and unmounts MUST not leak subscriptions or process the same native drop more than once.
- **FR-026** — The packaged acceptance journey MUST perform a real operating-system file drag through visible controls; dispatching a synthetic hidden event or calling application state/IPC directly is not a passing actor journey.

## Edge Cases

- The library row points to a deleted PDF.
- The path is a directory or a non-PDF regular file.
- A symlink resolves outside its original folder.
- The PDF changed after it was registered and no longer matches the row identity.
- The path was already granted by a previous dialog or launch.
- The title field is blank while the filename remains available.
- Settings is activated while no document exists or while a document is already open.
- A narrow viewport needs several content-sized card rows and an internal grid scrollbar.
- An ultrawide viewport can fit every book in one row but must not stretch that row vertically.
- WebKitGTK paints a native select face whose colour does not match the dark CSS theme.
- The user has increased or decreased their browser/OS base text size.
- A drop contains one PDF plus another file, two PDFs, a directory, a symlink, or a path that disappears before validation.
- Tauri 2.9.5 and tauri-plugin-fs 2.4.5 automatically add every native dropped path to their scopes before the frontend event. Lectrice does not widen that behavior with a callable grant command; hardening invalid-drop scope is an upstream/dependency follow-up.
- The dropped PDF already belongs to the library and has saved progress.
- The dropped PDF title exceeds the reading-session name limit.
- A drop arrives while another drop import is still in flight.

## Success Criteria

- **SC-001** — A packaged hermetic legacy-profile journey observes a visible Settings action and opens the existing Settings dialog through public controls.
- **SC-002** — In that journey, the readable legacy card reaches `ready`, the missing control reaches `fallback`, and neither stays indefinitely `loading`.
- **SC-003** — The same journey observes non-empty visible titles and accessible card names for both cards.
- **SC-004** — The persisted scope is absent before launch and present after the readable row is listed; it contains a file-specific grant, not a directory wildcard.
- **SC-005** — Targeted frontend, Rust, architecture, type, lint, and harness checks remain green without lowering any gate.
- **SC-006** — The packaged geometry probe fails if any title/content rectangle escapes its card or if dead space exceeds one spacing token.
- **SC-007** — The same probe observes one contained list column at narrow width, then at 2560×1080 no more than nine bounded grid columns and no horizontal overflow.
- **SC-008** — The packaged contrast probe records zero Search/Sort text violations in light and dark themes and verifies the Sort control has non-native appearance with semantic CSS foreground/background colours.
- **SC-009** — The packaged typography probe observes an 18px root at the default user-agent setting, at least 18px application body text, and at least 15.75px library control/card text without horizontal overflow at 640×800.
- **SC-010** — A real file-manager drag of one PDF makes the drop target visible, opens the book, publishes a dismissible “Session … created” status, and the Sessions panel reports that same one-document session as active.
- **SC-011** — Non-PDF and multi-file negative controls create no session/library mutation and expose a readable error. The valid single-PDF journey proves the persisted drop scope is exact-file rather than directory/wildcard; no custom path-grant IPC exists.
