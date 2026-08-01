# Tasks: Tauri PDF Reader

**Input**: Design documents from `/specs/044-tauri-pdf-reader/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Project Location**: New standalone project (separate from VoxPage extension)

**Tests**: No explicit test requirements in spec. Tests marked as optional but recommended for critical paths.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a Tauri project with the following structure:
- **Rust backend**: `src-tauri/src/`
- **TypeScript frontend**: `src/`
- **Tests**: `tests/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create new Tauri project and configure build toolchain

- [X] T001 Create Tauri project with React+TypeScript template using `pnpm create tauri-app tauri-pdf-reader --template react-ts`
- [X] T002 Configure Rust dependencies in src-tauri/Cargo.toml (tauri, tauri-plugin-sql, tauri-plugin-dialog, tauri-plugin-fs, tts, serde, uuid)
- [X] T003 [P] Configure frontend dependencies in package.json (pdfjs-dist, zustand, zod)
- [X] T004 [P] Configure TypeScript strict mode in tsconfig.json
- [X] T005 [P] Configure Vite for PDF.js worker handling in vite.config.ts
- [X] T006 Create Tauri capabilities file src-tauri/capabilities/default.json with fs, dialog, sql permissions
- [X] T007 Configure CSP in src-tauri/tauri.conf.json to allow asset: and blob: protocols
- [X] T008 [P] Create project README.md with setup instructions

**Checkpoint**: `pnpm tauri dev` launches empty app window

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database & Rust Infrastructure

- [X] T009 Create Rust module structure: src-tauri/src/commands/mod.rs, src-tauri/src/db/mod.rs
- [X] T010 Initialize tauri-plugin-sql in src-tauri/src/main.rs
- [X] T011 Create database models in src-tauri/src/db/models.rs (Document, Highlight, Rect structs)
- [X] T012 Create database migrations in src-tauri/src/db/migrations.rs (documents, highlights, app_settings tables)
- [X] T013 Implement database initialization function in src-tauri/src/db/mod.rs

### Frontend Infrastructure

- [X] T014 [P] Configure PDF.js worker in src/lib/pdf.ts
- [X] T015 [P] Create typed IPC wrapper in src/lib/tauri-invoke.ts
- [X] T016 [P] Create Zod validation schemas in src/lib/schemas.ts (Document, Highlight, Rect, Settings)
- [X] T017 [P] Create constants file in src/lib/constants.ts (highlight colors, default settings)
- [X] T018 Create document store with Zustand in src/stores/document-store.ts
- [X] T019 [P] Create settings store in src/stores/settings-store.ts
- [X] T020 Create base App layout in src/App.tsx with header/main areas

**Checkpoint**: Foundation ready - `pnpm tauri dev` runs, database initializes on startup, stores are accessible

---

## Phase 3: User Story 1 - Open and View Local PDF (Priority: P1) MVP

**Goal**: Users can open a local PDF file and view all pages with navigation and zoom

**Independent Test**: Open any local PDF via file dialog, verify all pages render with text visible, navigate between pages, zoom in/out

### Rust Backend for US1

- [X] T021 [US1] Implement library_add_document command in src-tauri/src/commands/library.rs
- [X] T022 [US1] Implement library_get_document command in src-tauri/src/commands/library.rs
- [X] T023 [US1] Implement library_get_document_by_path command in src-tauri/src/commands/library.rs
- [X] T024 [US1] Implement library_update_progress command in src-tauri/src/commands/library.rs
- [X] T025 [US1] Implement library_update_document command in src-tauri/src/commands/library.rs
- [X] T026 [US1] Register library commands in src-tauri/src/main.rs invoke_handler

### Frontend Services for US1

- [X] T027 [US1] Create library-service.ts in src/services/library-service.ts (addDocument, getDocument, updateProgress)
- [X] T028 [US1] Create pdf-service.ts in src/services/pdf-service.ts (loadDocument, renderPage, getPageText)

### Frontend Components for US1

