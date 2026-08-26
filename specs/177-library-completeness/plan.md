# Implementation Plan: Complete Library and Reader Experience

**Branch**: `177-library-completeness` | **Spec**: [spec.md](./spec.md)

## Technical Context

The shared `Toolbar` already owns Sessions and Open, while `ReaderView` owns the application-wide panels and Library/PDF surface swap. Real covers, PDF outlines, text selection, TTS cache/player events, timing helpers, provider-neutral synthesis ports, responsive tokens, and the Proso-compatible local API already exist; most 25/08 failures were unwired or used the wrong granularity. Evidence showed native GTK chooser aborts from missing Nix schema roots, dead-end reader navigation, an unused outline panel, Fit Width opening near 298%, mixed native form colours, a small/non-adjustable chrome scale, full-page local synthesis taking 46.49s before audio, no local marks (empty overlay/progress), a single mutable TTS synthesizer that discarded the previous connection, and a stale duplicate development process/window. The plan reuses those existing surfaces: visible shell actions, Fit Page, relative UI scale, sentence-pipelined no-mark playback, measured-duration fallback timings, selection-offset rebasing, Ctrl+wheel zoom, the existing `SynthesizerPort`, and a compact token-only reader facelift. Filesystem authority does not change. Groq adds one explicit credential-gated cloud egress beside ElevenLabs; both remain public-Play-gated and memory-only.

## Constitution Check

- **Hexagonal architecture**: UI only adds a callback to the existing shell-owned Settings state. Native file authorization remains in the library command boundary; cover rendering stays behind the existing cover repository/service.
- **Typed IPC ratchet**: drop handling still adds no grant/byte-read command. Provider connect/switch operations add only typed commands collected by `tauri-specta`, regenerate `src/lib/bindings.ts`, and do not grow the untyped exception list.
- **Test first**: toolbar, scope-selection, responsive geometry, painted control contrast, relative type scale, drop subscription, hash-bound path import, invalid-drop non-mutation, and session activation assertions fail before implementation; packaged legacy-profile, multi-width, and real OS-drag journeys are the user-visible oracles.
- **Design system**: the Settings action reuses `toolbar-button`, `toolbar-icon`, and existing tokens. Larger typography scales the rem system with a relative root percentage. Form controls and the drop target use semantic colour/spacing/z-index tokens.
- **State management**: no new store is introduced. Drag completion composes the existing document and session store actions; shell-local hover/busy/status state prevents duplicate drops and remains UI-only. The existing AI TTS store gains an explicit connected-provider registry, active-provider transition, and per-provider voice preference; cloud secrets remain excluded from persistence.
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

1. Add fail-first source/computed-style assertions for a relative 125% root scale and the library's body/control floors.
2. Disable WebKitGTK's native face on the Sort select, bind its foreground/background/border to semantic tokens, and draw the disclosure indicator in CSS so painted and measured colours agree.
3. Run the existing packaged contrast sweep in explicit dark and light themes; require Search/Sort foreground/background contrast ≥4.5:1.
4. Re-run narrow geometry after the type increase; wrapping/scrolling may adapt, clipping and horizontal overflow may not.

### Slice F — Native PDF drop creates an active session

1. Wrap `getCurrentWebview().onDragDropEvent` behind a small file-drop API/hook with cleanup and one in-flight latch. ReaderView owns the public hover target and status/error output.
2. Factor `useOpenPdf`'s dialog-independent, SHA-bound import body into a path entry point. Tauri's native drop event has already granted plugin-fs access; reject non-PDF paths before reading and do not add an arbitrary-path grant command.
3. Accept exactly one dropped PDF. After verified import, create and restore a one-document session named from the bounded document title, then reveal the reader. Invalid/multiple drops create no app row/session/document.
4. Add targeted hook and shell tests plus a packaged journey that uses an actual X11 file-manager window and pointer drag into the app; synthetic event dispatch cannot satisfy the actor gate.
5. Record the dependency boundary honestly: Tauri/plugin-fs automatically scopes every native drop before emitting it, even an invalid multi-file/directory drop. This behavior already exists with the default handler and needs dependency-level hardening rather than a second application grant surface.

