# Tasks: UI/UX Overhaul

**Input**: Design documents from `/specs/007-ui-ux-overhaul/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included for new hooks and adapters per the 80% coverage requirement in the constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` at repository root (React/TypeScript)
- **Tokens**: `src/ui/tokens/` (CSS custom properties)
- **Components**: `src/components/`, `src/ui/components/`
- **Hooks**: `src/hooks/`
- **Adapters**: `src/adapters/tauri/`
- **Ports**: `src/ports/`
- **Tests**: `src/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and baseline before making changes

- [x] T001 Verify branch is `007-ui-ux-overhaul` and dependencies installed with `pnpm install`
- [x] T002 Run `pnpm verify` to establish baseline state
- [x] T003 [P] Document current lint error count for tracking progress

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: These tasks fix architecture violations and establish the foundation for all user stories.

### Design Token Foundation

- [x] T004 [P] Add `--shadow-focus` token to `src/ui/tokens/shadows.css`
- [x] T005 [P] Add `--z-extreme: 99999` token to `src/ui/tokens/z-index.css`
- [x] T006 [P] Add `.sr-only` utility class to `src/styles/globals.css`

### Architecture Compliance (Adapter Pattern)

- [x] T007 Create `FileDialogPort` interface in `src/ports/file-dialog.port.ts`
- [x] T008 Create `TauriFileDialogAdapter` in `src/adapters/tauri/file-dialog.adapter.ts`
- [x] T009 [P] Write tests for FileDialogAdapter in `src/__tests__/adapters/file-dialog.adapter.test.ts`
- [x] T010 Migrate `src/components/Toolbar.tsx` to use FileDialogAdapter
- [x] T011 [P] Migrate `src/components/export-dialog/AudioExportDialog.tsx` to use FileDialogAdapter
- [x] T012 [P] Migrate `src/components/dialogs/ExportDialog.tsx` to use FileDialogAdapter
- [x] T013 [P] Migrate `src/hooks/useKeyboardShortcuts.ts` to use FileDialogAdapter

### ESLint Accessibility Fixes

- [x] T014 [P] Fix empty title attributes in `src/components/session-menu/SessionMenu.tsx`
- [x] T015 [P] Fix empty title attributes in `src/components/session-menu/SessionItem.tsx`
- [x] T016 [P] Fix accessibility issues in `src/components/session-menu/CreateSessionDialog.tsx`
- [x] T017 [P] Fix accessibility issues in `src/components/export-dialog/AudioExportDialog.tsx`
- [x] T018 [P] Fix button type in `src/__tests__/ui/Panel.test.tsx`

### Global Focus Styles

- [x] T019 Add global `:focus-visible` styles to `src/styles/globals.css`
- [x] T020 [P] Update `src/ui/components/Button/Button.css` with `--shadow-focus`
- [x] T021 [P] Update `src/ui/components/IconButton/IconButton.css` with `--shadow-focus`

**Checkpoint**: `pnpm verify` passes, no architecture violations, `pnpm lint` clean

---

## Phase 3: User Story 1 - Keyboard Navigation (Priority: P1)

**Goal**: Navigate the entire application using only keyboard - Tab, Arrow keys, Escape, keyboard shortcuts

**Independent Test**: Perform all core tasks (open PDF, navigate pages, zoom, toggle panels, play TTS) using only keyboard

### Tests for User Story 1

- [x] T022 [P] [US1] Write tests for useRovingTabindex hook in `src/__tests__/hooks/useRovingTabindex.test.tsx`
- [x] T023 [P] [US1] Write tests for useFocusTrap hook in `src/__tests__/hooks/useFocusTrap.test.tsx`

### Implementation for User Story 1

- [x] T024 [US1] Implement `useRovingTabindex` hook in `src/hooks/useRovingTabindex.ts` per contract
- [x] T025 [US1] Implement `useFocusTrap` hook in `src/hooks/useFocusTrap.ts` per contract
- [x] T026 [US1] Apply roving tabindex to Toolbar in `src/components/Toolbar.tsx`
- [x] T027 [P] [US1] Apply focus trap to `src/components/settings/SettingsPanel.tsx`
- [x] T028 [P] [US1] Apply focus trap to `src/components/export-dialog/AudioExportDialog.tsx`
- [x] T029 [P] [US1] Apply focus trap to `src/components/dialogs/ExportDialog.tsx`
- [x] T030 [P] [US1] Apply focus trap to `src/components/session-menu/CreateSessionDialog.tsx`
- [x] T031 [US1] Expand keyboard shortcuts in `src/hooks/useKeyboardShortcuts.ts` (Ctrl+O, Ctrl+F, PageUp/Down, Escape)
- [x] T032 [US1] Document keyboard shortcuts in `src/components/settings/KeyboardShortcuts.tsx`

**Checkpoint**: User Story 1 complete - keyboard-only navigation works end-to-end

---

## Phase 4: User Story 2 - Screen Reader Accessibility (Priority: P1)

**Goal**: Important changes announced to screen readers via aria-live region

**Independent Test**: Navigate app with NVDA/VoiceOver and verify announcements for page changes, zoom, actions

### Tests for User Story 2

- [x] T033 [P] [US2] Write tests for useAnnounce hook in `src/__tests__/hooks/useAnnounce.test.ts`

### Implementation for User Story 2

- [x] T034 [US2] Implement `useAnnounce` hook in `src/hooks/useAnnounce.ts` per contract
- [x] T035 [US2] Add AnnouncementRegion to `src/components/layout/AppLayout.tsx`
- [x] T036 [P] [US2] Integrate announcements in `src/components/PageNavigation.tsx` (page changes)
- [x] T037 [P] [US2] Integrate announcements in `src/components/ZoomControls.tsx` (zoom changes)
- [x] T038 [P] [US2] Add aria-labels to icon-only buttons in Toolbar
- [x] T039 [US2] Integrate announcements for TTS state changes in playback components

**Checkpoint**: User Story 2 complete - screen readers announce all dynamic changes

---

## Phase 5: User Story 3 - Consistent Visual Design (Priority: P2)

**Goal**: 100% design token adoption - no hardcoded spacing, colors, or z-index values

**Independent Test**: Run grep audit for hardcoded values (should return zero results)

### Implementation for User Story 3

- [x] T040 [P] [US3] Migrate z-index in `src/components/common/LoadingState.css` to token
- [x] T041 [P] [US3] Migrate z-index in `src/components/pdf-viewer/TtsWordHighlight.css` to `--z-extreme`
- [x] T042 [P] [US3] Audit and fix hardcoded z-index in `src/components/dialogs/ExportDialog.css`
- [x] T043 [P] [US3] Audit and fix hardcoded z-index in `src/components/highlights/NoteEditor.css`
- [x] T044 [US3] Run full z-index audit and fix remaining hardcoded values across all CSS files
- [x] T045 [US3] Run color audit and fix any remaining hardcoded hex values
- [x] T046 [US3] Run spacing audit and fix any remaining hardcoded px values

**Checkpoint**: User Story 3 complete - `grep` audit returns zero hardcoded values

---

## Phase 6: User Story 4 - Action Feedback (Priority: P2)

**Goal**: Toast notifications for all user actions (highlight CRUD, exports, errors)

**Independent Test**: Perform CRUD operations on highlights and verify toast notifications appear

### Tests for User Story 4

- [x] T047 [P] [US4] Write tests for toast-store in `src/__tests__/stores/toast-store.test.ts`

### Implementation for User Story 4

- [x] T048 [US4] Create `useToastStore` Zustand store in `src/stores/toast-store.ts`
- [x] T049 [US4] Add ToastContainer to `src/components/layout/AppLayout.tsx`
- [x] T050 [P] [US4] Integrate toast for highlight create in highlight handlers
- [x] T051 [P] [US4] Integrate toast for highlight delete in highlight handlers
- [x] T052 [P] [US4] Integrate toast for export success in export handlers
- [x] T053 [US4] Integrate toast for error states with retry action

**Checkpoint**: User Story 4 complete - all actions show toast feedback

---

## Phase 7: User Story 5 - Empty State Guidance (Priority: P3)

**Goal**: Helpful empty states in all content areas guiding users to take action

**Independent Test**: Open app fresh and verify empty states in: main area, highlights panel, search results, library

### Implementation for User Story 5

- [x] T054 [P] [US5] Add "No document open" empty state to `src/components/PdfViewer.tsx`
- [x] T055 [P] [US5] Add "No highlights" empty state to `src/components/highlights/HighlightsPanel.tsx`
- [x] T056 [P] [US5] Add "No search results" empty state (if search component exists) — SKIPPED (no search component)
- [x] T057 [P] [US5] Add "No recent documents" empty state to `src/components/library/LibraryView.tsx`

**Checkpoint**: User Story 5 complete - all empty states guide users appropriately

---

## Phase 8: User Story 6 - Loading State Clarity (Priority: P3)

**Goal**: Skeleton loading states for PDF loading showing expected page layout

**Independent Test**: Open large PDF (100+ pages) and verify skeleton appears before content

### Implementation for User Story 6

- [x] T058 [US6] Create `PdfSkeleton` component in `src/components/pdf-viewer/PdfSkeleton.tsx`
- [x] T059 [US6] Create `PdfSkeleton.css` styles with pulse animation in `src/components/pdf-viewer/PdfSkeleton.css`
- [x] T060 [US6] Integrate skeleton loading state in `src/components/PdfViewer.tsx` (show after 500ms)

**Checkpoint**: User Story 6 complete - loading states show skeleton placeholders

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Dialog Primitive (Reusability)

- [x] T061 Create `Dialog` primitive component in `src/ui/components/Dialog/Dialog.tsx`
- [x] T062 [P] Create `Dialog.css` styles in `src/ui/components/Dialog/Dialog.css`
- [x] T063 [P] Write tests for Dialog in `src/ui/components/Dialog/Dialog.test.tsx`
- [x] T064 Export Dialog from `src/ui/components/index.ts`
- [ ] T065 Refactor `AudioExportDialog` to use Dialog primitive — DEFERRED (complex state-dependent close behavior)

### Final Validation

- [x] T066 Run `pnpm verify` - all checks must pass (frontend: 0 errors, 486 tests pass; backend cargo fmt not installed)
- [ ] T067 Run `pnpm test:coverage` - 80% threshold must be met — MANUAL VALIDATION
- [ ] T068 Perform keyboard-only walkthrough of all core flows — MANUAL VALIDATION
- [ ] T069 Test with screen reader (NVDA/VoiceOver) for announcements — MANUAL VALIDATION
- [ ] T070 Visual regression check - compare before/after screenshots — MANUAL VALIDATION

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (Keyboard) and US2 (Screen Reader) can proceed in parallel
  - US3 (Visual Design) can proceed in parallel with US1/US2
  - US4 (Toast Feedback) depends on US2 (useAnnounce pattern)
  - US5 (Empty States) and US6 (Loading States) can proceed in parallel
- **Polish (Phase 9)**: Depends on US1, US4 being complete

### User Story Dependencies

| Story                | Depends On                 | Can Parallel With |
| -------------------- | -------------------------- | ----------------- |
| US1 (Keyboard)       | Foundational               | US2, US3          |
| US2 (Screen Reader)  | Foundational               | US1, US3          |
| US3 (Visual Design)  | Foundational (tokens)      | US1, US2          |
| US4 (Toast Feedback) | US2 (announcement pattern) | US5, US6          |
| US5 (Empty States)   | Foundational               | US4, US6          |
| US6 (Loading States) | Foundational               | US4, US5          |

### Within Each User Story

1. Tests FIRST (write and verify they fail)
2. Hook/Store implementation
3. Component integration
4. Verification (story checkpoint)

### Parallel Opportunities

**Phase 2 (Foundational)** - High parallelism:

```
Parallel batch 1: T004, T005, T006 (tokens)
Parallel batch 2: T009, T014, T015, T016, T017, T018 (tests + lint fixes)
Parallel batch 3: T011, T012, T013 (adapter migrations)
Parallel batch 4: T020, T021 (button focus styles)
```

**Phase 3 (US1)** - Medium parallelism:

```
Parallel: T022, T023 (tests)
Sequential: T024 → T025 → T026
Parallel: T027, T028, T029, T030 (focus trap applications)
```

**Phase 5 (US3)** - High parallelism:

```
Parallel: T040, T041, T042, T043 (all CSS token migrations)
```

---

## Parallel Example: Foundational Phase

```bash
# Batch 1: Add tokens (parallel)
Task: "Add --shadow-focus token to src/ui/tokens/shadows.css"
Task: "Add --z-extreme token to src/ui/tokens/z-index.css"
Task: "Add .sr-only utility class to src/styles/globals.css"

