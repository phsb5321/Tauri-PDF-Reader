# Feature Specification: Complete Library Home

**Feature Branch**: `177-library-completeness`
**Created**: 24/08/2026
**Status**: Draft

## Outcome

A returning reader sees a complete library home: Settings is always reachable, every known readable book can paint its real first-page cover without being picked again, and every card keeps a visible and accessible name. Missing books remain honest fallbacks rather than disappearing or prompting in a loop.

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

## Success Criteria

- **SC-001** — A packaged hermetic legacy-profile journey observes a visible Settings action and opens the existing Settings dialog through public controls.
- **SC-002** — In that journey, the readable legacy card reaches `ready`, the missing control reaches `fallback`, and neither stays indefinitely `loading`.
- **SC-003** — The same journey observes non-empty visible titles and accessible card names for both cards.
- **SC-004** — The persisted scope is absent before launch and present after the readable row is listed; it contains a file-specific grant, not a directory wildcard.
- **SC-005** — Targeted frontend, Rust, architecture, type, lint, and harness checks remain green without lowering any gate.
- **SC-006** — The packaged geometry probe fails if any title/content rectangle escapes its card or if dead space exceeds one spacing token.
- **SC-007** — The same probe observes one contained list column at narrow width, then at 2560×1080 no more than nine bounded grid columns and no horizontal overflow.
