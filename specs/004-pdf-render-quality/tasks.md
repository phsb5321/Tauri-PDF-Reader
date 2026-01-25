# Tasks: PDF Rendering Quality & Hardware Acceleration

**Input**: Design documents from `/specs/004-pdf-render-quality/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/render-settings.ts

**Tests**: Included per Constitution Principle IV (Test Coverage) - critical paths require automated tests.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create domain rendering module structure and type definitions

- [x] T001 Create domain rendering module directory at src/domain/rendering/
- [x] T002 [P] Create type definitions with Zod schemas in src/domain/rendering/types.ts (copy from contracts/render-settings.ts)
- [x] T003 [P] Create QualityMode constants and config in src/domain/rendering/QualityMode.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core rendering calculation logic and state management infrastructure

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement RenderPolicy.calculateRenderPlan() in src/domain/rendering/RenderPolicy.ts
- [x] T005 Implement megapixel capping logic in RenderPolicy with fallback scale cascade in src/domain/rendering/RenderPolicy.ts
- [x] T006 [P] Create render-store.ts Zustand store for render settings state in src/stores/render-store.ts
- [x] T007 [P] Add render settings persistence commands to backend in src-tauri/src/commands/settings.rs
- [x] T008 [P] Add RenderSettings entity to domain settings in src-tauri/src/domain/settings.rs
- [x] T009 Create useRenderSettings hook with persistence in src/hooks/useRenderSettings.ts

### Foundational Tests (Constitution Principle IV)

- [x] T010 [P] Unit test RenderPolicy.calculateRenderPlan() in src/__tests__/unit/rendering/RenderPolicy.test.ts
- [x] T011 [P] Unit test megapixel capping and fallback scale cascade in src/__tests__/unit/rendering/RenderPolicy.test.ts
- [x] T012 [P] Contract test render settings Tauri commands (get/update) in src-tauri/tests/settings_contract.rs
- [x] T013 [P] Integration test settings persistence round-trip in src/__tests__/integration/render-settings.test.ts

**Checkpoint**: Foundation ready - RenderPolicy tested, state management wired, persistence working

---

## Phase 3: User Story 1 - Crisp Text Reading Experience (Priority: P1) 🎯 MVP

**Goal**: Render PDF text with browser-quality sharpness using HiDPI-aware output scaling

**Independent Test**: Open any text-heavy PDF and compare side-by-side with Chrome/Firefox at same zoom level. Text should be visually comparable.

### Implementation for User Story 1

- [x] T014 [US1] Modify PdfPage.tsx to use RenderPolicy for canvas dimension calculation in src/components/pdf-viewer/PdfPage.tsx
- [x] T015 [US1] Implement canvas context configuration (alpha:false, desynchronized:true, imageSmoothingQuality:'high') in src/components/pdf-viewer/PdfPage.tsx
- [x] T016 [US1] Add transform matrix application for HiDPI rendering in src/components/pdf-viewer/PdfPage.tsx
- [x] T017 [US1] Wire DisplayInfo detection (devicePixelRatio, viewport dimensions) in src/components/PdfViewer.tsx
- [x] T018 [US1] Add automatic re-render on devicePixelRatio change (display switch detection) in src/components/PdfViewer.tsx
- [x] T019 [US1] Implement render debouncing (150ms) in src/components/PdfViewer.tsx to prevent render thrash
- [x] T020 [US1] Add render task cancellation for in-flight renders on new render request in src/components/pdf-viewer/PdfPage.tsx

**Checkpoint**: PDF text renders crisp at all zoom levels with automatic HiDPI detection

---

## Phase 4: User Story 2 - Text Selection and Copy (Priority: P1)

**Goal**: Accurate text selection that aligns with visible text at all zoom levels

**Independent Test**: Select text across multiple lines/paragraphs and paste into text editor. Selection highlight should precisely match text boundaries.

### Implementation for User Story 2

- [x] T021 [US2] Set --scale-factor CSS variable on TextLayer to match viewport zoom in src/components/TextLayer.tsx
- [x] T022 [US2] Ensure TextLayer positioning uses zoomLevel (not outputScale) in src/components/TextLayer.tsx
- [x] T023 [US2] Update TextLayer.css for proper scaling synchronization in src/components/TextLayer.css
- [x] T024 [US2] Verify text selection coordinates at zoom levels 50% to 400% in src/components/TextLayer.tsx

**Checkpoint**: Text selection aligns within 2 pixels of visible text at all zoom levels

---

## Phase 5: User Story 3 - Automatic Fit Modes (Priority: P2)

**Goal**: Automatic content scaling to fit window without manual zoom adjustment

**Independent Test**: Open PDFs of different page sizes, resize window - content should automatically scale to fit width/page.

### Implementation for User Story 3

- [x] T025 [US3] Implement fit-to-width calculation in RenderPolicy in src/domain/rendering/RenderPolicy.ts
- [x] T026 [US3] Implement fit-to-page calculation in RenderPolicy in src/domain/rendering/RenderPolicy.ts
- [x] T027 [US3] Update PdfViewer to recalculate fit modes on window resize in src/components/PdfViewer.tsx
- [x] T028 [US3] Add fit mode state to document-store in src/stores/document-store.ts
- [x] T029 [US3] Wire fit mode controls in ZoomControls component in src/components/ZoomControls.tsx

**Checkpoint**: Fit-to-width and fit-to-page modes work correctly with automatic re-render on resize

---

## Phase 6: User Story 4 - Quality Mode Selection (Priority: P2)

**Goal**: User-selectable quality modes (Performance/Balanced/Ultra) with immediate effect

**Independent Test**: Switch between quality modes in settings and observe rendering quality and resource usage changes.

### Implementation for User Story 4

- [x] T030 [US4] Create RenderSettings.tsx component with quality mode selector in src/components/settings/RenderSettings.tsx
- [x] T031 [US4] Add maxMegapixels slider (8-48 MP range) to RenderSettings component in src/components/settings/RenderSettings.tsx
- [x] T032 [US4] Wire RenderSettings to useRenderSettings hook for persistence in src/components/settings/RenderSettings.tsx
- [x] T033 [US4] Add quality mode change handler that triggers immediate re-render in src/components/PdfViewer.tsx
- [x] T034 [US4] Integrate RenderSettings into existing settings panel UI in src/components/settings/SettingsPanel.tsx

**Checkpoint**: Quality mode changes apply immediately and persist across sessions

---

## Phase 7: User Story 5 - Hardware Acceleration Toggle (Priority: P3)

**Goal**: Toggle to disable hardware acceleration for troubleshooting GPU issues

**Independent Test**: Toggle HW acceleration setting, restart app, verify rendering works in both enabled/disabled states.

### Implementation for User Story 5

- [x] T035 [US5] Add hwAccelerationEnabled toggle to RenderSettings UI in src/components/settings/RenderSettings.tsx
- [x] T036 [US5] Add "restart required" indicator when HW acceleration setting changes in src/components/settings/RenderSettings.tsx
- [x] T037 [US5] Configure Windows WebView2 additionalBrowserArgs in src-tauri/tauri.conf.json (Note: Tauri 2.x uses file-based flags instead)
- [x] T038 [US5] Implement Linux WebKitGTK environment variable handling for HW accel in src-tauri/src/lib.rs
- [x] T039 [US5] Read hwAccelerationEnabled setting on app startup to apply WebView config in src-tauri/src/lib.rs
- [x] T040 [US5] Add platform-specific default detection for hwAccelerationEnabled in src-tauri/src/lib.rs
- [x] T041 [US5] Implement safe boot fallback: crash flag detection and recovery dialog in src-tauri/src/lib.rs (FR-015)

**Checkpoint**: Hardware acceleration can be toggled with proper platform-specific implementation

---

## Phase 8: User Story 6 - Rendering Quality Diagnostics (Priority: P3)

**Goal**: Debug overlay showing real-time render parameters for troubleshooting

**Independent Test**: Enable debug overlay, view PDF, verify displayed values match actual rendering parameters.

### Implementation for User Story 6

- [x] T042 [US6] Create DebugOverlay.tsx component in src/components/settings/DebugOverlay.tsx
- [x] T043 [US6] Display viewport size, DPR, output scale, canvas dimensions in DebugOverlay in src/components/settings/DebugOverlay.tsx
- [x] T044 [US6] Display megapixels, memory estimate, quality mode, cap status in DebugOverlay in src/components/settings/DebugOverlay.tsx
- [x] T045 [US6] Add debugOverlayEnabled toggle to settings UI in src/components/settings/RenderSettings.tsx
- [x] T046 [US6] Wire DebugOverlay to PdfViewer with real-time updates on zoom/resize in src/components/PdfViewer.tsx
- [x] T047 [US6] Style DebugOverlay as semi-transparent overlay in corner in src/components/settings/DebugOverlay.tsx

**Checkpoint**: Debug overlay displays accurate, real-time rendering parameters

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, memory safety, and final integration

- [x] T048 [P] Handle mixed page sizes (fit mode per-page calculation) in src/domain/rendering/RenderPolicy.ts
- [x] T049 [P] Add memory exhaustion warning when megapixel cap is applied in src/components/PdfViewer.tsx
- [x] T050 Verify no render thrash during continuous zoom/resize operations (150ms debounce + render task cancellation)
- [x] T051 [P] Ensure backward compatibility with existing pdf-service.ts in src/services/pdf-service.ts
- [x] T052 Run quickstart.md validation scenarios (201 frontend tests + 174 backend tests pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 and US2 can run in parallel (both P1 priority, independent concerns)
  - US3 and US4 can run in parallel (both P2 priority, independent concerns)
  - US5 and US6 can run in parallel (both P3 priority, independent concerns)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core rendering quality
- **User Story 2 (P1)**: Can start after Foundational - Text layer alignment (independent of US1)
- **User Story 3 (P2)**: Can start after Foundational - Fit modes (extends RenderPolicy)
- **User Story 4 (P2)**: Can start after Foundational - Quality mode UI (uses RenderPolicy)
- **User Story 5 (P3)**: Can start after Foundational - HW acceleration (backend focus)
- **User Story 6 (P3)**: Can start after US1/US4 complete - Debug overlay (needs working render pipeline)

### Parallel Opportunities

**Within Setup (Phase 1)**:
- T002 and T003 can run in parallel (different files)

**Within Foundational (Phase 2)**:
- T006, T007, T008 can run in parallel (different files)
- T010, T011, T012, T013 can run in parallel (test files)

**User Stories in Parallel**:
- US1 + US2 can run in parallel (canvas rendering vs text layer)
- US3 + US4 can run in parallel (fit modes vs quality UI)
- US5 + US6 can run in parallel (HW accel vs debug overlay)

---

## Parallel Example: Foundational Phase

```bash
# After T004-T005 complete, launch in parallel:
Task: "Create render-store.ts Zustand store in src/stores/render-store.ts"
Task: "Add render settings commands to src-tauri/src/commands/settings.rs"
Task: "Add RenderSettings entity to src-tauri/src/domain/settings.rs"
```

## Parallel Example: User Stories 1 & 2

```bash
# After Foundational phase, launch in parallel:
Task: "Modify PdfPage.tsx to use RenderPolicy" (US1)
Task: "Set --scale-factor CSS variable on TextLayer" (US2)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (10 tasks, includes 4 test tasks)
3. Complete Phase 3: User Story 1 - Crisp Text (7 tasks)
4. Complete Phase 4: User Story 2 - Text Selection (4 tasks)
5. **STOP and VALIDATE**: PDFs render crisp with accurate text selection
6. Deploy/demo if ready

**MVP Task Count**: 24 tasks

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 + US2 → Core quality improvement
2. **+Fit Modes**: Add US3 → Automatic content scaling
3. **+Quality Control**: Add US4 → User-configurable quality
4. **+Troubleshooting**: Add US5 + US6 → HW toggle and diagnostics
5. **+Polish**: Final phase → Edge cases and validation

### Full Implementation

- **Total Tasks**: 52
- **Tasks by User Story**:
  - Setup: 3
  - Foundational: 10 (includes 4 test tasks per Constitution IV)
  - US1 (Crisp Text): 7
  - US2 (Text Selection): 4
  - US3 (Fit Modes): 5
  - US4 (Quality Modes): 5
  - US5 (HW Acceleration): 7 (includes FR-015 safe boot fallback)
  - US6 (Debug Overlay): 6
  - Polish: 5

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 and US2 are both P1 but address different concerns (canvas vs text layer)
- Test tasks (T010-T013) satisfy Constitution Principle IV (Test Coverage)
- T041 implements FR-015 (safe boot fallback) for crash recovery
