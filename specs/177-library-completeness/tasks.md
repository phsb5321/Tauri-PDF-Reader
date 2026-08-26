# Tasks: Complete Library and Reader Experience

## Phase 1 — Fail-first contracts

- [x] T001 Add a shell/toolbar test proving a visible Settings action opens the existing dialog from the library home and reader surface.
- [x] T002 Add Rust tests for scope candidates: valid SHA-shaped row + canonical regular PDF accepted; missing, directory, non-PDF, and malformed-id rows rejected; already-allowed files not re-added.
- [x] T003 Add the packaged two-phase legacy-profile journey with a real readable fixture and a missing-file negative control; record the pre-fix failure.
- [x] T004 Extend the packaged home-audit probe with card/title/content geometry and 2560×1080 column assertions; record the pre-fix failure.

## Phase 2 — User-visible settings

- [x] T005 Add the Settings callback and accessible toolbar action using existing toolbar tokens and roving keyboard navigation.
- [x] T006 Wire the shared shell’s existing Settings state to the toolbar without duplicating the panel.

## Phase 3 — Legacy cover recovery

- [x] T007 Restore narrow canonical file grants for valid returned library rows before `library_list_documents` returns.
- [x] T008 Prove repeated lists do not re-add allowed paths and per-row scope failures do not hide other documents.
- [x] T009 Keep the existing cover source-size, SHA, cache, and fallback code unchanged; run its targeted regression tests.

## Phase 4 — Responsive card geometry

- [x] T010 Make grid rows content-sized and start-aligned; remove the duplicate wrapper aspect-ratio authority.
- [x] T011 Cap ultrawide grid tracks while preserving internal vertical scrolling, list mode, and no horizontal overflow.
- [x] T012 Run the grid geometry lane at 640×800, 1200×800, and 2560×1080 plus list mode at 640×800; retain the pre/post probe evidence.

## Phase 5 — Initial acceptance

- [x] T013 Run targeted frontend tests, typecheck, lint, targeted Rust tests, rustfmt, clippy, and `make harness-check`.
- [x] T014 Run the packaged legacy-profile journey and retain: Settings dialog open, real card `ready`, missing card `fallback`, non-empty visible/accessibility names, and file-specific persisted scope with no wildcard.
- [x] T015 Run `pnpm verify`, obtain a different-family exact-head review, and resolve every BLOCKER/MAJOR without weakening tests.

## Phase 6 — 25/08 user feedback: legibility and drag-to-session

- [x] T016 Add fail-first source/computed-style tests for a relative 112.5% root scale, enlarged body/control text floors, and a non-native Sort face with semantic foreground/background colours.
- [x] T017 Repair Search/Sort painted contrast in light and dark WebKitGTK themes; re-run the packaged contrast sweep and 640px geometry after increasing the type scale.
- [x] T018 Verify against pinned Tauri/plugin-fs source that native drop authorization happens before the frontend event; reject a duplicate arbitrary-path grant command and record the invalid-drop upstream scope limitation.
- [x] T019 Keep the typed IPC surface unchanged: no new drop grant/byte-read command and no generated-binding delta.
- [x] T020 Factor the existing hash-bound import flow into a native-authorized dropped-path entry point without weakening known-row progress, fresh-row double-hash, or final-read checks.
- [x] T021 Add a cleaned-up native drag/drop subscription, one-in-flight latch, visible drop target, readable invalid-drop error, and dismissible session-created status.
- [x] T022 On one valid drop, create and restore a one-document session named from the bounded verified title, open the book, and prove repeated/invalid drops do not duplicate or mutate.
- [x] T023 Run targeted frontend tests, typecheck, lint, fuzz seed `20260825`, and `make harness-check` (the final full gate owns rustfmt/clippy; no Rust source changed in this follow-up).
- [x] T024 Run a packaged real OS file-manager drag through visible controls; retain the drop-target, active-session, exact-scope, reader, negative-control, and anomaly evidence.

## Phase 7 — First delivery checkpoint

- [x] T025 Run `pnpm verify`, obtain a different-family exact-head review, and resolve every BLOCKER/MAJOR without weakening tests.

## Phase 8 — Native stability and reader navigation

- [x] T026 Reproduce the native chooser abort, retain the GSettings stack trace, bridge Nix's `GSETTINGS_SCHEMAS_PATH` into `XDG_DATA_DIRS`, and prove the real chooser opens/closes without killing the app.
- [x] T027 Add Back to library and Chapters as public roving-toolbar actions; preserve the loaded page on return home and stop active TTS before an outline jump.
- [x] T028 Reuse and harden the dormant PDF.js outline UI, including numeric destinations, `aria-current`, contextual expand state, close-after-jump, and targeted tests.

