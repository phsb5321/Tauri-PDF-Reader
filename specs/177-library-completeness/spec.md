# Feature Specification: Complete Library and Reader Experience

**Feature Branch**: `177-library-completeness`
**Created**: 24/08/2026
**Last amended**: 25/08/2026
**Status**: Draft

## Outcome

A returning reader sees a complete library and can move into a coherent reader without dead ends: Settings and Library remain reachable, chapters are visible, known books recover their exact file grants and covers, and one dropped PDF creates an active reading session. The reader defaults to a whole-page view, offers adjustable comfortable-distance UI scale and Ctrl+wheel document zoom, and can keep Local TTS, ElevenLabs, and Groq narration connections ready together and switch the active one without restarting or re-entering a session credential. The same loopback Supertonic API as Proso retains sentence-pipelined first audio plus a synchronized read-along/progress clock. Missing books, invalid drops, unavailable outlines, disconnected providers, and model limitations remain honest rather than disappearing, silently falling back, or widening authority.

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

### User Story 7 — Move through a real book without dead ends (P1)

As a reader, I can visibly return to the Library, open the PDF's chapter outline, select text and choose “Read from here”, and zoom the document with Ctrl+wheel.

**Independent test**: open a real outlined PDF, activate Back to library and Chapters through their public controls, jump to an outline destination, select a later word and activate Read from here, then Ctrl+wheel in both directions while ordinary wheel scrolling remains unchanged.

### User Story 8 — Hear useful audio quickly with synchronized follow-along (P1)

As a reader using the desktop Proso-compatible local API, Play starts from a sentence-sized request instead of blocking on the whole page. While the local provider publishes no word marks, Lectrice derives duration-bound word estimates from the measured WAV so the in-page focus and bottom progress share the real audio clock.

**Independent test**: on the real Supertonic bridge, measure a cold first sentence and a full-page control, prove Play sends sentence zero first, prefetches only after the public action, advances sentences in source order, and never lets an old sink-finished event terminate the successor.

### User Story 9 — Read the interface from a comfortable desktop distance (P1)

As a reader, the default UI chrome is larger, I can adjust it from 100–150%, and the command bar, narration dock, page canvas, and chapter drawer retain one coherent visual rhythm without overflowing narrow windows.

**Independent test**: drive the Appearance slider and packaged reader at 640, 1200, and 1920/2560 widths, asserting computed scale, containment, semantic colours, a single-line command bar, one centered progress rail, and no debug pill over the book.

### User Story 10 — Keep several narration connections and switch instantly (P1)

As a reader, I can connect Local TTS, ElevenLabs, and Groq in the same app session, see which are ready, and choose which connected service narrates next without restarting Lectrice or entering the same key again.

**Independent test**: start with a configured local service, connect deterministic ElevenLabs and Groq fixtures through the public settings controls, switch among all connected services from Settings and the reader dock, and prove each subsequent narration request reaches only the selected service while the other connections remain ready.

**Acceptance scenarios**:

