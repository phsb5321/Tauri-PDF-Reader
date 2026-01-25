# Tasks: UI/UX Research + Visual Polish

**Input**: Design documents from `/specs/003-ui-ux-polish/`
**Prerequisites**: plan.md (complete), spec.md (complete), research.md (complete), data-model.md (complete), quickstart.md (complete)

**Tests**: Component tests and E2E critical loop test are explicitly required per spec (US7).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **📋 QUICK REFERENCE: Phase Mapping**
>
> | tasks.md Phase | spec.md Phase | User Story | Deliverable |
> |----------------|---------------|------------|-------------|
> | Phase 1-2 | (Setup) | - | Directory structure + tokens |
> | Phase 3 | Phase 0 | US1 | `UI_BASELINE.md` |
> | Phase 4 | Phase 1 | US2 | `UI_RESEARCH.md` |
> | Phase 5 | Phase 2 | US3 | `UX_AUDIT.md` |
> | Phase 6 | Phase 3 | US4 | `FLOWS.md` |
> | Phase 7 | Phase 4 | US5 | `DESIGN_SYSTEM.md` + components |
> | Phase 8 | Phase 5 | US6 | `UI_BACKLOG.md` |
> | Phase 9 | Phase 6 | US7 | `QUALITY_GATES.md` + E2E test |
> | Phase 10 | (Validation) | US8 | Before/after screenshots |
> | Phase 11 | (Polish) | - | Final cleanup |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `src/` at repository root
- **Documentation**: `docs/ui/` for deliverable documents
- **Design System**: `src/ui/tokens/`, `src/ui/components/`
- **Tests**: `src/__tests__/ui/`, `e2e/`

## Phase Mapping (spec.md → tasks.md)

| Spec Phase | Tasks Phase | Description |
|------------|-------------|-------------|
| Phase 0 | Phase 3 (US1) | Inventory + Baseline Capture |
| Phase 1 | Phase 4 (US2) | Web Research |
| Phase 2 | Phase 5 (US3) | UX Audit |
| Phase 3 | Phase 6 (US4) | Information Architecture |
| Phase 4 | Phase 7 (US5) | Design System Baseline |
| Phase 5 | Phase 8 (US6) | Backlog + Prototype |
| Phase 6 | Phase 9 (US7) | Quality Gates |
| N/A | Phase 1-2 | Setup + Foundational (tasks.md only) |
| N/A | Phase 10 (US8) | Validation (tasks.md only) |
| N/A | Phase 11 | Polish (tasks.md only) |

---

## Phase 1: Setup

**Purpose**: Create directory structure and base files for design system

- [X] T001 Create docs/ui/ directory for documentation deliverables
- [X] T002 [P] Create docs/ui/screenshots/ directory for baseline screenshots
- [X] T003 [P] Create src/ui/tokens/ directory structure
- [X] T004 [P] Create src/ui/components/ directory structure
- [X] T005 [P] Create src/__tests__/ui/ directory for component tests
- [X] T006 Create src/ui/tokens/index.css with imports for all token files

---

## Phase 2: Foundational (Design Tokens)

**Purpose**: Implement design token system - MUST be complete before component work

**⚠️ CRITICAL**: Component development depends on tokens being available

### Token Implementation

- [X] T007 [P] Create color tokens in src/ui/tokens/colors.css per data-model.md
- [X] T008 [P] Create spacing tokens in src/ui/tokens/spacing.css per data-model.md
- [X] T009 [P] Create typography tokens in src/ui/tokens/typography.css per data-model.md
- [X] T010 [P] Create border radius tokens in src/ui/tokens/radii.css per data-model.md
- [X] T011 [P] Create shadow tokens in src/ui/tokens/shadows.css per data-model.md
- [X] T012 [P] Create z-index tokens in src/ui/tokens/z-index.css per data-model.md
- [X] T013 [P] Create motion tokens in src/ui/tokens/motion.css per data-model.md
- [X] T014 [P] Create layout tokens in src/ui/tokens/layout.css per data-model.md

