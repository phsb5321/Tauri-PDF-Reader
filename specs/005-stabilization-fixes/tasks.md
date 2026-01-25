# Tasks: Selection + Read-along Highlights + TTS Playback Stability

**Input**: Design documents from `/specs/005-stabilization-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks organized by user story from spec.md. Each story can be implemented and tested independently.

### Track → User Story Mapping (from plan.md)

| Plan Track | Tasks Phase | User Story | Focus Area |
|------------|-------------|------------|------------|
| Track A | Phase 3 | US1 | Text Selection & Highlighting |
| Track B | Phase 4 | US2 | Read-along TTS Highlights |
| Track C | Phase 5-6 | US3, US4 | Playback Controls & Multi-page |
| Track D | Phase 7 | US5 | Audio/Timestamp Caching |
| Track E | Phase 8 | - | E2E Tests & Regression Safety |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US5 per spec.md)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React/TypeScript)
- **Backend**: `src-tauri/src/` (Rust)
- **Tests**: `src/__tests__/`, `src-tauri/tests/`, `e2e/`

---

## Phase 1: Setup (Verification)

**Purpose**: Verify environment and existing tests pass

- [X] T001 Run `pnpm install && pnpm tauri dev` to verify development environment works
- [X] T002 [P] Run frontend tests: `pnpm test:run` to verify existing tests pass
- [X] T003 [P] Run backend tests: `cd src-tauri && cargo test --features test-mocks`
- [X] T004 [P] Verify SQLite database creates and migrates correctly on first launch

**Checkpoint**: App launches, existing tests pass, database initializes correctly

---

## Phase 2: Foundational (TTS State Machine)

**Purpose**: Fix TTS state synchronization - prerequisite for all playback-related stories

**⚠️ CRITICAL**: Must complete before US2, US3, US4, US5 can be properly tested

- [X] T005 Update `pause()` method in `src-tauri/src/ai_tts/mod.rs` to set `state.is_paused = true; state.is_playing = false`
- [X] T006 Update `resume()` method in `src-tauri/src/ai_tts/mod.rs` to set `state.is_paused = false; state.is_playing = true`
- [X] T007 Update `stop()` method in `src-tauri/src/ai_tts/mod.rs` to set `state.is_playing = false; state.is_paused = false`
- [X] T008 Add `AppHandle` parameter to `ai_tts_pause` command in `src-tauri/src/commands/ai_tts.rs`
- [X] T009 Emit `ai-tts:paused` event from `ai_tts_pause` command in `src-tauri/src/commands/ai_tts.rs`
- [X] T010 Add `AppHandle` parameter to `ai_tts_resume` command in `src-tauri/src/commands/ai_tts.rs`
- [X] T011 Emit `ai-tts:resumed` event from `ai_tts_resume` command in `src-tauri/src/commands/ai_tts.rs`
- [X] T012 Add event listeners for `ai-tts:paused` and `ai-tts:resumed` in `src/hooks/useAiTts.ts`

**Checkpoint**: TTS pause/resume/stop sync correctly between frontend and backend via events

---

## Phase 3: User Story 1 - Text Selection & Highlighting (P1-CRITICAL) 🎯 MVP

**Goal**: Make text selection work reliably on any page, any zoom level. Enable highlight creation from selection.

**Independent Test**: Open PDF → drag select text at any zoom → selection captured → page number correctly identified → create highlight → highlight appears → zoom → highlight remains aligned → restart → highlight persists

### Implementation for US1

- [X] T013 [P] [US1] Add `data-page-number` attribute to TextLayer container div in `src/components/TextLayer.tsx`
- [X] T014 [P] [US1] Add `data-page-number` attribute to PdfPage container div in `src/components/pdf-viewer/PdfPage.tsx`
- [X] T015 [US1] Replace `pageContainerRef.contains(target)` with `target.closest('[data-page-number]')` in `src/components/PdfViewer.tsx` (see research.md Track A)
- [X] T016 [US1] Verify selection coordinate normalization (÷scale) in `src/components/TextLayer.tsx` lines 110-118 stores rects in PDF space
- [X] T017 [US1] Verify highlight rendering applies (×scale) in `src/components/pdf-viewer/HighlightOverlay.tsx` lines 66-69
- [X] T018 [US1] Add unit test for selection coordinate transform at various scales in `src/__tests__/unit/coordinate-transform.test.ts`

**Checkpoint**: Selection works 100% on any page/zoom; highlights persist and align within 2 pixels at all zoom levels

---

## Phase 4: User Story 2 - Read-along Highlights (P1-CRITICAL)

**Goal**: Make TTS word highlights visible and correctly positioned, tracking the spoken word.

**Independent Test**: Press Play → visual highlight moves word-by-word → zoom → highlight repositions correctly → navigate page → highlight appears on new page (not stuck on old page)

### Implementation for US2

- [X] T019 [US2] Remove `textLayerRef` prop from TtsWordHighlight in `src/components/TextLayer.tsx` (line ~200-204)
- [X] T020 [US2] Implement dynamic DOM lookup via `findTextLayerDiv(pageNumber)` using `document.querySelector('[data-page-number="${pageNumber}"] .textLayer')` in `src/components/pdf-viewer/TtsWordHighlight.tsx` (see research.md Track B)
- [X] T021 [US2] Remove fallback that returns "first visible textLayer" in `src/components/pdf-viewer/TtsWordHighlight.tsx` lines 37-46
- [X] T022 [US2] Verify coordinate handling in `findWordRects()` - should use viewport coords directly from `getBoundingClientRect()` (no ÷scale needed, per research.md section 4)
- [X] T023 [US2] Add page number to highlight store in `src/stores/tts-highlight-store.ts` for tracking which page highlight is on
- [X] T024 [US2] Add unit test for rect calculation at various scales in `src/__tests__/unit/tts-highlight-rects.test.ts`

**Checkpoint**: TTS highlight visible 100% of the time when wordTimings exist; no "⚠️" warnings in debug; highlight follows page changes

---

## Phase 5: User Story 3 - TTS Playback Controls (P1-CRITICAL)

**Goal**: Single play, correct UI state, no duplicate audio streams, deterministic stop on page navigation.

**Independent Test**: Click Play → audio begins, button shows Pause → click Play again quickly → still only one audio stream → pause → resume → stop → navigate page → audio stops immediately

### Implementation for US3

- [X] T025 [US3] Add explicit state machine with VALID_TRANSITIONS map in `src/stores/ai-tts-store.ts` (see research.md section 2)
- [X] T026 [US3] Add `transitionTo(nextState)` function with validation in `src/stores/ai-tts-store.ts`
- [X] T027 [US3] Add request ID gating (`++requestIdRef.current`) in `src/hooks/useTtsWordHighlight.ts` `speakWithHighlight` function (see research.md section 2)
- [X] T028 [US3] Check `currentRequestId !== requestIdRef.current` before updating state after async operations in `src/hooks/useTtsWordHighlight.ts`
- [X] T029 [US3] Fix closure-captured state issue in `handlePlaybackComplete` - use `store.getState()` instead of closure values in `src/components/playback-bar/AiPlaybackBar.tsx` lines 70-78
- [X] T030 [US3] Add `await aiTtsStop()` before `setCurrentPage()` in `src/components/PageNavigation.tsx` to ensure playback stops on page change
- [X] T031 [US3] Cancel animation frame on page navigation in `src/hooks/useTtsWordHighlight.ts` cleanup effect
- [X] T032 [US3] Add unit test for state machine transitions in `src/__tests__/unit/ai-tts-state-machine.test.ts`

**Checkpoint**: No duplicate audio streams ever; UI state always matches actual playback; page navigation deterministically stops audio

---

## Phase 6: User Story 4 - Multi-page Playback (P2)

**Goal**: TTS continues automatically to next page (when enabled), with auto-scroll to keep current word visible.

**Independent Test**: Enable auto-page → start TTS on page 1 → let it complete → automatically advances to page 2 and continues → word near bottom → viewport scrolls to keep it visible

### Implementation for US4

- [X] T033 [US4] Add `autoPageEnabled` setting to `src/stores/ai-tts-store.ts`
- [X] T034 [US4] Implement `onPlaybackComplete` handler that advances page when `autoPageEnabled` in `src/components/playback-bar/AiPlaybackBar.tsx`
- [X] T035 [US4] Use refs for `currentPage` and `totalPages` in completion handler to avoid stale closure (see research.md section 2)
- [X] T036 [US4] Implement `scrollToWord(wordRect)` function in `src/components/playback-bar/AiPlaybackBar.tsx` (see research.md section 2)
- [X] T037 [US4] Call `scrollToWord` from `onScrollNeeded` callback in `src/hooks/useTtsWordHighlight.ts`
- [X] T038 [US4] Add auto-page toggle to UI in `src/components/playback-bar/AiTtsSettings.tsx`

**Checkpoint**: Multi-page playback works when enabled; auto-scroll keeps current word visible; disabling auto-page stops advancement

---

## Phase 7: User Story 5 - Audio/Timestamp Caching (P1)

**Goal**: Cache audio + timestamps, instant replay, LRU eviction.

**Independent Test**: Play TTS on page 1 → note latency → play same page again → instant (no loading delay) → change voice → regenerates → restart app → play same page → still instant

### Implementation for US5

- [X] T039 [P] [US5] Add migration to enhance `tts_cache_metadata` table with new columns in `src-tauri/src/db/migrations.rs` (V2 exists with core schema)
- [ ] T040 [US5] Implement LRU eviction logic in `src-tauri/src/adapters/audio_cache.rs` with `evict_lru(max_size_mb)` function - **DEFERRED: Core caching works, eviction is optimization**
  - **Note**: This is automatic background eviction, not user-facing storage quota warnings (quota UI is explicitly out of scope per spec.md Non-Goals)
- [ ] T041 [US5] Add `word_timings_json` storage alongside audio - **DEFERRED: In-memory cache works for session**
- [X] T042 [US5] Implement cache hit logic in `src-tauri/src/ai_tts/mod.rs` `speak_with_timestamps()` - check cache before API call (in-memory cache at lines 267-313)
- [ ] T043 [US5] Add `ai_tts_cache_validate` command - **DEFERRED: Not critical for MVP**
- [ ] T044 [US5] Add `ai_tts_cache_get_with_timings` command - **DEFERRED: Not critical for MVP**
- [ ] T045 [P] [US5] Add cache size configuration - **DEFERRED: Works with default behavior**
- [ ] T046 [US5] Update `last_accessed_at` on cache read - **DEFERRED: Requires LRU eviction**
- [X] T047 [US5] Add unit test for cache key generation in `src-tauri/tests/audio_cache_test.rs` (tests exist at audio_cache.rs:310-355)

**Checkpoint**: Cache hit rate 100% with same settings; LRU eviction works when limit exceeded; word timings cached alongside audio

---

## Phase 8: E2E Tests & Regression Safety

**Purpose**: Automated test coverage for all fixed scenarios (per spec Goal G6)

**⚠️ DEFERRED**: Playwright not installed. Tauri E2E requires special setup (tauri-driver). Existing `e2e/critical-loop.spec.ts` has skipped tests awaiting infrastructure.

- [ ] T048 [P] Create E2E test: Selection → highlight appears in `e2e/selection.spec.ts` - **DEFERRED**
- [ ] T049 [P] Create E2E test: TTS play → highlight visible and moves in `e2e/tts-highlight.spec.ts` - **DEFERRED**
- [ ] T050 [P] Create E2E test: Play twice quickly → single audio stream in `e2e/tts-playback.spec.ts` - **DEFERRED**
- [ ] T051 [P] Create E2E test: Multi-page auto-advance in `e2e/tts-multipage.spec.ts` - **DEFERRED**
- [ ] T052 [P] Create E2E test: Cache hit (mock API, verify no second call) in `e2e/tts-cache.spec.ts` - **DEFERRED**
- [ ] T053 Configure Playwright to capture traces on failure in `playwright.config.ts` - **DEFERRED**

**Checkpoint**: E2E suite passes in CI; traces available for debugging failures

---

## Phase 9: Polish & Final Verification

**Purpose**: Final verification of all success criteria

- [X] T054 Run full test suite: `pnpm test:run && cd src-tauri && cargo test --features test-mocks`
  - Backend: 177 tests pass
  - Frontend: 242 tests pass (4 pre-existing failures in render settings unrelated to this spec)
  - Build: TypeScript compiles successfully
- [ ] T055 Manual verification of T010 checklist from spec.md:
  - [ ] Selection works on any page, any zoom
  - [ ] Highlights visible during TTS playback
  - [ ] No double audio on play
  - [ ] Play/pause UI correct
  - [ ] TTS continues after page 1 (when auto-page enabled)
  - [ ] Auto-scroll keeps current word visible
  - [ ] Cache hit confirmed (no regeneration on replay)
  - [ ] No TAURI callback warnings during normal flow
- [X] T056 Update CLAUDE.md with any new patterns discovered
  - Added state machine pattern documentation (`VALID_TRANSITIONS`, `transitionTo`)
  - Added stale closure prevention pattern (refs in async callbacks)
  - Added page element identification pattern (`data-page-number`, `closest()`)
  - Added auto-page and auto-scroll documentation

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → No dependencies
Phase 2 (Foundational) → Depends on Phase 1
Phase 3-7 (User Stories) → All depend on Phase 2
Phase 8 (E2E Tests) → Depends on Phase 3-7
Phase 9 (Polish) → Depends on Phase 8
```