1. A connection list identifies every supported service as active, connected, unavailable, or requiring setup without treating one global status as all providers' status.
2. Connecting a second cloud service keeps the first and the configured local service ready.
3. Switching while narration is active stops and clears the current clip before changing the route; the next Play begins on the selected service and no old sentence continues.
4. Each service restores its own last selected voice when revisited.
5. Cloud credentials live only for the current native app process. Closing Lectrice requires cloud-key re-entry but retains non-secret voice preferences.

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
- **FR-017** — The root type scale MUST default to 125% of the user-agent preference and remain adjustable from 100–150% in Appearance; percentages MUST continue composing with browser/OS text preferences rather than replacing them with fixed pixels.
- **FR-018** — At the default 16px user-agent root, application body text MUST render at least 20 CSS px and ordinary controls/card titles at least 17.5 CSS px; scalable layout and spacing tokens MUST grow with that root.
- **FR-019** — Native Search and Sort controls MUST paint explicit semantic foreground and background colours in light and dark themes, with a measured contrast ratio of at least 4.5:1. The Sort control MUST opt out of a native painted face when that face can diverge from its CSS colours.
- **FR-020** — While one or more files hover over the app, a visible and accessibility-announced drop target MUST say that one PDF will create a reading session.
- **FR-021** — Dropping exactly one existing regular `.pdf` MUST rely on Tauri’s native exact-file drop authorization, then reuse the existing SHA-bound PDF parse and backend-canonicalized library registration flow. Lectrice MUST NOT add a custom arbitrary-path grant or byte-reading command.
- **FR-022** — A successful drop MUST create a reading session named from the verified document title (bounded to the existing 100-character session-name limit), activate it, open the verified document, and expose a dismissible public success status.
- **FR-023** — A known dropped document MUST preserve its existing row identity and saved page. A fresh dropped document MUST start on page 1. Neither case may duplicate the library document.
- **FR-024** — Zero-PDF, multi-file, directory, missing, or non-PDF drops MUST show a public error and MUST NOT create a session, library row, or visible document. Lectrice MUST perform no additional scope mutation: Tauri/plugin-fs grants native dropped paths before emitting the frontend event, an upstream behavior that predates this listener.
- **FR-025** — Repeated drop-listener mounts and unmounts MUST not leak subscriptions or process the same native drop more than once.
- **FR-026** — The packaged acceptance journey MUST perform a real operating-system file drag through visible controls; dispatching a synthetic hidden event or calling application state/IPC directly is not a passing actor journey.
- **FR-027** — An open document MUST expose visible, keyboard-reachable “Back to library” and “Chapters” actions. Returning home MUST keep the loaded document/page alive; chapter jumps MUST stop active narration before changing page.
- **FR-028** — Chapters MUST reuse the PDF.js outline, support numeric/reference/named destinations and nested items, identify the current page, and show an honest empty state when no outline exists.
- **FR-029** — The Linux dev shell MUST expose GTK and desktop GSettings schema roots through `XDG_DATA_DIRS`; opening and dismissing the real native file chooser MUST NOT abort or freeze Lectrice.
- **FR-030** — A newly opened portrait PDF MUST default to Fit Page, paint a white canvas before rendering, keep its selectable PDF.js text layer transparent, and retain explicit semantic reader-control colours.
- **FR-031** — The reader command bar and narration dock MUST remain contained at 640px. Secondary reader actions MAY be icon-first only when their accessible names/tooltips remain intact; the loaded title MUST be the flexible truncation target.
- **FR-032** — The desktop instance MUST use the exact loopback local-TTS origin `http://127.0.0.1:5301`, current Supertonic bridge capabilities, and a catalog-published voice; it MUST NOT claim GPU execution or native word marks that the live provider does not publish.
- **FR-033** — Local Play MUST preserve the public-action privacy boundary, split text at source-preserving sentence offsets, synthesize sentence zero first, and prebuffer only the next sentence after Play. Stop/new Play MUST invalidate stale queues, and auto-page MUST occur only after the final sentence.
- **FR-034** — When provider timings are absent but WAV duration is measured, Lectrice MUST derive deterministic duration-bound per-word estimates with original UTF-16 offsets. Estimated chunks MUST complete from the real sink-drained event, not a timer that can outrun audio; the in-page focus and bottom progress MUST use the same queue-wide clock.
- **FR-035** — Selecting text MUST expose “Read from here”. Narration MUST begin at the selection and rebase every selected-tail/sentence timing to the full PDF text-layer offset.
- **FR-036** — Ctrl/Cmd+wheel over the PDF MUST zoom in/out within 25–400%, clear fit mode like other manual zoom, and prevent only the modified wheel; ordinary wheel scrolling MUST remain native.
- **FR-037** — Production read-along MUST paint the active word in the PDF using semantic voice colours and MUST NOT render a floating developer/debug word pill.
- **FR-038** — Runtime acceptance MUST prove a single current Lectrice native window/process; an orphaned stale development process/window is not a passing interactive state.
- **FR-039** — Lectrice MUST keep independently connected Local TTS, ElevenLabs, and Groq services ready in one native app session and MUST distinguish the active connection from other connected services. Native config chooses the startup route; a cloud route without a current-process key starts in setup state, while configured Local TTS may connect without becoming a cloud fallback.
- **FR-040** — Settings MUST expose every supported narration connection and its state. When at least two services are connected, the reader dock MUST expose a keyboard-accessible active-connection selector.
- **FR-041** — Changing the active connection MUST stop current audio, cancel/invalidate queued or in-flight narration, clear stale read-along state, then route subsequent synthesis exclusively to the selected connected service. It MUST NOT require a restart or credential re-entry.
- **FR-042** — A failed connection or synthesis request MUST remain attached to its named service and MUST NOT silently fall back to or disconnect another service.
- **FR-043** — ElevenLabs and Groq credentials MUST remain memory-only inside their native provider clients for the current app process. The WebView key field MUST clear after connection. Credentials MUST NOT enter local/session storage, readable TTS config responses, SQLite, native config, logs, screenshots, or evidence. Restart MUST require cloud-key re-entry.
- **FR-044** — Each connection MUST retain its own non-secret selected voice while the narration speed and auto-page controls remain coherent across switches.
- **FR-045** — Groq narration MUST pin `canopylabs/orpheus-v1-english` at `https://api.groq.com/openai/v1/audio/speech`, expose the documented English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, and `troy`, and accept only bounded PCM16 WAV. The provider's 200-character contract MUST be enforced through a conservative 200-UTF-8-byte source-preserving chunk bound; a single grapheme that cannot fit MUST fail closed rather than truncate. Groq's streaming `u32::MAX` RIFF/data size sentinels MUST be normalized to bounded EOF-derived sizes before validation, cache, or playback. Because Groq publishes no native word marks, Lectrice MUST label and derive measured-duration read-along timing as estimated rather than provider-native.
- **FR-046** — The configured local service MUST retain the exact loopback trust boundary. A cloud connection MUST NOT make arbitrary local or remote destinations editable from the WebView.
- **FR-047** — Adding or switching a connection MUST send no PDF-derived text. Text may leave the app only after the reader activates public Play or Read from here.

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
- A reader connects Groq while Local TTS and ElevenLabs are already connected.
- A provider switch is requested while synthesis is loading, playing, or paused.
- The active provider disconnects or rejects a key while another provider remains healthy.
- A Groq sentence exceeds the provider's bounded request size or contains a single long token/multibyte text near that bound.
- The reader switches back to a provider whose prior voice is not in its latest voice catalog.
- The app restarts with saved non-secret provider voice preferences but no cloud credentials.