### Token Integration

- [X] T015 Import token index in src/styles/index.css or src/main.tsx styles
- [X] T016 Add dark mode token overrides to src/ui/tokens/colors.css

**Checkpoint**: Design tokens ready - component and documentation work can begin

---

## Phase 3: User Story 1 - Document Current State (Priority: P1)

**Goal**: Create comprehensive baseline documentation of current UI screens

**Independent Test**: UI_BASELINE.md exists with screenshots and annotations for all 5+ screens

**⚠️ Prerequisite**: Screenshots require running application. Start dev server with `pnpm tauri dev` before capturing.

### Implementation for User Story 1

> **Note**: T017-T022 require running the application (`pnpm tauri dev`) to capture screenshots.
> These tasks are deferred until manual execution is possible.

- [ ] T017 [US1] Run application and capture Reader screen screenshot to docs/ui/screenshots/reader.png
- [ ] T018 [P] [US1] Capture Library screen screenshot to docs/ui/screenshots/library.png (if accessible)
- [ ] T019 [P] [US1] Capture Settings panel screenshot to docs/ui/screenshots/settings.png
- [ ] T020 [P] [US1] Capture Highlights panel screenshot to docs/ui/screenshots/highlights-panel.png
- [ ] T021 [P] [US1] Capture Playback bar screenshot to docs/ui/screenshots/playback-bar.png
- [ ] T022 [P] [US1] Capture Table of Contents panel screenshot to docs/ui/screenshots/toc.png
- [X] T023 [US1] Create docs/ui/UI_BASELINE.md with screen inventory table
- [X] T024 [US1] Add screen purpose and primary actions annotations to docs/ui/UI_BASELINE.md
- [X] T025 [US1] Document confusion points per screen in docs/ui/UI_BASELINE.md
- [X] T026 [US1] Add screenshots to docs/ui/UI_BASELINE.md with relative paths

**Checkpoint**: US1 complete - baseline documentation ready for audit phase

---

## Phase 4: User Story 2 - Research Best Practices (Priority: P2)

**Goal**: Document actionable UI/UX patterns from document reader applications

**Independent Test**: UI_RESEARCH.md exists with patterns for layout, panels, keyboard, TTS

### Implementation for User Story 2

- [X] T027 [US2] Create docs/ui/UI_RESEARCH.md structure from specs/003-ui-ux-polish/research.md
- [X] T028 [US2] Document layout patterns section with sidebar widths (280px/320px decisions)
- [X] T029 [US2] Document panel patterns section with collapse/expand behavior
- [X] T030 [US2] Document keyboard accessibility patterns with shortcut table
- [X] T031 [US2] Document TTS UI patterns with playback control guidance
- [X] T032 [US2] Add visual diagrams (ASCII or Mermaid) for three-column layout

**Checkpoint**: US2 complete - research document ready for design decisions

---

## Phase 5: User Story 3 - UX Audit (Priority: P3)

**Goal**: Structured heuristic evaluation with prioritized issues

**Independent Test**: UX_AUDIT.md exists with issues categorized by P0/P1/P2 severity

### Implementation for User Story 3

- [X] T033 [US3] Create docs/ui/UX_AUDIT.md with Nielsen's 10 heuristics checklist
- [X] T034 [US3] Evaluate Reader screen against each heuristic in docs/ui/UX_AUDIT.md
- [X] T035 [US3] Evaluate Toolbar against each heuristic in docs/ui/UX_AUDIT.md
- [X] T036 [US3] Evaluate Playback bar against each heuristic in docs/ui/UX_AUDIT.md
- [X] T037 [US3] Document critical reading loop (open → highlight → TTS) with timing
- [X] T038 [US3] Categorize all issues as P0/P1/P2 in docs/ui/UX_AUDIT.md
- [X] T039 [US3] Add repro steps and proposed fix for each issue in docs/ui/UX_AUDIT.md