## Phase 9 — Reader visuals and scale

- [x] T029 Default new books to Fit Page, prepaint the opaque canvas white, theme the zoom select, expose the cache rail, and keep the PDF.js text-layer styling authoritative.
- [x] T030 Add a persisted 100–150% Appearance slider with a 125% desktop default; convert shared layout/spacing and core control dimensions to rem so component chrome grows with text.
- [x] T031 Replace the crowded labeled reader row with icon-first public actions, a flexible title, narrow-mode control collapse, a centered narration dock, a distinct Voice settings action, and an in-page semantic read-along focus with no debug pill.

## Phase 10 — Local narration responsiveness and synchronization

- [x] T032 Verify the desktop instance uses `supertonic-1.3.1+proso-bridge.3` at exact loopback `127.0.0.1:5301`, voice `F1-en`, CPU inference, 20 voices, no native marks, and no active Magpie/Qwen route.
- [x] T033 Measure cold first-sentence versus full-page synthesis (1.85s versus 46.49s control) and implement public-action-gated sentence-zero playback with one-sentence-ahead cache prefetch.
- [x] T034 Build measured-duration per-word fallback timings for no-mark local audio and one queue-wide progress count; rebase sentence marks to their full-page UTF-16 offsets.
- [x] T035 Prevent estimated timers from outrunning the real sink event into the next sentence; invalidate the sentence queue on Stop/new Play and prove ordered cache-hit continuation.
- [x] T036 Add “Read from here” to the selection toolbar, carry selected-tail/base offset through autoplay, and add Ctrl/Cmd+wheel document zoom with unmodified scrolling preserved.
- [x] T037 Remove the orphaned stale Lectrice process/window discovered during live testing and prove the clean current process performs cache-hit sentence playback, advances the overlay, and reports queue-wide progress.

## Phase 11 — Final acceptance and delivery

- [ ] T038 Update the packaged user gate for Back, Chapters, Fit Page, Ctrl+wheel, 100/125/150% scale geometry, sentence order/latency, fallback focus/progress, selection offset, chooser survival, and one-process/window truth.
- [x] T039 Run targeted suites, full `pnpm verify`, fuzz seed `20260825`, packaged native journeys, and retain durable screenshots/timing receipts.
- [ ] T040 Obtain an exact-head different-family adversarial gate, resolve every BLOCKER/MAJOR, push the updated PR, then wait for Pedro-gated workflow PR #181 before updating #178 and rerunning its trust anchor.
- [ ] T041 Poll every required check green, squash-merge #178, verify `state=MERGED`, update the backlog/fleet receipts, and run the fleet done oracle.

## Phase 12 — Multiple narration connections and live provider switching

- [x] T042 Add fail-first store/UI tests for three independent connection states, active-versus-connected semantics, per-provider voice restoration, and cloud-key absence from every persisted payload.
- [x] T043 Add fail-first Rust contracts for a provider registry that retains Local/ElevenLabs/Groq simultaneously, timeout-bounds pending-synthesis Stop/switch, rejects switching to a disconnected provider, uses one provider snapshot for cache+synthesis, and never falls back after provider failure.
- [x] T044 Implement the pinned Groq Orpheus adapter with bearer model preflight, six documented English voices, a conservative 200-UTF-8-byte bound, a 16 MiB response ceiling, streaming-RIFF sentinel normalization, strict PCM16 validation, measured duration, and no native timing marks.
- [x] T045 Add typed Groq-connect/provider-switch commands, regenerate bindings, and allow native-config-owned Local TTS to connect while another provider is startup-active without accepting a WebView URL.
- [x] T046 Extend the AI TTS store/hook with runtime connected-provider state and persisted per-provider voice IDs; make switching cancel playback/queues/highlights before restoring the target voices and speed.
- [x] T047 Replace the single-provider setup panel with an accessible Connections list and detail panel, then add the connected-provider selector to the reader dock.
- [x] T048 Generalize source-preserving sentence playback/prefetch to every provider without native marks and split Groq spans within its request bound without drifting UTF-16 highlight offsets.
- [x] T049 Run targeted frontend/Rust contracts, seeded fuzz `20260825`, the `e2e-tts-fixture` packaged public-controls multi-connection/switching journey, a bounded live Groq WAV smoke from rbw, full `pnpm verify`, and retain secret-free evidence before the exact-head different-family gate.
