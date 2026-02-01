# Tasks: Reading Session Manager with Audio Cache & Progress Persistence

**Input**: Design documents from `/specs/006-reading-session-audio-cache/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle IV (80% coverage requirement).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React/TypeScript)
- **Backend**: `src-tauri/src/` (Rust/Tauri)
- Follows existing hexagonal architecture (domain/ports/adapters/application)

---

## Phase 1: Setup

**Purpose**: Add dependencies and create migration infrastructure

- [x] T001 Add id3 = "1.14" crate dependency in src-tauri/Cargo.toml
- [x] T002 Create migration version 3 SQL in src-tauri/src/db/migrations.rs for reading_sessions, session_documents, cache_settings tables and tts_cache_metadata enhancements
- [x] T003 [P] Create domain module structure for sessions in src-tauri/src/domain/sessions/mod.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain entities, ports, error types that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Backend Domain & Ports

- [x] T004 [P] Create ReadingSession and SessionDocument domain entities in src-tauri/src/domain/sessions/session.rs
- [x] T005 [P] Create CoverageStats and PageCoverageStats domain entities in src-tauri/src/domain/cache/coverage.rs
- [x] T006 [P] Create AudioCacheEntry domain entity in src-tauri/src/domain/cache/cache_entry.rs
- [x] T007 [P] Create ExportResult, ExportProgress, ExportOptions domain entities in src-tauri/src/domain/export/export_result.rs
- [x] T008 [P] Create RepositoryError and ExportError types in src-tauri/src/domain/errors.rs
- [x] T009 [P] Create SessionRepository port trait in src-tauri/src/ports/session_repository.rs
- [x] T010 [P] Create AudioCacheRepository port trait in src-tauri/src/ports/audio_cache_repository.rs
- [x] T011 [P] Create AudioExportService port trait in src-tauri/src/ports/audio_export_service.rs

### Frontend Domain & Ports

- [x] T012 [P] Create ReadingSession and SessionDocument domain types in src/domain/sessions/session.ts
- [x] T013 [P] Create CoverageStats and PageCoverageStats domain types in src/domain/cache/coverage.ts
- [x] T014 [P] Create AudioCacheEntry domain type in src/domain/cache/cache-entry.ts
- [x] T015 [P] Create ExportResult, ExportProgress, ExportOptions domain types in src/domain/export/export-result.ts
- [x] T016 [P] Create SessionRepository port interface in src/ports/session-repository.ts
- [x] T017 [P] Create AudioCacheRepository port interface in src/ports/audio-cache-repository.ts

### Wire Up Domain Modules

- [x] T018 Export domain modules in src-tauri/src/domain/mod.rs (sessions, cache, export, errors)
- [x] T019 Export port modules in src-tauri/src/ports/mod.rs (session_repository, audio_cache_repository, audio_export_service)

### Domain Unit Tests

- [x] T020 [P] Add unit tests for ReadingSession validation in src-tauri/src/domain/sessions/session.rs (inline #[cfg(test)] module)
- [x] T021 [P] Add unit tests for CoverageStats calculations in src-tauri/src/domain/cache/coverage.rs (inline #[cfg(test)] module)
- [x] T022 [P] Add unit tests for session domain validation in src/**tests**/domain/sessions/session.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Resume Reading with Cached Audio (Priority: P1)

**Goal**: Cache all generated TTS audio locally so users never pay for the same text twice when resuming a book

**Independent Test**: Play TTS audio for a text chunk, close the app, reopen, and play the same chunk again. Audio should play from cache without API call.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T023 [P] [US1] Contract test for audio_cache_get_coverage command in src-tauri/tests/audio_cache_contract.rs
- [x] T024 [P] [US1] Contract test for audio_cache_clear_document command in src-tauri/tests/audio_cache_contract.rs
- [x] T025 [P] [US1] Contract test for audio_cache_get_stats command in src-tauri/tests/audio_cache_contract.rs
- [x] T026 [P] [US1] Contract test for audio_cache_set_limit command in src-tauri/tests/audio_cache_contract.rs
- [x] T027 [P] [US1] Contract test for audio_cache_evict command in src-tauri/tests/audio_cache_contract.rs
- [x] T028 [P] [US1] Integration test for cache hit/miss flow in src/**tests**/integration/audio-cache-flow.test.ts

### Backend Implementation

- [x] T029 [US1] Implement SqliteAudioCacheRepository adapter in src-tauri/src/adapters/sqlite/audio_cache_repo.rs with store(), get(), exists(), touch(), delete() methods
- [x] T030 [US1] Implement evict_lru() in SqliteAudioCacheRepository with LRU ordering in src-tauri/src/adapters/sqlite/audio_cache_repo.rs
- [x] T031 [US1] Implement get_size_limit() and set_size_limit() in SqliteAudioCacheRepository
- [x] T032 [US1] Add cache metadata writes to existing AudioCacheAdapter set_with_timestamps() in src-tauri/src/adapters/audio_cache.rs (covered by T029 SqliteAudioCacheRepo integration)
- [x] T033 [US1] Implement AudioCacheService in src-tauri/src/application/audio_cache_service.rs with cache check, store orchestration, and auto-eviction on limit exceeded
- [x] T034 [US1] Add audio_cache_get_coverage Tauri command in src-tauri/src/commands/audio_cache.rs
- [x] T035 [US1] Add audio_cache_clear_document Tauri command in src-tauri/src/commands/audio_cache.rs
- [x] T036 [US1] Add audio_cache_get_stats Tauri command in src-tauri/src/commands/audio_cache.rs
- [x] T037 [US1] Add audio_cache_set_limit, audio_cache_evict, and audio_cache_get_limit Tauri commands in src-tauri/src/commands/audio_cache.rs
- [x] T038 [US1] Register audio cache commands in src-tauri/src/lib.rs generate_handler! macro

### Frontend Implementation

- [x] T039 [US1] Implement TauriAudioCacheAdapter in src/adapters/tauri/audio-cache.adapter.ts (covered by API layer)
- [x] T040 [US1] Create audio-cache API functions in src/lib/api/audio-cache.ts (getCoverage, clearDocument, getStats, setCacheLimit, evictCache)
- [x] T041 [US1] Export audio-cache API from src/lib/api/index.ts
- [x] T042 [US1] Add cacheCoverage state to ai-tts-store.ts with setCacheCoverage action
- [x] T097 [US1] Implement cache invalidation when text hash mismatches in src-tauri/src/application/audio_cache_service.rs (FR-005: hash-based invalidation)

**Checkpoint**: User Story 1 complete - cached audio plays without API calls on repeat playback, LRU eviction functional

---

## Phase 4: User Story 2 - View Audio Cache Progress (Priority: P2)

**Goal**: Show a progress indicator displaying what percentage of the book has cached audio for offline listening awareness

**Independent Test**: Cache audio for specific pages, verify the progress indicator reflects the correct percentage

### Tests for User Story 2

- [x] T043 [P] [US2] Unit test for CacheProgressBar rendering states in src/**tests**/ui/CacheProgressBar.test.tsx
- [x] T044 [P] [US2] Unit test for AudioCacheProgress real-time updates in src/**tests**/ui/AudioCacheProgress.test.tsx

### Backend Implementation

- [x] T045 [US2] Implement get_coverage() with page_stats in SqliteAudioCacheRepository in src-tauri/src/adapters/sqlite/audio_cache_repo.rs
- [x] T046 [US2] Add audio-cache:coverage-updated event emission in AudioCacheService when cache changes in src-tauri/src/application/audio_cache_service.rs

### Frontend Implementation

- [x] T047 [P] [US2] Create CacheProgressBar component in src/components/audio-progress/CacheProgressBar.tsx
- [x] T048 [US2] Create AudioCacheProgress component in src/components/audio-progress/AudioCacheProgress.tsx with real-time updates via event listener
- [x] T049 [US2] Create useAudioCache hook in src/hooks/useAudioCache.ts for coverage fetching and event subscription
- [x] T050 [US2] Integrate AudioCacheProgress into AiPlaybackBar in src/components/AiPlaybackBar.tsx

**Checkpoint**: User Story 2 complete - cache coverage percentage visible and updates in real-time

---

## Phase 5: User Story 3 - Create and Manage Reading Sessions (Priority: P3)

**Goal**: Save current document selection into a "Reading Session" to resume place and settings later

**Independent Test**: Create session with 2+ documents, close app, reopen, restore session - documents open at correct pages

### Tests for User Story 3

- [x] T051 [P] [US3] Contract test for session_create command in src-tauri/tests/session_contract.rs
- [x] T052 [P] [US3] Contract test for session_get command in src-tauri/tests/session_contract.rs
- [x] T053 [P] [US3] Contract test for session_list command in src-tauri/tests/session_contract.rs
- [x] T054 [P] [US3] Contract test for session_update command in src-tauri/tests/session_contract.rs
- [x] T055 [P] [US3] Contract test for session_delete command in src-tauri/tests/session_contract.rs
- [x] T056 [P] [US3] Contract test for session_restore command in src-tauri/tests/session_contract.rs
- [x] T057 [P] [US3] Integration test for session lifecycle in src/**tests**/integration/session-flow.test.ts
- [x] T058 [P] [US3] Unit test for SessionMenu component in src/**tests**/ui/SessionMenu.test.tsx

### Backend Implementation

- [x] T059 [US3] Implement SqliteSessionRepository adapter in src-tauri/src/adapters/sqlite/session_repo.rs with create(), get(), list(), update(), delete() methods
- [x] T060 [US3] Implement add_document(), remove_document(), update_document(), touch() methods in SqliteSessionRepository
- [x] T061 [US3] Implement SessionService in src-tauri/src/application/session_service.rs with session lifecycle orchestration
- [x] T062 [US3] Create session Tauri commands in src-tauri/src/tauri_api/sessions.rs (session_create, session_get, session_list)
- [x] T063 [US3] Add session_update, session_delete, session_restore commands in src-tauri/src/tauri_api/sessions.rs
- [x] T064 [US3] Add session_add_document, session_remove_document, session_update_document commands in src-tauri/src/tauri_api/sessions.rs
- [x] T065 [US3] Register session commands in src-tauri/src/lib.rs collect_commands! and generate_handler! macros

### Frontend Implementation

- [x] T066 [US3] Implement TauriSessionAdapter in src/adapters/tauri/session.adapter.ts
- [x] T067 [US3] Create sessions API functions in src/lib/api/sessions.ts (create, get, list, update, delete, restore)
- [x] T068 [US3] Export sessions API from src/lib/api/index.ts
- [x] T069 [US3] Create session-store in src/stores/session-store.ts with sessions state, CRUD actions, and restore functionality
- [x] T070 [P] [US3] Create SessionItem component in src/components/session-menu/SessionItem.tsx
- [x] T071 [US3] Create SessionMenu component in src/components/session-menu/SessionMenu.tsx with list, create, restore UI
- [x] T072 [US3] Create CreateSessionDialog component in src/components/session-menu/CreateSessionDialog.tsx
- [x] T073 [US3] Integrate SessionMenu into Toolbar in src/components/Toolbar.tsx

**Checkpoint**: User Story 3 complete - sessions persist and restore with correct document positions

---

## Phase 6: User Story 4 - Export Complete Audiobook (Priority: P4)

**Goal**: Export a complete audiobook file once all chunks are cached for listening on external devices

**Independent Test**: Fully cache a short document, initiate export, play resulting file in external audio player with chapter navigation

### Tests for User Story 4

- [x] T074 [P] [US4] Contract test for audio_export_check_ready command in src-tauri/tests/audio_export_contract.rs
- [x] T075 [P] [US4] Contract test for audio_export_document command in src-tauri/tests/audio_export_contract.rs
- [x] T076 [P] [US4] Contract test for audio_export_cancel command in src-tauri/tests/audio_export_contract.rs
- [x] T077 [P] [US4] Unit test for AudioExportDialog component in src/**tests**/ui/AudioExportDialog.test.tsx

### Backend Implementation

- [x] T078 [US4] Implement list_for_document() in SqliteAudioCacheRepository for ordered chunk retrieval in src-tauri/src/adapters/sqlite/audio_cache_repo.rs
- [x] T079 [US4] Implement AudioExportServiceImpl in src-tauri/src/application/audio_export_service.rs with check_readiness() method
- [x] T080 [US4] Implement audio concatenation using rodio in AudioExportServiceImpl export() method
- [x] T081 [US4] Implement ID3v2 chapter marker embedding using id3 crate in AudioExportServiceImpl
- [x] T082 [US4] Implement export progress events and cancel support in AudioExportServiceImpl
- [x] T083 [US4] Create export Tauri commands in src-tauri/src/commands/audio_export.rs (audio_export_check_ready, audio_export_document, audio_export_cancel)
- [x] T084 [US4] Register export commands in src-tauri/src/lib.rs

### Frontend Implementation

- [x] T085 [US4] Create audio-export API functions in src/lib/api/audio-export.ts (checkReady, exportDocument, cancel)
- [x] T086 [US4] Export audio-export API from src/lib/api/index.ts
- [x] T087 [P] [US4] Create ExportProgress component in src/components/export-dialog/ExportProgress.tsx with phase display
- [x] T088 [US4] Create AudioExportDialog component in src/components/export-dialog/AudioExportDialog.tsx with readiness check, format selection, progress tracking
- [x] T089 [US4] Add useExportProgress hook in src/hooks/useExportProgress.ts for export event subscription
- [x] T090 [US4] Add export trigger button to document toolbar or context menu

**Checkpoint**: User Story 4 complete - audiobooks export with chapter navigation working in external players

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cache settings UI and final validation

### Cache Settings UI

- [x] T091 Add cache settings to existing Settings panel in src/components/Settings.tsx (max size, clear cache)

### Final Polish

- [x] T092 Add audio-cache:eviction event handling in frontend for user notification
- [x] T093 Add ARIA labels and keyboard navigation to all new components
- [x] T094 Run pnpm lint:boundaries to validate hexagonal architecture compliance
- [x] T095 Run pnpm verify to validate all tests pass and 80% coverage maintained
- [ ] T096 Run quickstart.md validation scenarios manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if team capacity allows)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Can start after all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories (core caching + LRU eviction)
- **User Story 2 (P2)**: Can start after Foundational - Depends on US1 cache infrastructure
- **User Story 3 (P3)**: Can start after Foundational - No dependencies on other stories (independent sessions)
- **User Story 4 (P4)**: Can start after Foundational - Depends on US1 cache infrastructure for export source

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Backend adapters before services
- Backend services before Tauri commands
- Tauri commands before frontend adapters
- Frontend adapters before API functions
- API functions before stores/hooks
- Stores/hooks before components

### Parallel Opportunities

**Within Foundational (Phase 2):**

```
Parallel: T004, T005, T006, T007, T008 (all domain entities)
Parallel: T009, T010, T011 (all port traits)
Parallel: T012, T013, T014, T015 (all frontend domain types)
Parallel: T016, T017 (frontend ports)
Parallel: T020, T021, T022 (domain unit tests)
```

**User Story 1:**

```
Parallel: T023, T024, T025, T026, T027, T028 (all tests first)
Parallel: T039, T040 (frontend adapter + API can develop together)
```

**User Story 2:**

```
Parallel: T043, T044 (UI tests)
Parallel: T047 (CacheProgressBar has no dependencies within US2)
```

**User Story 3:**

```
Parallel: T051-T058 (all tests first)
Parallel: T070 (SessionItem has no dependencies within US3)
```

**User Story 4:**

```
Parallel: T074-T077 (all tests first)
Parallel: T087 (ExportProgress has no dependencies within US4)
```

**Across User Stories (after Foundational):**

```
Team A: User Story 1 → User Story 2
Team B: User Story 3
Team C: Wait for US1 completion → User Story 4
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (includes LRU eviction per FR-006)
4. **STOP and VALIDATE**: Test cached audio plays without API calls
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy (MVP: no repeat API costs + cache management!)
3. Add User Story 2 → Test → Deploy (users see cache progress)
4. Add User Story 3 → Test → Deploy (session management)
5. Add User Story 4 → Test → Deploy (audiobook export)
6. Complete Phase 7 → Full polish

### Task Count Summary

| Phase                       | Task Count |
| --------------------------- | ---------- |
| Setup                       | 3          |
| Foundational                | 19         |
| User Story 1 (Tests + Impl) | 21         |
| User Story 2 (Tests + Impl) | 8          |
| User Story 3 (Tests + Impl) | 23         |
| User Story 4 (Tests + Impl) | 17         |
| Polish                      | 6          |
| **Total**                   | **97**     |

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable once complete
- Tests MUST fail before implementation (TDD discipline)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Architecture follows existing hexagonal patterns per CLAUDE.md
- All Tauri commands must be registered in both collect_commands! and generate_handler!
- Constitution Principle IV: 80% coverage threshold must be maintained