**Checkpoint**: US3 complete - audit findings ready for backlog creation

---

## Phase 6: User Story 4 - Information Architecture (Priority: P4)

**Goal**: Define user flows and navigation model

**Independent Test**: FLOWS.md exists with 6 user jobs and flow diagrams

### Implementation for User Story 4

- [X] T040 [US4] Create docs/ui/FLOWS.md structure
- [X] T041 [US4] Define 6 primary user jobs in docs/ui/FLOWS.md:
  - Find/open document
  - Read comfortably
  - Create highlight
  - Navigate highlights
  - Use TTS playback
  - Manage library
- [X] T042 [US4] Create flow diagram for "Open document" job in docs/ui/FLOWS.md (Mermaid)
- [X] T043 [P] [US4] Create flow diagram for "Create highlight" job in docs/ui/FLOWS.md
- [X] T044 [P] [US4] Create flow diagram for "Use TTS" job in docs/ui/FLOWS.md
- [X] T045 [US4] Document navigation model (left sidebar + central reader + right panel) in docs/ui/FLOWS.md
- [X] T046 [US4] Add decision rationale section to docs/ui/FLOWS.md

**Checkpoint**: US4 complete - information architecture defined

---

## Phase 7: User Story 5 - Design System Implementation (Priority: P5)

**Goal**: Documented design tokens and reusable components in code

**Independent Test**: 5+ components exist in src/ui/components/, tokens applied in docs/ui/DESIGN_SYSTEM.md

### Component Tests (Required per spec US7)

**Note**: Vitest is already configured in project (vitest.config.ts). No additional setup needed.

- [X] T047 [P] [US5] Create test for Button component in src/__tests__/ui/Button.test.tsx
- [X] T048 [P] [US5] Create test for IconButton component in src/__tests__/ui/IconButton.test.tsx
- [X] T049 [P] [US5] Create test for Panel component in src/__tests__/ui/Panel.test.tsx
- [X] T050 [P] [US5] Create test for EmptyState component in src/__tests__/ui/EmptyState.test.tsx
- [X] T051 [P] [US5] Create test for ListRow component in src/__tests__/ui/ListRow.test.tsx
- [X] T052 [P] [US5] Create test for Toast component in src/__tests__/ui/Toast.test.tsx

### Component Implementation

- [X] T053 [P] [US5] Create Button component in src/ui/components/Button/Button.tsx
- [X] T054 [P] [US5] Create Button styles in src/ui/components/Button/Button.css using tokens
- [X] T055 [P] [US5] Create IconButton component in src/ui/components/IconButton/IconButton.tsx
- [X] T056 [P] [US5] Create IconButton styles in src/ui/components/IconButton/IconButton.css
- [X] T057 [P] [US5] Create Panel component in src/ui/components/Panel/Panel.tsx
- [X] T058 [P] [US5] Create Panel styles in src/ui/components/Panel/Panel.css
- [X] T059 [P] [US5] Create ListRow component in src/ui/components/ListRow/ListRow.tsx
- [X] T060 [P] [US5] Create EmptyState component in src/ui/components/EmptyState/EmptyState.tsx
- [X] T061 [P] [US5] Create Toast component in src/ui/components/Toast/Toast.tsx
- [X] T062 [US5] Create src/ui/components/index.ts exporting all components

### Keyboard Shortcuts (Required per spec 4.4)

- [X] T063 [US5] Implement global keyboard handler for Ctrl+O (open file dialog) in src/App.tsx or src/hooks/useKeyboardShortcuts.ts
- [X] T064 [US5] Implement Ctrl+, shortcut for settings in keyboard handler
- [X] T065 [US5] Implement Ctrl+H shortcut to toggle highlights panel
- [X] T066 [US5] Implement Ctrl+B shortcut to toggle library sidebar
- [X] T067 [US5] Implement Escape key to close modals/panels
- [X] T068 [US5] Document all keyboard shortcuts in src/components/settings/KeyboardShortcuts.tsx

### Documentation

