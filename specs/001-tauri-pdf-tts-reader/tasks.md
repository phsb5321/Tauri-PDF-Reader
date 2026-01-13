# Tasks: Tauri PDF Reader with TTS and Highlights

**Input**: Design documents from `/specs/001-tauri-pdf-tts-reader/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle IV (Test Coverage) - critical paths have automated test coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React/TypeScript)
- **Backend**: `src-tauri/src/` (Rust)
- Structure follows plan.md specifications

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Tauri 2.x scaffolding

- [X] T001 Initialize Tauri 2.x project with React/TypeScript template
- [X] T002 [P] Configure pnpm workspace in pnpm-workspace.yaml
- [X] T003 [P] Configure TypeScript strict mode in tsconfig.json
- [X] T004 [P] Configure Vite for pdf.js worker exclusion in vite.config.ts
- [X] T005 [P] Add frontend dependencies (React 18, Zustand, Zod, pdfjs-dist) in package.json
- [X] T006 [P] Add Rust dependencies (tauri-plugin-sql, sha2, uuid, chrono) in src-tauri/Cargo.toml
- [X] T007 [P] Add optional TTS feature flag (tts crate) in src-tauri/Cargo.toml
- [X] T008 Configure Tauri plugins (dialog, fs, sql, shell) in src-tauri/tauri.conf.json
- [X] T009 [P] Configure ESLint with TypeScript rules in eslint.config.js
- [X] T010 [P] Configure logging with tracing and env-filter in src-tauri/src/main.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database Layer

- [X] T011 Create database module structure in src-tauri/src/db/mod.rs
- [X] T012 Define Document model with serde in src-tauri/src/db/models.rs
- [X] T013 [P] Define Highlight model with serde in src-tauri/src/db/models.rs
- [X] T014 [P] Define Settings key-value model in src-tauri/src/db/models.rs
- [X] T015 Create SQLite schema migration (documents, highlights, settings tables) in src-tauri/src/db/migrations/001_initial.sql
- [X] T016 Implement migration runner in src-tauri/src/db/schema.rs
- [X] T017 Configure SQLite PRAGMAs (WAL, foreign keys, cache) in src-tauri/src/db/mod.rs
- [X] T018 Initialize database in Tauri setup hook in src-tauri/src/lib.rs

### Frontend Type System

- [X] T019 Create Zod schemas (Document, Highlight, Rect, Settings) in src/lib/schemas.ts
- [X] T020 [P] Create type-safe Tauri invoke wrapper in src/lib/tauri-invoke.ts
- [X] T021 [P] Create base Zustand store setup in src/stores/document-store.ts

### Core Layout

- [X] T022 Create app root component with routing in src/App.tsx
- [X] T023 [P] Create base layout component with header and content area in src/components/layout/AppLayout.tsx
- [X] T024 [P] Create global styles and CSS variables in src/index.css

### Test Infrastructure

- [X] T024a Configure Vitest for frontend unit tests in vitest.config.ts
- [ ] T024b [P] Configure cargo test structure in src-tauri/src/lib.rs
- [X] T024c [P] Create test utilities and mocks directory in tests/

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Open and Read a PDF (Priority: P1)

**Goal**: Users can open local PDFs and navigate through pages with zoom controls

**Independent Test**: Open any PDF, navigate pages, zoom in/out - delivers value as a functional PDF viewer

### Backend: Library Commands

- [X] T025 [US1] Implement SHA-256 document hashing in src-tauri/src/commands/library.rs
- [X] T026 [US1] Implement library_open_document command in src-tauri/src/commands/library.rs
- [X] T027 [P] [US1] Implement library_get_document command in src-tauri/src/commands/library.rs
- [X] T028 [P] [US1] Implement library_list_documents command in src-tauri/src/commands/library.rs
- [X] T029 [US1] Register library commands in Tauri handler in src-tauri/src/lib.rs

### Frontend: PDF Viewer

- [X] T030 [US1] Create PDF document loader using pdf.js in src/lib/pdf-utils.ts
- [ ] T031 [US1] Create PDF page renderer component in src/components/pdf-viewer/PdfPage.tsx
- [X] T032 [US1] Create PDF text layer component for selection in src/components/TextLayer.tsx
- [X] T033 [US1] Create PDF viewer container with canvas in src/components/pdf-viewer/PdfViewer.tsx
- [X] T034 [US1] Create page navigation controls component in src/components/pdf-viewer/PageControls.tsx
- [X] T035 [P] [US1] Create zoom controls component in src/components/pdf-viewer/ZoomControls.tsx
- [X] T036 [US1] Create go-to-page input component in src/components/pdf-viewer/GoToPage.tsx

### Frontend: State Management

- [X] T037 [US1] Implement document store (currentDocument, pageNumber, zoom) in src/stores/document-store.ts
- [X] T038 [US1] Add library command wrappers (libraryOpenDocument, libraryGetDocument, etc.) to src/lib/tauri-invoke.ts
- [X] T039 [US1] Add file open dialog integration using tauri-plugin-dialog in src/components/pdf-viewer/OpenButton.tsx

### Integration

- [X] T040 [US1] Create main reader view composing PDF viewer and controls in src/components/reader/ReaderView.tsx
- [X] T041 [US1] Add keyboard shortcuts for navigation (arrow keys, Page Up/Down) in src/hooks/useKeyboardNavigation.ts

### Tests for User Story 1 (Constitution IV)

- [ ] T041a [P] [US1] Contract test for library_open_document in tests/contract/test_library.rs
- [ ] T041b [P] [US1] Contract test for library_get_document in tests/contract/test_library.rs
- [ ] T041c [US1] Integration test for PDF open flow in tests/integration/test_pdf_open.ts

**Checkpoint**: User Story 1 complete - users can open and navigate PDFs

---

## Phase 4: User Story 2 - Listen to PDF with Text-to-Speech (Priority: P1)

**Goal**: Users can have PDF content read aloud with visual tracking

**Independent Test**: Open any PDF, press play - audio starts and current position is visually indicated

### Backend: TTS Engine

- [X] T042 [US2] Create TTS state struct with Mutex-protected engine in src-tauri/src/tts/engine.rs
- [X] T043 [US2] Implement tts_init command in src-tauri/src/commands/tts.rs
- [X] T044 [P] [US2] Implement tts_list_voices command in src-tauri/src/commands/tts.rs
- [X] T045 [US2] Implement tts_speak command with chunking in src-tauri/src/commands/tts.rs
- [ ] T046 [US2] Implement tts_speak_long with events in src-tauri/src/commands/tts.rs
- [X] T047 [P] [US2] Implement tts_stop command in src-tauri/src/commands/tts.rs
- [X] T048 [P] [US2] Implement tts_pause and tts_resume commands in src-tauri/src/commands/tts.rs
- [X] T049 [P] [US2] Implement tts_set_voice command in src-tauri/src/commands/tts.rs
- [X] T050 [P] [US2] Implement tts_set_rate command in src-tauri/src/commands/tts.rs
- [X] T051 [P] [US2] Implement tts_get_state command in src-tauri/src/commands/tts.rs
- [X] T052 [US2] Register TTS commands (feature-gated) in src-tauri/src/lib.rs

### Frontend: Text Extraction

- [X] T053 [US2] Implement PDF text extraction using pdf.js getTextContent in src/lib/pdf-utils.ts
- [X] T054 [US2] Implement sentence-based text chunking utility in src/lib/text-chunking.ts

### Frontend: TTS Controls

- [X] T055 [US2] Create TTS store (isPlaying, isPaused, currentChunk, rate, voice) in src/stores/tts-store.ts
- [X] T056 [US2] Create playback bar component (play/pause/stop buttons) in src/components/playback-bar/PlaybackBar.tsx
- [X] T056a [US2] Create next/previous chunk navigation buttons (FR-009) in src/components/playback-bar/ChunkNavigation.tsx
- [X] T057 [P] [US2] Create voice selector dropdown in src/components/playback-bar/VoiceSelector.tsx
- [X] T058 [P] [US2] Create speed slider component in src/components/playback-bar/SpeedSlider.tsx
- [X] T059 [US2] Add TTS command wrappers (ttsInit, ttsSpeak, ttsStop, etc.) to src/lib/tauri-invoke.ts

### Visual Tracking

- [X] T060 [US2] Create TTS highlight overlay component in src/components/pdf-viewer/TtsHighlight.tsx
- [X] T061 [US2] Implement word-position estimation for visual tracking in src/lib/tts-tracking.ts
- [X] T062 [US2] Subscribe to TTS events (chunk-started, completed) in src/hooks/useTtsEvents.ts

### Integration

- [X] T063 [US2] Integrate playback bar into reader view in src/components/reader/ReaderView.tsx
- [X] T064 [US2] Add keyboard shortcuts for TTS (Ctrl+Space to play/pause, Esc to stop) in src/components/playback-bar/PlaybackBar.tsx

### Tests for User Story 2 (Constitution IV)

- [ ] T064a [P] [US2] Contract test for tts_init and tts_speak in tests/contract/test_tts.rs
- [ ] T064b [P] [US2] Unit test for text chunking utility in tests/unit/test_text_chunking.ts
- [ ] T064c [US2] Integration test for TTS playback flow in tests/integration/test_tts_playback.ts

**Checkpoint**: User Story 2 complete - users can listen to PDFs with TTS

---

## Phase 5: User Story 3 - Create and Manage Highlights (Priority: P2)

**Goal**: Users can highlight text with colors and add notes

**Independent Test**: Select text, apply highlight - highlight persists after restart and appears in highlights panel

### Backend: Highlights Commands

- [X] T065 [US3] Implement highlights_create command in src-tauri/src/commands/highlights.rs
- [X] T066 [P] [US3] Implement highlights_batch_create command in src-tauri/src/commands/highlights.rs
- [X] T067 [P] [US3] Implement highlights_list_for_page command in src-tauri/src/commands/highlights.rs
- [X] T068 [P] [US3] Implement highlights_list_for_document command in src-tauri/src/commands/highlights.rs
- [X] T069 [US3] Implement highlights_update command in src-tauri/src/commands/highlights.rs
- [X] T070 [P] [US3] Implement highlights_delete command in src-tauri/src/commands/highlights.rs
- [X] T071 [US3] Register highlights commands in src-tauri/src/lib.rs

### Frontend: Highlight Creation

- [X] T072 [US3] Implement text selection capture using Selection API in src/hooks/useTextSelection.ts
- [X] T073 [US3] Convert selection to PDF coordinates in src/lib/pdf-utils.ts
- [X] T074 [US3] Create highlight toolbar popup (color picker) in src/components/pdf-viewer/HighlightToolbar.tsx
- [X] T075 [US3] Create highlight overlay canvas layer in src/components/pdf-viewer/HighlightOverlay.tsx

### Frontend: State Management

- [X] T076 [US3] Extend document store with highlights array in src/stores/document-store.ts
- [X] T077 [US3] Add highlights command wrappers (highlightsCreate, highlightsUpdate, etc.) to src/lib/tauri-invoke.ts
- [X] T078 [US3] Add debounced highlight save logic in src/hooks/useHighlightPersistence.ts

### Highlight Management

- [X] T079 [US3] Create highlight context menu (change color, add note, delete) in src/components/pdf-viewer/HighlightContextMenu.tsx
- [X] T080 [US3] Create note editor modal in src/components/highlights/NoteEditor.tsx
- [X] T081 [US3] Create highlights panel sidebar in src/components/sidebar/HighlightsPanel.tsx
- [X] T082 [US3] Add click-to-navigate from highlight panel to page in src/components/sidebar/HighlightsPanel.tsx

**Checkpoint**: User Story 3 complete - users can create, edit, and manage highlights

---

## Phase 6: User Story 4 - Resume Reading from Last Position (Priority: P2)

**Goal**: Reading progress auto-saves and restores on reopen

**Independent Test**: Open PDF, navigate to page 50, close app, reopen - resumes at page 50

### Backend: Progress Persistence

- [X] T083 [US4] Implement library_update_progress command in src-tauri/src/commands/library.rs
- [X] T084 [US4] Add last_tts_chunk_id tracking to progress update in src-tauri/src/commands/library.rs

### Frontend: Auto-Save

- [X] T085 [US4] Implement auto-save hook (30s interval + on significant actions) in src/hooks/useAutoSave.ts
- [X] T086 [US4] Implement progress restore on document open in src/stores/document-store.ts

### Crash Recovery

- [ ] T087 [US4] Implement clean shutdown detection in settings in src-tauri/src/services/recovery.rs
- [ ] T088 [US4] Create recovery prompt dialog component in src/components/dialogs/RecoveryPrompt.tsx
- [ ] T089 [US4] Check for unclean shutdown on app startup in src/App.tsx

**Checkpoint**: User Story 4 complete - reading progress persists automatically

---

## Phase 7: User Story 5 - Manage Document Library (Priority: P3)

**Goal**: Users can view and organize their PDF collection

**Independent Test**: Import multiple PDFs - they appear in library with progress indicators

### Backend: Library Management

- [X] T090 [US5] Implement library_update_title command in src-tauri/src/commands/library.rs
- [X] T091 [P] [US5] Implement library_remove_document command in src-tauri/src/commands/library.rs
- [X] T092 [P] [US5] Implement library_check_file_exists command in src-tauri/src/commands/library.rs
- [X] T093 [P] [US5] Implement library_relocate_document command in src-tauri/src/commands/library.rs

### Frontend: Library View

- [X] T094 [US5] Create library store in src/stores/library-store.ts
- [X] T095 [US5] Create library grid/list view component in src/components/library/LibraryView.tsx
- [X] T096 [P] [US5] Create document card component (thumbnail, title, progress) in src/components/library/DocumentCard.tsx
- [X] T097 [P] [US5] Create library search bar in src/components/library/SearchBar.tsx
- [ ] T098 [US5] Create document context menu (rename, remove, relocate) in src/components/library/DocumentContextMenu.tsx
- [ ] T099 [US5] Create title edit dialog in src/components/dialogs/EditTitleDialog.tsx
- [ ] T100 [US5] Create file relocate dialog in src/components/dialogs/RelocateDialog.tsx

### Integration

- [ ] T101 [US5] Add library route and navigation in src/App.tsx
- [X] T102 [US5] Show "File not found" state for missing files in src/components/library/DocumentCard.tsx

**Checkpoint**: User Story 5 complete - users can manage their document library

---

## Phase 8: User Story 6 - Follow-Along Reading Mode (Priority: P3)

**Goal**: Display auto-scrolls to follow TTS reading position

**Independent Test**: Enable follow-along, start TTS - view scrolls to keep current position visible

### Frontend: Follow-Along

- [X] T103 [US6] Extend TTS store with followAlong toggle in src/stores/tts-store.ts
- [X] T104 [US6] Implement auto-scroll logic synced to TTS position in src/hooks/useFollowAlong.ts
- [X] T105 [US6] Add follow-along toggle to playback bar in src/components/playback-bar/PlaybackBar.tsx
- [X] T106 [US6] Implement auto-page-turn when TTS crosses page boundary in src/hooks/useFollowAlong.ts
- [X] T107 [US6] Pause follow-along on manual scroll, resume on user action in src/hooks/useFollowAlong.ts

**Checkpoint**: User Story 6 complete - TTS playback has visual follow-along

---

## Phase 9: User Story 7 - Export Highlights and Notes (Priority: P4)

**Goal**: Users can export highlights to Markdown or JSON

**Independent Test**: Create highlights, export - file contains all highlights with correct page references

### Backend: Export

- [X] T108 [US7] Implement highlights_export command (markdown format) in src-tauri/src/commands/highlights.rs
- [X] T109 [P] [US7] Implement highlights_export command (JSON format) in src-tauri/src/commands/highlights.rs

### Frontend: Export UI

- [X] T110 [US7] Create export button in highlights panel in src/components/sidebar/HighlightsPanel.tsx
- [X] T111 [US7] Create export format dialog in src/components/dialogs/ExportDialog.tsx
- [X] T112 [US7] Implement file save dialog integration in src/components/dialogs/ExportDialog.tsx

**Checkpoint**: User Story 7 complete - highlights can be exported

---

## Phase 10: User Story 8 - Configure TTS and Appearance Settings (Priority: P4)

**Goal**: Users can customize voice, speed, colors, and shortcuts

**Independent Test**: Change settings - they persist and affect behavior

### Backend: Settings

- [X] T113 [US8] Implement settings_get command in src-tauri/src/commands/settings.rs
- [X] T114 [P] [US8] Implement settings_set command in src-tauri/src/commands/settings.rs
- [X] T115 [P] [US8] Implement settings_get_all command in src-tauri/src/commands/settings.rs
- [X] T116 [US8] Register settings commands in src-tauri/src/lib.rs

### Frontend: Settings

- [X] T117 [US8] Create settings store in src/stores/settings-store.ts
- [X] T118 [US8] Create settings panel component in src/components/settings/SettingsPanel.tsx
- [X] T119 [P] [US8] Create TTS settings section (voice, speed defaults) in src/components/settings/TtsSettings.tsx
- [X] T120 [P] [US8] Create highlight settings section (color palette) in src/components/settings/HighlightSettings.tsx
- [X] T121 [P] [US8] Create keyboard shortcuts reference section in src/components/settings/KeyboardShortcuts.tsx
- [X] T122 [P] [US8] Create theme toggle (light/dark/system) in src/components/settings/ThemeToggle.tsx
- [X] T123 [US8] Implement theme switching with CSS variables in src/hooks/useTheme.ts

### Telemetry Settings

- [X] T124 [P] [US8] Create telemetry opt-in section in src/components/settings/TelemetrySettings.tsx
- [X] T125 [US8] Create "What we collect" disclosure dialog in src/components/dialogs/TelemetryDisclosure.tsx

### Backend: Telemetry (FR-035, FR-036)

- [ ] T125a [US8] Implement telemetry_set_consent command in src-tauri/src/commands/telemetry.rs
- [ ] T125b [P] [US8] Implement local event buffering for offline telemetry in src-tauri/src/services/telemetry.rs
- [ ] T125c [US8] Register telemetry commands in src-tauri/src/lib.rs

**Checkpoint**: User Story 8 complete - full settings customization available

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Table of Contents

- [X] T126 [P] Create TOC sidebar component (FR-005) in src/components/sidebar/TableOfContents.tsx
- [X] T127 [P] Extract PDF outline using pdf.js in src/services/pdf-service.ts

### Observability

- [X] T128 [P] Implement structured logging in Rust backend in src-tauri/src/services/logging.rs
- [X] T129 [P] Create "Copy debug logs" action (FR-034) in src/components/settings/DebugLogs.tsx

### Edge Cases

- [X] T130 Handle scanned PDFs (no text) gracefully with TTS unavailable message in src/components/pdf-viewer/PdfViewer.tsx
- [X] T131 Handle missing TTS voice fallback to system default in src-tauri/src/tts/engine.rs
- [X] T132 Implement large PDF virtualization (1000+ pages) in src/components/pdf-viewer/PdfViewer.tsx
- [X] T133 Handle TTS text chunk length limits in src-tauri/src/tts/engine.rs

### Performance

- [X] T134 Implement page pre-rendering for adjacent pages in src/components/pdf-viewer/PdfViewer.tsx
- [X] T135 Add loading states and skeleton UI in src/components/common/LoadingState.tsx

### Final Validation

- [X] T136 Verify performance targets (SC-001 through SC-008)
- [X] T137 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational completion
  - US1 (P1) and US2 (P1) are both MVP critical
  - US3-US8 can proceed after US1/US2
- **Polish (Phase 11)**: Can start after US1 complete, finish after all stories

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|-----------|-----------------|
| US1 (Open PDF) | Foundational | Phase 2 complete |
| US2 (TTS) | Foundational | Phase 2 complete |
| US3 (Highlights) | US1 (needs PDF viewer) | Phase 3 complete |
| US4 (Progress) | US1 (needs document tracking) | Phase 3 complete |
| US5 (Library) | US1 (needs documents) | Phase 3 complete |
| US6 (Follow-Along) | US2 (needs TTS) | Phase 4 complete |
| US7 (Export) | US3 (needs highlights) | Phase 5 complete |
| US8 (Settings) | Foundational | Phase 2 complete |

### Within Each User Story

- Backend commands before frontend integration
- Models/schemas before services
- Services before UI components
- Core functionality before enhancements

### Parallel Opportunities

**Setup (Phase 1)**:
- T002-T007, T009-T010 can all run in parallel

**Foundational (Phase 2)**:
- T012-T014, T019-T021, T023-T024 can run in parallel

**User Story 1**:
- T027-T028, T035 can run in parallel
- Launch together: T030, T037

**User Story 2**:
- T044, T047-T051, T057-T058 can run in parallel

**User Story 3**:
- T066-T068, T070 can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all parallelizable setup tasks together:
Task: "Configure pnpm workspace in pnpm-workspace.yaml"
Task: "Configure TypeScript strict mode in tsconfig.json"
Task: "Configure Vite for pdf.js worker exclusion in vite.config.ts"
Task: "Add frontend dependencies in package.json"
Task: "Add Rust dependencies in src-tauri/Cargo.toml"
Task: "Add optional TTS feature flag in src-tauri/Cargo.toml"
Task: "Configure ESLint in eslint.config.js"
Task: "Configure logging in src-tauri/src/main.rs"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Open and Read PDF)
4. **VALIDATE**: Test PDF opening, navigation, zoom
5. Complete Phase 4: User Story 2 (TTS)
6. **VALIDATE**: Test TTS playback with visual tracking
7. Deploy/demo MVP

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 + US2 = Functional PDF reader with TTS
2. **+Highlights**: Add US3 = Annotation capability
3. **+Progress**: Add US4 = Session persistence
4. **+Library**: Add US5 = Multi-document management
5. **+Polish**: Add US6-US8 + Phase 11 = Full-featured app

### Parallel Team Strategy

With multiple developers after Foundational phase:
- Developer A: User Story 1 → User Story 3 → User Story 7
- Developer B: User Story 2 → User Story 6
- Developer C: User Story 4 → User Story 5 → User Story 8
- All: Phase 11 Polish tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- TTS commands are feature-gated with `#[cfg(feature = "native-tts")]`
- All backend types use `#[serde(rename_all = "camelCase")]` for frontend compatibility