- [X] T029 [US1] Create Toolbar component in src/components/Toolbar.tsx (Open button, page navigation, zoom controls)
- [X] T030 [US1] Create PdfViewer component in src/components/PdfViewer.tsx (canvas rendering, text layer)
- [X] T031 [US1] Create PageNavigation component in src/components/PageNavigation.tsx (prev/next, page input, total pages)
- [X] T032 [US1] Create ZoomControls component in src/components/ZoomControls.tsx (fit width, fit page, percentage)
- [X] T033 [US1] Implement file open dialog integration in src/components/Toolbar.tsx using @tauri-apps/plugin-dialog
- [X] T034 [US1] Integrate PDF viewer into App.tsx with document store binding

### US1 Integration

- [X] T035 [US1] Implement asset protocol PDF loading with convertFileSrc in src/services/pdf-service.ts
- [X] T036 [US1] Add reading progress persistence (save current page on navigation) in src/components/PdfViewer.tsx
- [X] T037 [US1] Handle edge cases: password-protected PDFs, corrupt files, no text layer in src/services/pdf-service.ts

**Checkpoint**: User Story 1 complete - Can open PDFs, navigate pages, zoom, progress saved

---

## Phase 4: User Story 2 - Select Text and Create Highlights (Priority: P2)

**Goal**: Users can select text and create persistent colored highlights

**Independent Test**: Select text in PDF, click Highlight button, verify highlight appears. Close/reopen document, verify highlight persists.

### Rust Backend for US2

- [ ] T038 [P] [US2] Implement highlights_create command in src-tauri/src/commands/highlights.rs
- [ ] T039 [P] [US2] Implement highlights_get command in src-tauri/src/commands/highlights.rs
- [ ] T040 [P] [US2] Implement highlights_list_for_document command in src-tauri/src/commands/highlights.rs
- [ ] T041 [P] [US2] Implement highlights_list_for_page command in src-tauri/src/commands/highlights.rs
- [ ] T042 [P] [US2] Implement highlights_update command in src-tauri/src/commands/highlights.rs
- [ ] T043 [P] [US2] Implement highlights_delete command in src-tauri/src/commands/highlights.rs
- [ ] T044 [US2] Register highlights commands in src-tauri/src/main.rs invoke_handler

### Frontend Services for US2

- [ ] T045 [US2] Create highlight-service.ts in src/services/highlight-service.ts (create, list, update, delete)
- [ ] T046 [US2] Implement selection rect extraction in src/lib/selection-utils.ts (getSelectionRects, getSelectionText)

### Frontend Components for US2

- [ ] T047 [US2] Create HighlightLayer component in src/components/HighlightLayer.tsx (render highlight overlays)
- [ ] T048 [US2] Create HighlightToolbar component in src/components/HighlightToolbar.tsx (color picker, highlight button)
- [ ] T049 [US2] Create HighlightContextMenu component in src/components/HighlightContextMenu.tsx (delete, change color)
- [ ] T050 [US2] Integrate HighlightLayer into PdfViewer.tsx with page-level rendering

### US2 Integration

- [ ] T051 [US2] Add text selection handling in PdfViewer.tsx (detect selection, show toolbar)
- [ ] T052 [US2] Implement highlight creation flow: selection → getSelectionRects → create highlight → render overlay
- [ ] T053 [US2] Load existing highlights when document opens in PdfViewer.tsx
- [ ] T054 [US2] Handle coordinate scaling for zoom changes in HighlightLayer.tsx

**Checkpoint**: User Story 2 complete - Can create, view, edit, delete highlights that persist

---

## Phase 5: User Story 3 - Read Highlighted Text Aloud (Priority: P3)

**Goal**: Users can play audio of highlighted text with playback controls

**Independent Test**: Click play on a highlight, verify audio plays matching the highlighted text. Pause/resume, adjust rate.

### Rust Backend for US3

