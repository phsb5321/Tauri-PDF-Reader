# Implementation Plan: Complete Library Home

**Branch**: `177-library-completeness` | **Spec**: [spec.md](./spec.md)

## Technical Context

The shared `Toolbar` already owns Sessions and Open, while `ReaderView` already owns and mounts the application-wide `SettingsPanel`; only a visible toolbar callback is missing. Real first-page covers already exist as a lazy, size-bounded, SHA-bound pdf.js pipeline. Legacy library rows fail before that pipeline because `plugin-fs` has no persisted dialog grant; the database still contains ten SHA-identified rows, seven of whose regular PDFs exist and are readable, while the live cache contains zero covers.

## Constitution Check

- **Hexagonal architecture**: UI only adds a callback to the existing shell-owned Settings state. Native file authorization remains in the library command boundary; cover rendering stays behind the existing cover repository/service.
- **Typed IPC ratchet**: no new command and no generated-binding edit. Adding injected `AppHandle` to an existing command does not alter its frontend signature.
- **Test first**: toolbar, scope-selection, and responsive geometry assertions fail before implementation; packaged legacy-profile and multi-width journeys are the user-visible oracles.
- **Design system**: the Settings action reuses `toolbar-button`, `toolbar-icon`, and existing tokens.
- **State management**: no new store or transition.
- **Verification discipline**: the packaged journey drives Settings through its accessible control and distinguishes one real cover from a missing-file fallback. DOM state and persisted narrow scope are the judges, not visual opinion.

## Architecture

### Slice A — Always-visible Settings action

1. Add an optional `onSettings` callback to `Toolbar`.
2. Render a text-and-icon Settings button beside Sessions/Open and include it in the existing roving-tab order.
3. Pass `ReaderView`’s existing `setShowSettings(true)` handler to the toolbar.
4. Extend the shell UI test to activate the real public button and assert the existing dialog opens on the library home and reader surface.

### Slice B — Restore legacy file grants at the library boundary

1. Inject `AppHandle` into `library_list_documents`; this is native command state and does not enter the typed frontend signature.
2. For each returned document, derive a grant candidate through the existing PDF-path validator: canonical path, regular file, `.pdf` extension. Reject malformed document identities before scope mutation.
3. Ask the existing fs scope whether the canonical path is already allowed. Only missing, file-specific candidates call `allow_file`; failures are logged per row and never hide the rest of the library.
4. The already-initialized persisted-scope plugin observes `PathAllowed` and writes the narrow scope. No directory grant or custom byte-reading command is added.
5. Keep cover size/hash/cache behavior untouched. Once authorization exists, the current frontend pipeline performs its own source-size preflight and SHA-256 verification before caching.

### Slice C — Packaged legacy-profile acceptance

1. Add one two-phase runner under the existing hermetic profile/toolchain helpers.
2. Phase 1 launches the normal packaged debug app only to create the production database schema, then exits cleanly.
3. The observer inserts one real public fixture row outside app-local data and one missing-file row, both with SHA-shaped identities; it asserts `.persisted-scope` is absent.
4. Phase 2 drives the public Settings button, asserts both visible titles/accessibility names, waits for `ready` on the real source and `fallback` on the missing negative control, then exits.
5. The observer verifies the persisted scope appeared and contains no wildcard/directory grant. Source fixture, profile, cache, and evidence stay under temporary paths.

### Slice D — Content-sized responsive card geometry

1. Extend the existing packaged home-audit probe to record each card, content, and title rectangle.
2. Assert titles/content remain inside cards and card bottoms do not contain more than one spacing token of stretch at 640×800 and 1200×800.
3. Add a 2560×1080 probe and assert bounded column count plus no horizontal overflow.
4. Make grid rows content-sized, keep alignment at the start, and leave one 2:3 sizing authority on `DocumentCover`.
5. Cap grid tracks while preserving the existing internal vertical scroller and list mode.

## Security Decisions

- Database rows identify the files the reader already presents to the WebView. Recovery authorizes only canonical, existing, regular `.pdf` files from returned rows.
- No directory or glob grant is introduced.
- Invalid IDs and invalid paths are skipped, not authorized.
- Scope restoration enables the same frontend read the original dialog grant intended; it does not add a command that returns arbitrary file bytes.
- The existing cover pipeline still verifies source bytes against the row hash before cache write. A changed file may be readable but never becomes a cover under the old identity.

## Verification Order

1. Harness status and spec consistency.
2. Fail-first targeted Settings/scope tests.
3. Implement Slice A; run targeted frontend tests, typecheck, lint.
4. Implement Slice B; run targeted Rust tests with `--features test-mocks -j 1`, rustfmt, clippy.
5. Record the packaged geometry probe failing before Slice D, implement its CSS root fix, then rerun at all three widths.
6. Run the packaged legacy-profile journey serially.
7. Run `make harness-check` and `pnpm verify` before commit.
8. Obtain a different-family exact-head review; repair every BLOCKER/MAJOR.
9. Push, poll required CI green, squash-merge, and verify the merged state.

## Rollback

One squash revert removes the visible Settings callback, legacy file-grant restoration, packaged journey, and spec receipt. It does not delete existing persisted grants, cache files, or library data; those remain ordinary user-owned app state.