## Success Criteria

- **SC-001** — A packaged hermetic legacy-profile journey observes a visible Settings action and opens the existing Settings dialog through public controls.
- **SC-002** — In that journey, the readable legacy card reaches `ready`, the missing control reaches `fallback`, and neither stays indefinitely `loading`.
- **SC-003** — The same journey observes non-empty visible titles and accessible card names for both cards.
- **SC-004** — The persisted scope is absent before launch and present after the readable row is listed; it contains a file-specific grant, not a directory wildcard.
- **SC-005** — Targeted frontend, Rust, architecture, type, lint, and harness checks remain green without lowering any gate.
- **SC-006** — The packaged geometry probe fails if any title/content rectangle escapes its card or if dead space exceeds one spacing token.
- **SC-007** — The same probe observes one contained list column at narrow width, then at 2560×1080 no more than nine bounded grid columns and no horizontal overflow.
- **SC-008** — The packaged contrast probe records zero Search/Sort text violations in light and dark themes and verifies the Sort control has non-native appearance with semantic CSS foreground/background colours.
- **SC-009** — The packaged typography probe observes a 20px root/body at the default 16px user-agent setting and at least 17.5px library control/card text without horizontal overflow at 640×800.
- **SC-010** — A real file-manager drag of one PDF makes the drop target visible, opens the book, publishes a dismissible “Session … created” status, and the Sessions panel reports that same one-document session as active.
- **SC-011** — Non-PDF and multi-file negative controls create no session/library mutation and expose a readable error. The valid single-PDF journey proves the persisted drop scope is exact-file rather than directory/wildcard; no custom path-grant IPC exists.
- **SC-012** — The real native chooser opens and dismisses twice without `GLib-GIO-ERROR`, coredump, frozen loading state, or a duplicate Lectrice process/window.
- **SC-013** — A packaged outlined-PDF journey visibly opens Chapters, jumps to the expected page, closes the drawer, and then returns home through Back to library without re-reading the file.
- **SC-014** — Against `supertonic-1.3.1+proso-bridge.3`, a sentence-sized cold request reaches first audio in under 3 seconds (target median under 2 seconds), while the full-page control is recorded separately and never used as the first Play request.
- **SC-015** — The no-mark local journey observes non-empty fallback word timings, an advancing in-page word focus, and queue-wide bottom progress. Each sentence begins once, in source order; Stop produces no successor and final completion/auto-page occurs exactly once.
- **SC-016** — Read from here sends text beginning at the selected word and the first highlighted range intersects that word rather than page offset zero.
- **SC-017** — The packaged reader observes Fit Page on first open and Ctrl+wheel changes zoom in both directions while an unmodified wheel does not change zoom.
- **SC-018** — At UI scales 100%, 125%, and 150%, the 640/1200/2560 geometry matrix records no command-bar or dock horizontal overflow; the default root/body is 20px and Appearance changes it live.
- **SC-019** — Screenshot/DOM evidence contains no floating `.tts-word-debug`, uses one semantic active-word highlight, centers the active progress rail, and distinguishes application Settings from Voice settings.
- **SC-020** — `pnpm verify`, seeded fuzz, real packaged reader/drop/chooser/local-TTS journeys, and an exact-head different-family adversarial gate all pass without weakening or excluding an existing check.
- **SC-021** — A packaged public-controls journey connects ElevenLabs and Groq alongside configured Local TTS, observes three independent statuses, and switches the active connection in Settings and the reader dock without restart or repeated key entry.
- **SC-022** — A deterministic provider-routing oracle proves that after each switch only the selected service receives the next synthesis request; the previous clip/queue is stopped and no automatic provider fallback occurs.
- **SC-023** — Persistence and diagnostic canaries prove both cloud credentials are absent from Web storage, SQLite/config, logs, screenshots, and retained evidence while per-provider voice choices survive a frontend rehydrate.
- **SC-024** — Groq contract tests reject oversized input before dispatch, publish the six pinned English voices, normalize and validate a bounded streaming PCM16 WAV, preserve provider/revision cache isolation, and produce measured-duration estimated read-along data with no native-mark claim. The existing ElevenLabs timestamp/cache regression suites remain unchanged and green.