- [ ] T055 [P] [US3] Create TTS state management in src-tauri/src/tts/engine.rs (TtsState struct with Mutex)
- [ ] T056 [P] [US3] Implement tts_init command in src-tauri/src/commands/tts.rs
- [ ] T057 [P] [US3] Implement tts_speak command in src-tauri/src/commands/tts.rs
- [ ] T058 [P] [US3] Implement tts_stop command in src-tauri/src/commands/tts.rs
- [ ] T059 [P] [US3] Implement tts_pause command in src-tauri/src/commands/tts.rs
- [ ] T060 [P] [US3] Implement tts_resume command in src-tauri/src/commands/tts.rs
- [ ] T061 [P] [US3] Implement tts_set_rate command in src-tauri/src/commands/tts.rs
- [ ] T062 [P] [US3] Implement tts_set_voice command in src-tauri/src/commands/tts.rs
- [ ] T063 [P] [US3] Implement tts_list_voices command in src-tauri/src/commands/tts.rs
- [ ] T064 [P] [US3] Implement tts_check_available command in src-tauri/src/commands/tts.rs
- [ ] T065 [US3] Register TTS commands in src-tauri/src/main.rs invoke_handler with TtsState

### Frontend Services for US3

- [ ] T066 [US3] Create tts-service.ts in src/services/tts-service.ts (init, speak, stop, pause, resume, setRate, setVoice, listVoices)

### Frontend Components for US3

- [ ] T067 [US3] Create PlaybackControls component in src/components/PlaybackControls.tsx (play/pause/stop buttons)
- [ ] T068 [US3] Create RateSlider component in src/components/RateSlider.tsx (0.5x to 2.0x)
- [ ] T069 [US3] Create VoiceSelector component in src/components/VoiceSelector.tsx (dropdown of available voices)
- [ ] T070 [US3] Add play button to HighlightContextMenu.tsx for reading highlight aloud

### US3 Integration

- [ ] T071 [US3] Implement TTS initialization on app startup with availability check in src/App.tsx
- [ ] T072 [US3] Connect highlight play action to TTS speak in HighlightContextMenu.tsx
- [ ] T073 [US3] Add TTS settings persistence (rate, voice) via settings store in src/stores/settings-store.ts
- [ ] T074 [US3] Show TTS unavailable message with installation instructions when tts_check_available returns false

**Checkpoint**: User Story 3 complete - Can play highlighted text with rate/voice controls

---

## Phase 6: User Story 4 - Read Current Page Aloud (Priority: P4)

**Goal**: Users can read the entire current page without selecting text

**Independent Test**: Click "Read Page" button, verify all page text is spoken in reading order

### Frontend Implementation for US4

- [ ] T075 [US4] Add "Read Page" button to Toolbar in src/components/Toolbar.tsx
- [ ] T076 [US4] Implement getPageText function in src/services/pdf-service.ts (extract text content in reading order)
- [ ] T077 [US4] Connect "Read Page" button to TTS speak with full page text
- [ ] T078 [US4] Stop page reading when navigating to different page in PdfViewer.tsx

**Checkpoint**: User Story 4 complete - Can read entire page aloud

---

## Phase 7: User Story 5 - Manage Document Library (Priority: P5)

**Goal**: Users can view recently opened documents and resume reading from last position

**Independent Test**: Open multiple PDFs, view library, verify documents appear with titles. Click document, verify opens to last page.

### Rust Backend for US5

- [ ] T079 [P] [US5] Implement library_list_documents command in src-tauri/src/commands/library.rs
- [ ] T080 [P] [US5] Implement library_remove_document command in src-tauri/src/commands/library.rs
- [ ] T081 [P] [US5] Implement library_open_document command in src-tauri/src/commands/library.rs
- [ ] T082 [P] [US5] Implement library_check_file_exists command in src-tauri/src/commands/library.rs
- [ ] T083 [US5] Register remaining library commands in src-tauri/src/main.rs

### Frontend Implementation for US5

- [ ] T084 [US5] Extend library-service.ts with listDocuments, removeDocument, checkFileExists in src/services/library-service.ts
- [ ] T085 [US5] Create Library component in src/components/Library.tsx (list of recent documents with thumbnails)
- [ ] T086 [US5] Create DocumentCard component in src/components/DocumentCard.tsx (title, last opened, progress indicator)
- [ ] T087 [US5] Add library view toggle to App.tsx (switch between library and viewer)
- [ ] T088 [US5] Implement "file not found" handling with remove option in Library.tsx
- [ ] T089 [US5] Open document from library at last saved page in Library.tsx

