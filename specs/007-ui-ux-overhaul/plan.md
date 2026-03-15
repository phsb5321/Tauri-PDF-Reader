# Implementation Plan: UI/UX Overhaul

**Branch**: `007-ui-ux-overhaul` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-ui-ux-overhaul/spec.md`

## Summary

Implement a professional, consistent, and accessible UI/UX for the Tauri PDF Reader without breaking core flows. The overhaul focuses on: completing design token migration (92%→100%), adding accessibility hooks (focus traps, roving tabindex, ARIA announcements), creating architecture-compliant adapters for `@tauri-apps/plugin-dialog`, and enhancing user feedback through toasts, empty states, and loading skeletons. Changes will be shipped incrementally in slices.

## Technical Context

**Language/Version**: TypeScript 5.6+ (frontend), Rust 2021 edition (backend)  
**Primary Dependencies**: React 18.3+, Zustand 5.x, Vite, Tauri 2.x, tauri-specta  
**Storage**: N/A (this feature is UI-only; existing SQLite/filesystem unchanged)  
**Testing**: Vitest (frontend, 80% coverage threshold), Cargo test with `--features test-mocks` (backend)  
**Target Platform**: Desktop (Windows, macOS, Linux via Tauri)  
**Project Type**: Desktop application with web frontend + Rust backend  
**Performance Goals**: Focus visible within 100ms, page transitions smooth (60fps)  
**Constraints**: No direct `invoke()` calls, all `@tauri-apps/plugin-*` access via adapters, WCAG 2.2 Level A minimum  
**Scale/Scope**: 49 components, 7,986 lines; ~50 hours of refactoring across P0-P2 tasks

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status       | Notes                                                                                                 |
| --------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| **I. Hexagonal Architecture**     | ⚠️ VIOLATION | 4 files import `@tauri-apps/plugin-dialog` directly. **Resolution**: P0-2 creates `FileDialogAdapter` |
| **II. Type-Safe Tauri IPC**       | ✅ PASS      | No new `invoke()` calls; existing adapters used                                                       |
| **III. Test-First Development**   | ✅ PASS      | All new hooks and adapters will include tests (80% threshold)                                         |
| **IV. Design System Consistency** | ⚠️ PARTIAL   | 92% token adoption, 13 hardcoded z-index values. **Resolution**: P0-1 completes migration             |
| **V. State Management Patterns**  | ✅ PASS      | Toast store will follow Zustand patterns with debug logging                                           |

**Violations requiring justification**: None beyond those being resolved as part of this feature (P0-1 and P0-2).

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-ux-overhaul/
├── plan.md              # This file
├── research.md          # Complete - Component audit, accessibility patterns
├── spec.md              # Complete - User stories, requirements
├── ui-spec.md           # Complete - Design tokens, component specs
├── ui-tasks-seed.md     # Complete - Prioritized backlog
├── data-model.md        # To create - Entity definitions
├── quickstart.md        # To create - Implementation guide
├── contracts/           # To create - TypeScript interfaces
│   ├── file-dialog.port.ts
│   ├── announce.hook.ts
│   ├── focus-trap.hook.ts
│   └── roving-tabindex.hook.ts
└── checklists/
    └── requirements.md  # Complete - Validation checklist
```

### Source Code (repository root)