### User Story Dependencies

- **US1 (Selection/Highlighting)**: Can start after Phase 2 - Independent of other stories
- **US2 (Read-along Highlights)**: Can start after Phase 2 - Independent, but share context with US3
- **US3 (Playback Controls)**: Can start after Phase 2 - Independent, builds on Phase 2 TTS fixes
- **US4 (Multi-page)**: Best after US3 for proper testing context
- **US5 (Caching)**: Can start after Phase 2 - Backend focus, independent of frontend stories

### Parallel Opportunities

**After Phase 2 completes, these can run in parallel:**

```bash
# Developer A: Selection & Highlighting (US1)
Task: T013-T018

# Developer B: Read-along Highlights (US2)
Task: T019-T024

# Developer C: Playback Controls (US3)
Task: T025-T032

# Developer D: Caching (Backend focus, US5)
Task: T039-T047
```

**Within US5 (parallel):**
```bash
Task: T039 (migration) - independent
Task: T045 (config) - independent
Task: T047 (unit test) - independent
```

---

## Implementation Strategy

### MVP First (US1 + US3)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: TTS state machine fixes (CRITICAL)
3. Complete Phase 3: US1 - Selection & Highlighting (core broken feature)
4. **STOP and VALIDATE**: Test selection + highlight creation end-to-end
5. Complete Phase 5: US3 - Playback Controls (core broken feature)
6. **STOP and VALIDATE**: Test playback cycle end-to-end

