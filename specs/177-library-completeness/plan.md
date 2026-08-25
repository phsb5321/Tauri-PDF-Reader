# Implementation Plan: Complete Library Home

**Branch**: `177-library-completeness` | **Spec**: [spec.md](./spec.md)

## Technical Context

The shared `Toolbar` already owns Sessions and Open, while `ReaderView` already owns and mounts the application-wide `SettingsPanel`; only a visible toolbar callback is missing. Real first-page covers already exist as a lazy, size-bounded, SHA-bound pdf.js pipeline. Legacy library rows fail before that pipeline because `plugin-fs` has no persisted dialog grant. Follow-up evidence on 25/08/2026 also showed WebKitGTK painting the Sort select with a native light face under pale dark-theme text, and the user requested a larger default type scale plus one-step PDF drag-to-session. Tauri 2 already exposes native webview drag/drop events and grants dropped paths to plugin-fs before the frontend event; the existing import flow already binds parsed bytes to the backend document hash, and the existing session store already creates/restores sessions. The missing piece is shell orchestration, not another path-grant API.

## Constitution Check

- **Hexagonal architecture**: UI only adds a callback to the existing shell-owned Settings state. Native file authorization remains in the library command boundary; cover rendering stays behind the existing cover repository/service.
- **Typed IPC ratchet**: no new command and no generated-binding edit. The native Tauri drop pipeline already supplies plugin-fs authority before its event; adding a callable path-grant IPC would broaden the trust boundary unnecessarily.
- **Test first**: toolbar, scope-selection, responsive geometry, painted control contrast, relative type scale, drop subscription, hash-bound path import, invalid-drop non-mutation, and session activation assertions fail before implementation; packaged legacy-profile, multi-width, and real OS-drag journeys are the user-visible oracles.
- **Design system**: the Settings action reuses `toolbar-button`, `toolbar-icon`, and existing tokens. Larger typography scales the rem system with a relative root percentage. Form controls and the drop target use semantic colour/spacing/z-index tokens.
- **State management**: no new store is introduced. Drag completion composes the existing document and session store actions; shell-local hover/busy/status state prevents duplicate drops and remains UI-only.
- **Verification discipline**: packaged journeys drive Settings and a real file-manager drag through public controls, distinguish one real cover from a missing-file fallback, and measure computed type/contrast plus session state through visible output. DOM/accessibility state, backend rows, and persisted narrow scope are the judges, not visual opinion or a synthetic drop dispatch.

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

### Slice E — Legible native controls and larger relative type

1. Add fail-first source/computed-style assertions for a relative 112.5% root scale and the library's body/control floors.
2. Disable WebKitGTK's native face on the Sort select, bind its foreground/background/border to semantic tokens, and draw the disclosure indicator in CSS so painted and measured colours agree.
3. Run the existing packaged contrast sweep in explicit dark and light themes; require Search/Sort foreground/background contrast ≥4.5:1.
4. Re-run narrow geometry after the type increase; wrapping/scrolling may adapt, clipping and horizontal overflow may not.

### Slice F — Native PDF drop creates an active session

1. Wrap `getCurrentWebview().onDragDropEvent` behind a small file-drop API/hook with cleanup and one in-flight latch. ReaderView owns the public hover target and status/error output.
2. Factor `useOpenPdf`'s dialog-independent, SHA-bound import body into a path entry point. Tauri's native drop event has already granted plugin-fs access; reject non-PDF paths before reading and do not add an arbitrary-path grant command.
3. Accept exactly one dropped PDF. After verified import, create and restore a one-document session named from the bounded document title, then reveal the reader. Invalid/multiple drops create no app row/session/document.
4. Add targeted hook and shell tests plus a packaged journey that uses an actual X11 file-manager window and pointer drag into the app; synthetic event dispatch cannot satisfy the actor gate.
5. Record the dependency boundary honestly: Tauri/plugin-fs automatically scopes every native drop before emitting it, even an invalid multi-file/directory drop. This behavior already exists with the default handler and needs dependency-level hardening rather than a second application grant surface.

## Security Decisions

- Database rows identify the files the reader already presents to the WebView. Recovery authorizes only canonical, existing, regular `.pdf` files from returned rows.
- No directory or glob grant is introduced.
- Invalid IDs and invalid paths are skipped, not authorized.
- Scope restoration enables the same frontend read the original dialog grant intended; it does not add a command that returns arbitrary file bytes.
- No custom drop grant command exists. Tauri/plugin-fs performs native drop authorization before the frontend event; the application accepts only one `.pdf` and performs no further scope mutation.
- The existing SHA-bound import sequence and backend path canonicalization remain the authority for library identity; native scope authorization alone cannot create a row or session.
- The existing cover pipeline still verifies source bytes against the row hash before cache write. A changed file may be readable but never becomes a cover under the old identity.

## Verification Order

1. Harness status and spec consistency.
2. Fail-first targeted Settings/scope tests.
3. Implement Slice A; run targeted frontend tests, typecheck, lint.
4. Implement Slice B; run targeted Rust tests with `--features test-mocks -j 1`, rustfmt, clippy.
5. Record the packaged geometry probe failing before Slice D, implement its CSS root fix, then rerun at all three widths.
6. Add fail-first typography/Sort-paint and drag-session contracts; implement Slices E/F and run targeted frontend/Rust checks.
7. Run the packaged legacy-profile, contrast/typography, geometry, and real OS-drag journeys serially.
8. Run `make harness-check` and `pnpm verify` before commit.
9. Obtain a different-family exact-head review; repair every BLOCKER/MAJOR.
10. Push, poll required CI green, squash-merge, and verify the merged state.

## Rollback

One squash revert removes the visible Settings callback, legacy file-grant restoration, responsive/type/control repairs, native drop orchestration, packaged journeys, and spec receipt. It cannot delete sessions or exact-file grants a user already created while the feature was active; those remain ordinary user-owned app state and can be removed through the existing UI/profile controls.