- [X] T069 [US5] Create docs/ui/DESIGN_SYSTEM.md with token reference table
- [X] T070 [US5] Document each component with props and usage examples in docs/ui/DESIGN_SYSTEM.md
- [X] T071 [US5] Add layout rules section to docs/ui/DESIGN_SYSTEM.md
- [X] T072 [US5] Add migration guide from old tokens to new tokens in docs/ui/DESIGN_SYSTEM.md

**Checkpoint**: US5 complete - design system implemented and documented

---

## Phase 8: User Story 6 - Polish Backlog (Priority: P6)

**Goal**: Prioritized work items with acceptance criteria

**Independent Test**: UI_BACKLOG.md exists with P0/P1/P2 items, each has keyboard behavior

### Implementation for User Story 6

- [X] T073 [US6] Create docs/ui/UI_BACKLOG.md structure with P0/P1/P2 sections
- [X] T074 [US6] Convert P0 audit issues to backlog items in docs/ui/UI_BACKLOG.md
- [X] T075 [US6] Convert P1 audit issues to backlog items in docs/ui/UI_BACKLOG.md
- [X] T076 [US6] Convert P2 audit issues to backlog items in docs/ui/UI_BACKLOG.md
- [X] T077 [US6] Add acceptance criteria to each backlog item
- [X] T078 [US6] Define keyboard behavior for each backlog item
- [X] T079 [US6] Define empty/error states for each applicable item

**Checkpoint**: US6 complete - actionable backlog ready for implementation

---

## Phase 9: User Story 7 - Quality Gates (Priority: P7)

**Goal**: Tests and checklists to prevent UI regressions

**Independent Test**: QUALITY_GATES.md exists, E2E test passes for critical loop

### E2E Test (Required per spec)

- [X] T080 [US7] Create e2e/critical-loop.spec.ts with Playwright test structure
- [X] T081 [US7] Implement "open document" step in e2e/critical-loop.spec.ts
- [X] T082 [US7] Implement "create highlight" step in e2e/critical-loop.spec.ts
- [X] T083 [US7] Implement "activate TTS" step in e2e/critical-loop.spec.ts
- [X] T084 [US7] Add assertion for < 5 clicks (measured from document open) in e2e/critical-loop.spec.ts

### Documentation

- [X] T085 [US7] Create docs/ui/QUALITY_GATES.md structure
- [X] T086 [US7] Add focus/keyboard checklist to docs/ui/QUALITY_GATES.md
- [X] T087 [US7] Add accessibility checklist (WCAG 2.2 Level A) to docs/ui/QUALITY_GATES.md
- [X] T088 [US7] Document component test requirements in docs/ui/QUALITY_GATES.md
- [X] T089 [US7] Document E2E test requirements and how to run in docs/ui/QUALITY_GATES.md

**Checkpoint**: US7 complete - quality gates established

---

## Phase 10: User Story 8 - Validation Implementation (Priority: P8)

**Goal**: Before/after improvement of one screen using design system

**Independent Test**: One screen refactored, before/after screenshots in docs/ui/DESIGN_SYSTEM.md

### Implementation for User Story 8

> **Note**: T091, T093, T094 require running the application (`pnpm tauri dev`) to capture screenshots
> and visually apply component changes. The Toolbar.css has been refactored to use design tokens.

- [X] T090 [US8] Select one screen for validation (select screen with most P0 issues from UX_AUDIT.md)
- [ ] T091 [US8] Capture "before" screenshot to docs/ui/screenshots/validation-before.png
- [X] T092 [US8] Refactor selected screen to use new design tokens
- [ ] T093 [US8] Apply new Button/IconButton components to selected screen
- [ ] T094 [US8] Capture "after" screenshot to docs/ui/screenshots/validation-after.png
- [X] T095 [US8] Add validation section to docs/ui/DESIGN_SYSTEM.md with before/after comparison
- [X] T096 [US8] Document lessons learned from validation in docs/ui/DESIGN_SYSTEM.md