**Checkpoint**: User Story 5 complete - Library shows recent docs, can resume reading

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Error Handling & Edge Cases

- [ ] T090 [P] Add global error boundary in src/components/ErrorBoundary.tsx
- [ ] T091 [P] Implement structured logging in Rust backend (tracing crate) in src-tauri/src/main.rs
- [ ] T092 Add user-friendly error messages for all IPC command failures

### UI Polish

- [ ] T093 [P] Add keyboard shortcuts (Ctrl+O open, Left/Right page nav, Space play/pause) in src/App.tsx
- [ ] T094 [P] Add loading states for PDF rendering and TTS operations
- [ ] T095 [P] Add dark mode support via settings store and CSS variables in src/styles/
- [ ] T096 Implement proper cleanup on document close (stop TTS, save progress)

### Documentation & Validation

- [ ] T097 [P] Update README.md with build instructions and feature overview
- [ ] T098 Run quickstart.md verification checklist
- [ ] T099 Verify all acceptance scenarios from spec.md manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (PDF Viewing) - Foundation for all other stories
  - US2 (Highlights) - Can proceed after US1 complete (needs PDF viewer)
  - US3 (TTS Highlights) - Can proceed after US2 complete (needs highlights)
  - US4 (Page TTS) - Can proceed after US3 complete (needs TTS infrastructure)
  - US5 (Library) - Can proceed after US1 complete (needs document model)
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

```
Phase 2 (Foundation)
       │
       ▼
    ┌──────────────────────────────────┐
    │ US1: Open & View PDF (P1) - MVP  │
    └──────────────┬───────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐
│ US2: Highlights │   │ US5: Library    │
│     (P2)        │   │     (P5)        │
└────────┬────────┘   └─────────────────┘
         │
         ▼
┌─────────────────┐
│ US3: TTS High-  │
│ lights (P3)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ US4: Page TTS   │
│     (P4)        │
└─────────────────┘
```

### Within Each User Story

- Rust backend commands → Frontend services → Frontend components → Integration
- Complete story before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T003 + T004 + T005 + T008 (all different files)
```

**Phase 2 (Foundation)**:
```
T014 + T015 + T016 + T017 + T019 (all different files)
```

**Phase 4 (US2 Highlights)**:
```
T038 + T039 + T040 + T041 + T042 + T043 (all parallel Rust commands)
```

**Phase 5 (US3 TTS)**:
```
T055 through T064 (all parallel Rust commands)
```

---

## Parallel Example: User Story 3 TTS Backend

```bash
# Launch all TTS Rust commands in parallel:
T055: "Create TTS state management in src-tauri/src/tts/engine.rs"
T056: "Implement tts_init command in src-tauri/src/commands/tts.rs"
T057: "Implement tts_speak command in src-tauri/src/commands/tts.rs"
T058: "Implement tts_stop command in src-tauri/src/commands/tts.rs"
T059: "Implement tts_pause command in src-tauri/src/commands/tts.rs"
T060: "Implement tts_resume command in src-tauri/src/commands/tts.rs"
T061: "Implement tts_set_rate command in src-tauri/src/commands/tts.rs"
T062: "Implement tts_set_voice command in src-tauri/src/commands/tts.rs"
T063: "Implement tts_list_voices command in src-tauri/src/commands/tts.rs"
T064: "Implement tts_check_available command in src-tauri/src/commands/tts.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Open & View PDF)
4. **STOP and VALIDATE**: Open multiple PDFs, navigate, zoom, verify progress saves
5. Deploy/demo if ready - **this is the MVP!**

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (PDF Viewing) → Test → Demo (**MVP!**)
3. Add US2 (Highlights) → Test → Demo
4. Add US3 (TTS Highlights) → Test → Demo
5. Add US4 (Page TTS) → Test → Demo
6. Add US5 (Library) → Test → Demo
7. Polish phase → Final release

### Suggested MVP Scope

**User Story 1 alone** delivers the core value proposition:
- Reliably open local PDFs without browser restrictions
- Navigate and zoom
- Reading progress saved

This can be shipped and validated before adding highlights and TTS.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This is a **new standalone project** - not inside VoxPage
- Run spikes from spec.md to validate key assumptions before full implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