### Incremental Delivery

1. Setup + Foundational → TTS state machine fixed
2. Add US1 → Selection/highlighting working
3. Add US3 → Playback controls reliable
4. Add US2 → Read-along highlights visible
5. Add US4 → Multi-page playback
6. Add US5 → Audio caching complete
7. Add E2E → Regression safety

### Risk Assessment

| Task | Risk Level | Notes |
|------|------------|-------|
| T015 (closest() fix) | Low | Mechanical DOM change |
| T020 (dynamic lookup) | Medium | Requires careful testing for stale refs |
| T027-T028 (request ID) | Medium | Race condition prevention |
| T040 (LRU eviction) | Medium | New logic, needs thorough testing |
| T029 (closure fix) | High | Subtle React pattern, easy to regress |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 56 |
| Phase 1 (Setup) | 4 tasks |
| Phase 2 (Foundational) | 8 tasks |
| US1 (Selection) | 6 tasks |
| US2 (Read-along) | 6 tasks |
| US3 (Playback) | 8 tasks |
| US4 (Multi-page) | 6 tasks |
| US5 (Caching) | 9 tasks |
| E2E Tests | 6 tasks |
| Polish | 3 tasks |
| Parallel Opportunities | 20+ tasks can run in parallel |
| MVP Scope | Phase 1-2 + US1 + US3 (26 tasks) |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US#] label maps task to user story from spec.md
- Each user story is independently testable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- research.md contains detailed implementation patterns
- contracts/tauri-commands.md specifies exact API changes