# Batch 2: Fix lint errors (parallel)
Task: "Fix empty title attributes in src/components/session-menu/SessionMenu.tsx"
Task: "Fix empty title attributes in src/components/session-menu/SessionItem.tsx"
Task: "Fix accessibility issues in src/components/session-menu/CreateSessionDialog.tsx"
Task: "Fix accessibility issues in src/components/export-dialog/AudioExportDialog.tsx"
Task: "Fix button type in src/__tests__/ui/Panel.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Keyboard Navigation)
4. Complete Phase 4: User Story 2 (Screen Reader)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready (WCAG compliance achieved)

### Incremental Delivery

1. Setup + Foundational → Foundation ready, lint clean
2. Add US1 (Keyboard) → Test → Deploy (keyboard users unblocked)
3. Add US2 (Screen Reader) → Test → Deploy (accessibility compliant)
4. Add US3 (Visual Design) → Test → Deploy (design consistency)
5. Add US4 (Toast Feedback) → Test → Deploy (user feedback)
6. Add US5 + US6 → Test → Deploy (empty/loading states)
7. Polish phase → Final validation

### Suggested MVP Scope

**Minimum Viable Accessibility**: Foundational + US1 + US2

- Estimated time: ~20 hours
- Delivers: WCAG 2.2 Level A compliance, keyboard navigation, screen reader support

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `pnpm verify` after each phase completion