```text
src/
├── adapters/tauri/
│   ├── file-dialog.adapter.ts    # NEW (P0-2)
│   └── ...existing adapters
├── ports/
│   ├── file-dialog.port.ts       # NEW (P0-2)
│   └── ...existing ports
├── hooks/
│   ├── useAnnounce.ts            # NEW (P0-4)
│   ├── useFocusTrap.ts           # NEW (P1-2)
│   ├── useRovingTabindex.ts      # NEW (P1-1)
│   └── ...existing hooks
├── stores/
│   ├── toast-store.ts            # NEW (P1-5)
│   └── ...existing stores
├── ui/
│   ├── components/
│   │   ├── Dialog/               # NEW (P1-3)
│   │   │   ├── Dialog.tsx
│   │   │   ├── Dialog.css
│   │   │   └── Dialog.test.tsx
│   │   └── ...existing primitives
│   └── tokens/
│       ├── shadows.css           # MODIFY: add --shadow-focus
│       ├── z-index.css           # MODIFY: add --z-extreme
│       └── ...existing tokens
├── components/
│   ├── pdf-viewer/
│   │   ├── PdfSkeleton.tsx       # NEW (P1-7)
│   │   └── ...existing
│   └── ...existing (CSS token migration)
└── styles/
    └── globals.css               # MODIFY: add global focus styles

src-tauri/                        # No changes planned for this feature
```

**Structure Decision**: This feature extends the existing Tauri app structure. All new code follows the established hexagonal architecture:

- **Ports** in `src/ports/` (interfaces)
- **Adapters** in `src/adapters/tauri/` (implementations)
- **Hooks** in `src/hooks/` (React hooks)
- **Primitives** in `src/ui/components/` (reusable UI)

## Complexity Tracking

| Violation | Why Needed               | Simpler Alternative Rejected Because |
| --------- | ------------------------ | ------------------------------------ |
| N/A       | No complexity violations | Feature follows existing patterns    |

---

## Implementation Phases

### Phase 0: Foundation (P0 Tasks) - ~15 hours

| Task                                      | Hours | Deliverable                           |
| ----------------------------------------- | ----- | ------------------------------------- |
| P0-5: Fix LSP/ESLint accessibility errors | 3     | Clean lint output                     |
| P0-1: Complete design token migration     | 4     | 100% token adoption                   |
| P0-3: Implement focus visible styles      | 2     | `--shadow-focus` token, global styles |
| P0-4: Add ARIA live region                | 2     | `useAnnounce` hook                    |
| P0-2: Create FileDialogAdapter            | 4     | Adapter + port, 4 files migrated      |

**Checkpoint**: `pnpm verify` passes, no architecture violations

### Phase 1: Core Accessibility (P1 Tasks) - ~35 hours

| Task                               | Hours | Deliverable              |
| ---------------------------------- | ----- | ------------------------ |
| P1-2: Add focus trap to modals     | 4     | `useFocusTrap` hook      |
| P1-1: Implement roving tabindex    | 6     | `useRovingTabindex` hook |
| P1-3: Extract Dialog primitive     | 6     | `Dialog` component       |
| P1-5: Add toast feedback           | 3     | `toast-store.ts`         |
| P1-6: Implement empty states       | 4     | EmptyState usage         |
| P1-7: Add loading skeletons        | 4     | `PdfSkeleton` component  |
| P1-4: Implement keyboard shortcuts | 8     | Expanded shortcuts       |

**Checkpoint**: Keyboard-only workflow complete, screen reader announcements working

### Phase 2: Polish (P2 Tasks) - ~76 hours (future scope)

Deferred to future sprints: PdfViewer refactor, command palette, sidebar redesign, Storybook.

---

## Risk Assessment

| Risk                                      | Likelihood | Impact | Mitigation                                    |
| ----------------------------------------- | ---------- | ------ | --------------------------------------------- |
| Focus trap breaks existing flows          | Medium     | High   | Comprehensive testing, feature flag if needed |
| Token migration causes visual regressions | Low        | Medium | Visual comparison before/after                |
| Architecture boundary tests fail          | Medium     | High   | Run `pnpm lint` after each file change        |

---

## Related Documents

- [spec.md](./spec.md) - Feature specification
- [research.md](./research.md) - Audit findings
- [ui-spec.md](./ui-spec.md) - Design system
- [ui-tasks-seed.md](./ui-tasks-seed.md) - Task backlog
- [data-model.md](./data-model.md) - Entity definitions
- [quickstart.md](./quickstart.md) - Implementation guide