### Slice G — Native stability and complete reader navigation

1. Bridge Nix's generated `GSETTINGS_SCHEMAS_PATH` into `XDG_DATA_DIRS` in the dev shell and gate the exact GTK FileChooser/Desktop schemas before launch.
2. Add Back to library and Chapters as reader-only toolbar actions with dynamic roving indices; keep the loaded PDF/page behind Library.
3. Mount the existing TableOfContents dialog, resolve numeric/reference/named destinations, stop TTS before jumps, expose current/expanded state, and close after navigation.
4. Make one native process/window an acceptance invariant; a stale escaped dev process is diagnosed/removed rather than mistaken for the current revision.

### Slice H — Reader display and adjustable chrome

1. Use Fit Page on initial open and use one clamp policy for initial/resize recalculation; manual zoom clears fit mode.
2. Paint the opaque canvas white before pdf.js and keep imported pdf.js text-layer styling authoritative.
3. Persist a 100–150% UI scale with a 125% default; apply it as a relative root percentage and express core layout/spacing/control sizes in rem.
4. Compact secondary toolbar actions to icons with public accessible names, let the title absorb shrink, collapse page/zoom detail at narrow widths, and separate application Settings from Voice settings.
5. Use a three-zone narration dock with one active center rail; hide idle cache coverage while word progress is active and remove the floating debug pill.

### Slice I — Responsive local narration and read from selection

1. Record the real local-model control: first sentence 1.85s versus full page 46.49s. Keep the privacy boundary: no local model text before public Play.
2. Segment text with original UTF-16 offsets. Play sentence zero first, prebuffer exactly one successor after Play, await that cache task at the sink event, and invalidate queues by generation on Stop/new Play.
3. For a no-mark response with measured WAV duration, derive length-weighted per-word timings. Mark them estimated so only the real sink-drained event advances the queue; the timer drives focus/progress but cannot terminate a successor.
4. Track queue-wide completed/total word counts in the bottom rail, while each sentence's marks are rebased to the page text-layer offset.
5. Add Read from here to the selection toolbar and carry selected-tail text plus its full-layer base offset into the sentence queue.

### Slice J — Direct document interaction

1. Add Ctrl/Cmd+wheel PDF zoom through a pure clamped helper; wheel-up zooms in, wheel-down out, and zero/no-modifier leaves normal scroll untouched.
2. Replace the current-word developer pill with a solid semantic voice-colour CSS Highlight on the PDF word itself.
3. Keep page zoom and application UI scale orthogonal: Appearance changes chrome; Ctrl+wheel/ZoomControls change only the document.

### Slice K — Concurrent narration connections and live switching

1. Extend the existing synthesis provider enums with Groq and add a Groq adapter behind `SynthesizerPort`. The production adapter pins `https://api.groq.com/openai/v1`, `canopylabs/orpheus-v1-english`, the documented six-voice catalog, a conservative 200-UTF-8-byte bound under the provider's 200-character contract, bearer-key model preflight, a 16 MiB response ceiling, EOF normalization of streaming WAV size sentinels, strict PCM16 validation, and no native marks.
2. Change `AiTtsEngine` from one replaceable active synthesizer to a registry of connected synthesizers plus one active entry. Each request subscribes to the cancellation generation before cloning exactly one provider entry; cache coordinates and synthesis use that same snapshot. Connecting inserts/replaces only that entry; switching takes the playback gate, cancels synthesis, waits for player Stop acknowledgement, resets state, then selects an already-connected entry. No automatic fallback is added.
3. Add typed connect/switch commands and regenerate bindings. Local initialization may install the exact config-owned loopback connection even when it is not the startup-active provider; no WebView-supplied destination is accepted.
4. Extend the existing AI TTS store with runtime connected-provider state and persisted per-provider voice IDs. Preserve the session-secret canary contract: no cloud key enters persisted state, settings storage, config, logs, or evidence.
5. Replace the single-provider setup panel with a data-driven Connections list and provider detail panel. Add a compact reader-dock selector when two or more providers are connected; activation updates voices and restores the selected provider's prior voice without restart or key re-entry.
6. Generalize the post-Play sentence queue to every no-mark provider. Split source-preserving spans to each provider's input bound, prefetch one successor only after Play, and keep estimated timings/sink-finished completion rules unchanged.
7. Add Rust wire/limit/registry/cache tests (including a timeout-bounded pending-synthesis switch), frontend persistence/state/UI/stale-async tests, seeded fuzz transitions, and an `e2e-tts-fixture` packaged public-controls journey that connects two deterministic cloud fixtures beside configured Local TTS, switches routes, and proves no secret persistence. Update `SECURITY.md`, its executable dataflow set, diagnostics redaction, and known limitations with the Groq egress.