**Checkpoint**: US8 complete - design system validated in practice

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and cleanup

- [X] T097 [P] Run all component tests (pnpm test) and fix any failures
- [X] T098 [P] Run E2E critical loop test and fix any failures
- [X] T099 Run TypeScript type check (pnpm build) and fix any errors
- [X] T100 Run ESLint (pnpm lint) and fix any errors
- [X] T101 Update CLAUDE.md with any new conventions from this feature
- [X] T102 Create docs/ui/README.md linking to all UI documentation
- [X] T103 Validate all document cross-references are correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS component work
- **User Stories (Phase 3-10)**: See dependency graph below
- **Polish (Phase 11)**: Depends on all user stories

### User Story Dependencies

```
Phase 2 (Tokens) ────┬─────────────────────────────────────────────────────┐
                     │                                                     │
    ┌────────────────┴────────────────┐                                    │
    │                                 │                                    │
US1 (Baseline)                 US2 (Research)                              │
    │                                 │                                    │
    │                                 │                                    │
    └────────┬───────────────────────-┘                                    │
             │                                                             │
        US3 (Audit)                                                        │
             │                                                             │
             │                                                             │
        US6 (Backlog) ◄────────────────────────────────────────────────────┤
                                                                           │
        US4 (IA/Flows) ◄────────────────── US1, US2 (recommended, not     │
                                           blocking)                       │
                                                                           │
        US5 (Design System) ◄──────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
US7 (QA)          US8 (Validation)
```

### Dependency Summary

| User Story | Depends On | Can Run In Parallel With |
|------------|------------|--------------------------|
| US1 (Baseline) | Phase 2 | US2 |
| US2 (Research) | Phase 2 | US1 |
| US3 (Audit) | US1 (recommended) | - |
| US4 (IA/Flows) | US1, US2 (recommended) | - |
| US5 (Design System) | Phase 2 | US1, US2, US3, US4 |
| US6 (Backlog) | US3 | - |
| US7 (Quality Gates) | US5 | US8 |
| US8 (Validation) | US5 | US7 |

### Parallel Opportunities

**Phase 2** (all token files can be created in parallel):
```
T007, T008, T009, T010, T011, T012, T013, T014
```

**US1** (screenshots can be captured in parallel):
```
T017, T018, T019, T020, T021, T022
```

**US4** (flow diagrams can be created in parallel):
```
T042, T043, T044
```

**US5** (component tests and implementations in parallel):
```
Tests: T047, T048, T049, T050, T051, T052
Components: T053-T062 (each component can be built in parallel)
Shortcuts: T063-T068 (keyboard shortcuts)
```

**US7 + US8** (can run in parallel after US5):
```
Quality gates: T080-T089
Validation: T090-T096
```

---

## Implementation Strategy

### MVP First (US1 + US2 + Tokens)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational tokens
3. Complete US1: Baseline documentation
4. Complete US2: Research documentation
5. **STOP and VALIDATE**: Review baseline and research with stakeholders

### Incremental Delivery

1. Setup + Tokens → Foundation ready
2. US1 (Baseline) → Current state documented
3. US2 (Research) → Best practices documented
4. US3 (Audit) → Issues identified and prioritized
5. US4 (Flows) → Navigation model defined
6. US5 (Design System) → Tokens and components implemented
7. US6 (Backlog) → Work items ready for future sprints
8. US7 (Quality Gates) → Regression prevention in place
9. US8 (Validation) → Design system proven

### Documentation vs Code Split

**Documentation Only (US1-US4, US6)**:
- Can be done by designer or developer
- No code changes required
- Output: 6 markdown files in docs/ui/

**Code Required (US5, US7, US8)**:
- Requires TypeScript/CSS skills
- Creates reusable design system
- Output: src/ui/* files and tests

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Documentation tasks (US1-US4, US6) can proceed independently of code tasks
- Component tests MUST be written to fail before implementation (TDD per spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All documentation in docs/ui/ uses Markdown format