## Security Decisions

- Database rows identify the files the reader already presents to the WebView. Recovery authorizes only canonical, existing, regular `.pdf` files from returned rows.
- No directory or glob grant is introduced.
- Invalid IDs and invalid paths are skipped, not authorized.
- Scope restoration enables the same frontend read the original dialog grant intended; it does not add a command that returns arbitrary file bytes.
- No custom drop grant command exists. Tauri/plugin-fs performs native drop authorization before the frontend event; the application accepts only one `.pdf` and performs no further scope mutation.
- The existing SHA-bound import sequence and backend path canonicalization remain the authority for library identity; native scope authorization alone cannot create a row or session.
- The existing cover pipeline still verifies source bytes against the row hash before cache write. A changed file may be readable but never becomes a cover under the old identity.
- ElevenLabs and Groq keys cross the typed IPC boundary once, remain only in native/in-memory client state for the current process, and are never serialized. Provider names, status, destinations, voices, and non-secret voice preferences may be exposed; credentials may not.
- Groq's destination and model are pinned in the native adapter. The WebView cannot supply a base URL, so adding Groq does not create an SSRF/general proxy surface.
- Connecting or switching performs only credential/model preflight. PDF-derived text remains behind public Play/Read from here, and a provider failure never triggers hidden fallback egress.
- Local TTS remains the exact native-config-owned loopback URL. Allowing it to remain connected while a cloud provider is active does not make the URL editable.

## Verification Order

1. Harness status and spec consistency.
2. Fail-first targeted Settings/scope tests.
3. Implement Slice A; run targeted frontend tests, typecheck, lint.
4. Implement Slice B; run targeted Rust tests with `--features test-mocks -j 1`, rustfmt, clippy.
5. Record the packaged geometry probe failing before Slice D, implement its CSS root fix, then rerun at all three widths.
6. Add fail-first typography/Sort-paint and drag-session contracts; implement Slices E/F and run targeted frontend/Rust checks.
7. Run the packaged legacy-profile, contrast/typography, geometry, and real OS-drag journeys serially.
8. Run the native chooser twice; prove one process/window and no GSettings abort.
9. Run outlined-PDF Back/Chapters/Fit Page/Ctrl+wheel/scale geometry at 640/1200/2560.
10. Run the live local-TTS latency/control journey: sentence order, one-ahead prefetch, Stop cancellation, estimated focus, queue-wide progress, selection offset, and exactly-once final completion.
11. Run the provider-registry and Groq adapter Rust contracts, frontend connection/persistence/switch tests, then the packaged public-controls multi-connection journey. If a vault Groq credential exists, run a bounded live 200-character WAV smoke without retaining the key or source text.
12. Run `make harness-check`, fuzz seed `20260825`, and `pnpm verify` before commit.
13. Obtain a different-family exact-head review; repair every BLOCKER/MAJOR.
14. Push, wait for the Pedro-gated workflow prerequisite, update the product PR, poll required CI green, squash-merge, and verify the merged state.

## Rollback

One squash revert removes the visible Settings callback, legacy file-grant restoration, responsive/type/control repairs, native drop orchestration, multi-provider registry/Groq adapter, packaged journeys, and spec receipt. It cannot delete sessions or exact-file grants a user already created while the feature was active; those remain ordinary user-owned app state and can be removed through the existing UI/profile controls. Cloud provider connections hold no durable credential state, so process exit or the revert itself leaves no key migration/cleanup.
