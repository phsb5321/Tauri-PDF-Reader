# UI/UX Overhaul - Task Backlog

**Feature**: 007-ui-ux-overhaul  
**Date**: 2026-02-01  
**Status**: Seed (ready for `/speckit.plan` and `/speckit.tasks`)

---

## Overview

This backlog prioritizes UI/UX improvements based on:
1. **Impact**: User-facing value and accessibility compliance
2. **Effort**: Quick wins first, larger refactors later
3. **Dependencies**: Foundation before features

**Milestone Mapping**:
- **Viewer Polish (Current)**: P0 items for core reading experience
- **Highlights UX Readiness (Next)**: P1 items for annotation workflow
- **Power User Features (Future)**: P2 items for advanced functionality

---

## P0 - Critical (Must Have)

### P0-1: Complete Design Token Migration

**Priority**: P0 | **Effort**: 2-4 hours | **Category**: Foundation

Replace all hardcoded values with design tokens to ensure consistency.

**Acceptance Criteria**:
- [ ] Replace 13 hardcoded z-index values with token references
- [ ] Replace ~14 hardcoded color values with semantic tokens
- [ ] Add `--shadow-focus` token to `shadows.css`
- [ ] Add `--z-extreme: 99999` token for TTS word highlight
- [ ] No hardcoded px values for spacing (use `--space-*`)
- [ ] Run `grep` audit passes (no hardcoded `#` colors, no raw `z-index`)

**Files to modify**:
- `src/ui/tokens/shadows.css` (add `--shadow-focus`)
- `src/ui/tokens/z-index.css` (add `--z-extreme`)
- `src/components/common/LoadingState.css`
- `src/components/dialogs/ExportDialog.css`
- `src/components/highlights/NoteEditor.css`
- `src/components/pdf-viewer/TtsWordHighlight.css`
- (11 other CSS files with hardcoded z-index)

**Quick Win**: Yes (2 hours)

---

### P0-2: Create FileDialogAdapter

**Priority**: P0 | **Effort**: 4 hours | **Category**: Architecture

Create adapter for `@tauri-apps/plugin-dialog` to maintain hexagonal architecture.

**Acceptance Criteria**:
- [ ] Create `src/adapters/tauri/file-dialog.adapter.ts`
- [ ] Define `FileDialogPort` interface in `src/ports/`
- [ ] Wrap `open()` and `save()` functions
- [ ] Update 4 violating files to use adapter
- [ ] ESLint boundary rules pass
- [ ] Tests cover adapter functionality

**Files to modify**:
- Create: `src/ports/file-dialog.port.ts`
- Create: `src/adapters/tauri/file-dialog.adapter.ts`
- Modify: `src/components/export-dialog/AudioExportDialog.tsx`
- Modify: `src/components/dialogs/ExportDialog.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/hooks/useKeyboardShortcuts.ts`

**Medium Refactor**: Yes (4 hours)

---

### P0-3: Implement Focus Visible Styles

**Priority**: P0 | **Effort**: 2 hours | **Category**: Accessibility

Add consistent focus indicators across all interactive elements.

**Acceptance Criteria**:
- [ ] Define `--shadow-focus` token with 2px ring
- [ ] Apply `:focus-visible` styles to all buttons
- [ ] Apply focus styles to all form inputs
- [ ] Focus ring visible in both light and dark modes
- [ ] Contrast ratio meets WCAG 2.4.7 (3:1 minimum)
- [ ] No elements have focus outline removed without replacement

**Files to modify**:
- `src/ui/tokens/shadows.css`
- `src/ui/components/Button/Button.css`
- `src/ui/components/IconButton/IconButton.css`
- `src/styles/globals.css` (add global focus styles)

**Quick Win**: Yes (2 hours)

---

### P0-4: Add ARIA Live Region for Announcements

**Priority**: P0 | **Effort**: 2 hours | **Category**: Accessibility

Add screen reader announcements for dynamic content changes.

**Acceptance Criteria**:
- [ ] Create `<div role="status" aria-live="polite">` container
- [ ] Announce page changes: "Page X of Y"
- [ ] Announce zoom changes: "Zoom 100%"
- [ ] Announce TTS state changes: "Playing", "Paused"
- [ ] Create `useAnnounce()` hook for reuse
- [ ] Container is visually hidden but accessible

**Files to create/modify**:
- Create: `src/hooks/useAnnounce.ts`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/PageNavigation.tsx`
- Modify: `src/components/ZoomControls.tsx`

**Quick Win**: Yes (2 hours)

---

### P0-5: Fix LSP/ESLint Accessibility Errors

**Priority**: P0 | **Effort**: 3 hours | **Category**: Accessibility

Fix existing linter errors related to accessibility.

**Acceptance Criteria**:
- [ ] Fix empty `title` attributes in `SessionMenu.tsx`, `SessionItem.tsx`, `CreateSessionDialog.tsx`
- [ ] Add `type="button"` to all buttons in dialogs
- [ ] Associate form labels with inputs in `AudioExportDialog.tsx`
- [ ] Add keyboard event handlers alongside `onClick` handlers
- [ ] Replace array index keys with stable identifiers
- [ ] `pnpm lint` passes with no errors

**Files to modify**:
- `src/components/session-menu/SessionMenu.tsx`
- `src/components/session-menu/SessionItem.tsx`
- `src/components/session-menu/CreateSessionDialog.tsx`
- `src/components/export-dialog/AudioExportDialog.tsx`
- `src/__tests__/ui/Panel.test.tsx`

**Quick Win**: Yes (3 hours)

---

## P1 - Important (Should Have)

### P1-1: Implement Roving Tabindex in Toolbar

**Priority**: P1 | **Effort**: 6 hours | **Category**: Accessibility

Make toolbar keyboard-navigable with single Tab stop and arrow keys.

**Acceptance Criteria**:
- [ ] Toolbar has `role="toolbar"` and `aria-label`
- [ ] Only one button has `tabindex="0"` at a time
- [ ] Arrow keys move focus between buttons
- [ ] `Home`/`End` move to first/last button
- [ ] Focus wraps or stops at boundaries (configurable)
- [ ] Create reusable `useRovingTabindex()` hook
- [ ] Unit tests cover keyboard navigation

**Files to create/modify**:
- Create: `src/hooks/useRovingTabindex.ts`
- Modify: `src/components/Toolbar.tsx`

**Medium Refactor**: Yes (6 hours)

---

### P1-2: Add Focus Trap to Modal Dialogs

**Priority**: P1 | **Effort**: 4 hours | **Category**: Accessibility

Prevent focus from escaping modal dialogs.

**Acceptance Criteria**:
- [ ] Tab cycles within dialog (doesn't escape)
- [ ] Shift+Tab cycles backward
- [ ] Escape closes dialog
- [ ] Focus moves to dialog on open
- [ ] Focus returns to trigger on close
- [ ] Create reusable `useFocusTrap()` hook
- [ ] Apply to: SettingsPanel, AudioExportDialog, ExportDialog, CreateSessionDialog

**Files to create/modify**:
- Create: `src/hooks/useFocusTrap.ts`
- Modify: `src/components/settings/SettingsPanel.tsx`
- Modify: `src/components/export-dialog/AudioExportDialog.tsx`
- Modify: `src/components/dialogs/ExportDialog.tsx`
- Modify: `src/components/session-menu/CreateSessionDialog.tsx`

**Medium Refactor**: Yes (4 hours)

---

### P1-3: Extract Dialog Primitive Component

**Priority**: P1 | **Effort**: 6 hours | **Category**: Components

Create reusable Dialog component from existing export dialogs.

**Acceptance Criteria**:
- [ ] Create `src/ui/components/Dialog/Dialog.tsx`
- [ ] Support sizes: sm, md, lg, xl
- [ ] Include header with title and close button
- [ ] Include optional footer for actions
- [ ] Focus trap built-in
- [ ] Keyboard navigation (Escape to close)
- [ ] Portal rendering (outside main DOM tree)
- [ ] Refactor AudioExportDialog to use primitive
- [ ] Add Storybook stories for all variants

**Files to create/modify**:
- Create: `src/ui/components/Dialog/Dialog.tsx`
- Create: `src/ui/components/Dialog/Dialog.css`
- Create: `src/ui/components/Dialog/Dialog.test.tsx`
- Modify: `src/ui/components/index.ts` (add export)
- Modify: `src/components/export-dialog/AudioExportDialog.tsx`

**Medium Refactor**: Yes (6 hours)

---

### P1-4: Implement Core Keyboard Shortcuts

**Priority**: P1 | **Effort**: 8 hours | **Category**: UX

Add essential keyboard shortcuts for PDF navigation.

**Acceptance Criteria**:
- [ ] `Ctrl/Cmd+O`: Open file dialog
- [ ] `Ctrl/Cmd+F`: Open search
- [ ] `PageDown`/`→`: Next page
- [ ] `PageUp`/`←`: Previous page
- [ ] `Ctrl/Cmd++`: Zoom in
- [ ] `Ctrl/Cmd+-`: Zoom out
- [ ] `Space`: Play/Pause TTS (when not in text input)
- [ ] `Escape`: Close dialog/panel
- [ ] Shortcuts work globally (not just when viewer focused)
- [ ] Shortcuts documented in Settings > Keyboard Shortcuts
- [ ] Platform-aware display (Cmd vs Ctrl)

**Files to modify**:
- `src/hooks/useKeyboardShortcuts.ts` (expand)
- `src/components/settings/KeyboardShortcuts.tsx`
- `src/stores/document-store.ts` (expose actions)

**Larger Effort**: Yes (8 hours)

---

### P1-5: Add Toast Feedback for CRUD Operations

**Priority**: P1 | **Effort**: 3 hours | **Category**: UX

Show toast notifications for user actions.

**Acceptance Criteria**:
- [ ] Toast on highlight create: "Highlight added"
- [ ] Toast on highlight delete: "Highlight removed"
- [ ] Toast on export complete: "Export saved to Downloads"
- [ ] Toast on settings save: "Settings updated"
- [ ] Toast on error with retry action
- [ ] Create toast store/context for global access
- [ ] Toasts stack in bottom-right corner
- [ ] Auto-dismiss after 5 seconds

**Files to create/modify**:
- Create: `src/stores/toast-store.ts` or use context
- Modify: `src/components/layout/AppLayout.tsx` (add toast container)
- Modify: Highlight CRUD handlers
- Modify: Export handlers
- Modify: Settings save handler

**Quick Win**: Yes (3 hours)

---

### P1-6: Implement Consistent Empty States

**Priority**: P1 | **Effort**: 4 hours | **Category**: UX

Add EmptyState component usage across the app.

**Acceptance Criteria**:
- [ ] "No document open" state with Open action
- [ ] "No highlights" state in HighlightsPanel
- [ ] "No search results" state
- [ ] "No recent documents" in library
- [ ] All states use EmptyState primitive
- [ ] Icons from consistent set
- [ ] Primary and secondary actions where appropriate

**Files to modify**:
- `src/components/PdfViewer.tsx` (no doc state)
- `src/components/highlights/HighlightsPanel.tsx`
- `src/components/library/LibraryView.tsx`
- Potentially create search component

**Medium Refactor**: Yes (4 hours)

---

### P1-7: Add Loading Skeletons for PDF

**Priority**: P1 | **Effort**: 4 hours | **Category**: UX

Show skeleton loading state when PDF is loading.

**Acceptance Criteria**:
- [ ] Create `PdfSkeleton` component
- [ ] Show after 500ms of loading (avoid flash)
- [ ] Skeleton matches page layout structure
- [ ] Pulse/shimmer animation
- [ ] Replaces spinner for content areas
- [ ] Page number shows placeholder

**Files to create/modify**:
- Create: `src/components/pdf-viewer/PdfSkeleton.tsx`
- Create: `src/components/pdf-viewer/PdfSkeleton.css`
- Modify: `src/components/PdfViewer.tsx`

**Medium Refactor**: Yes (4 hours)

---

## P2 - Nice to Have (Future)

### P2-1: Refactor PdfViewer.tsx

**Priority**: P2 | **Effort**: 16 hours | **Category**: Architecture

Split PdfViewer.tsx (620 lines) into focused modules.

**Acceptance Criteria**:
- [ ] Extract rendering logic to `usePdfRenderer` hook
- [ ] Extract navigation logic to `usePdfNavigation` hook
- [ ] Extract highlight interaction to `useHighlightInteraction` hook
- [ ] Main component becomes orchestrator (<200 lines)
- [ ] All existing tests pass
- [ ] No functionality regression

**Larger Redesign**: Yes (16 hours)

---

### P2-2: Extract Additional Primitives

**Priority**: P2 | **Effort**: 8 hours | **Category**: Components

Expand UI primitive library.

**Acceptance Criteria**:
- [ ] Extract `Tooltip` primitive
- [ ] Extract `ProgressBar` primitive (from CacheProgressBar)
- [ ] Extract `Slider` primitive (from SpeedSlider)
- [ ] Extract `Dropdown`/`Select` primitive (from VoiceSelector)
- [ ] All primitives use design tokens
- [ ] Storybook stories for each

**Larger Effort**: Yes (8 hours)

---

### P2-3: Command Palette Implementation

**Priority**: P2 | **Effort**: 20 hours | **Category**: UX

Add `Ctrl+K` command palette for power users.

**Acceptance Criteria**:
- [ ] Trigger with `Ctrl+K` / `Cmd+K`
- [ ] Fuzzy search across commands
- [ ] Recent files section
- [ ] Commands show keyboard shortcuts
- [ ] Navigate with arrow keys, select with Enter
- [ ] Escape closes palette
- [ ] Extensible command registry

**Larger Redesign**: Yes (20 hours)

---

### P2-4: Sidebar Redesign

**Priority**: P2 | **Effort**: 24 hours | **Category**: Layout

Implement proper collapsible, resizable sidebar.

**Acceptance Criteria**:
- [ ] Left sidebar with tabs: Library, TOC, Thumbnails
- [ ] Right panel: Highlights, Notes
- [ ] Collapse to icons (48px) or hide completely
- [ ] Drag to resize
- [ ] Persist state across sessions
- [ ] Keyboard shortcuts to toggle
- [ ] Responsive behavior at breakpoints

**Larger Redesign**: Yes (24 hours)

---

### P2-5: Add Storybook

**Priority**: P2 | **Effort**: 8 hours | **Category**: DX

Set up Storybook for UI component documentation.

**Acceptance Criteria**:
- [ ] Install and configure Storybook
- [ ] Stories for all primitives: Button, IconButton, Panel, Toast, EmptyState, ListRow
- [ ] Stories for Dialog, Tooltip, ProgressBar (when created)
- [ ] Document props with controls
- [ ] Visual regression testing setup

---

### P2-6: Panel/View Keyboard Shortcuts

**Priority**: P2 | **Effort**: 4 hours | **Category**: UX

Add keyboard shortcuts for panel toggles.

**Acceptance Criteria**:
- [ ] `F4` / `Cmd+Shift+S`: Toggle sidebar
- [ ] `Ctrl+Shift+H` / `Cmd+Shift+H`: Toggle highlights panel
- [ ] `Ctrl+G` / `Cmd+G`: Go to page dialog
- [ ] `Ctrl+2` / `Cmd+2`: Fit width
- [ ] Update keyboard shortcuts documentation

---

### P2-7: Consolidate Rect Type Definitions

**Priority**: P2 | **Effort**: 2 hours | **Category**: DX

Unify `Rect` type defined in multiple places.

**Acceptance Criteria**:
- [ ] Single `Rect` type in `src/domain/` or `src/types/`
- [ ] All usages import from single source
- [ ] Remove duplicate definitions
- [ ] Update imports across codebase

**Quick Win**: Yes (2 hours)

---

## Summary by Effort

### Quick Wins (1-3 hours each)

| Task | Hours | Category |
|------|-------|----------|
| P0-1: Design token migration | 2-4 | Foundation |
| P0-3: Focus visible styles | 2 | Accessibility |
| P0-4: ARIA live region | 2 | Accessibility |
| P0-5: Fix LSP/ESLint errors | 3 | Accessibility |
| P1-5: Toast feedback | 3 | UX |
| P2-7: Consolidate Rect types | 2 | DX |

### Medium Refactors (4-8 hours each)

| Task | Hours | Category |
|------|-------|----------|
| P0-2: FileDialogAdapter | 4 | Architecture |
| P1-1: Roving tabindex | 6 | Accessibility |
| P1-2: Focus trap | 4 | Accessibility |
| P1-3: Dialog primitive | 6 | Components |
| P1-4: Keyboard shortcuts | 8 | UX |
| P1-6: Empty states | 4 | UX |
| P1-7: Loading skeletons | 4 | UX |
| P2-2: Additional primitives | 8 | Components |
| P2-5: Storybook | 8 | DX |
| P2-6: Panel shortcuts | 4 | UX |

### Larger Redesigns (16+ hours each)

| Task | Hours | Category |
|------|-------|----------|
| P2-1: Refactor PdfViewer.tsx | 16 | Architecture |
| P2-3: Command palette | 20 | UX |
| P2-4: Sidebar redesign | 24 | Layout |

---

## Recommended Implementation Order

### Sprint 1: Foundation & Accessibility (P0)
1. P0-5: Fix LSP/ESLint accessibility errors (3h)
2. P0-1: Complete design token migration (4h)
3. P0-3: Implement focus visible styles (2h)
4. P0-4: Add ARIA live region (2h)
5. P0-2: Create FileDialogAdapter (4h)

**Total**: ~15 hours | **Checkpoint**: `pnpm verify` passes

### Sprint 2: Core Accessibility (P1 Accessibility)
1. P1-2: Add focus trap to modals (4h)
2. P1-1: Implement roving tabindex in toolbar (6h)
3. P1-3: Extract Dialog primitive (6h)

**Total**: ~16 hours | **Checkpoint**: Keyboard navigation complete

### Sprint 3: User Feedback (P1 UX)
1. P1-5: Add toast feedback (3h)
2. P1-6: Implement empty states (4h)
3. P1-7: Add loading skeletons (4h)
4. P1-4: Implement keyboard shortcuts (8h)

**Total**: ~19 hours | **Checkpoint**: Core UX polish complete

### Sprint 4+: Power User Features (P2)
- P2-2: Additional primitives (8h)
- P2-5: Storybook (8h)
- P2-1: Refactor PdfViewer.tsx (16h)
- P2-3: Command palette (20h)
- P2-4: Sidebar redesign (24h)

**Total**: ~76 hours | **Scope**: As time permits

---

## Dependencies

```
P0-1 (tokens) → P0-3 (focus styles)
P0-2 (adapter) ← no dependencies
P1-2 (focus trap) → P1-3 (Dialog primitive)
P1-3 (Dialog) → P2-3 (Command palette)
P1-4 (shortcuts) → P2-6 (panel shortcuts)
P1-6 (empty states) ← uses EmptyState primitive (exists)
P2-5 (Storybook) → documents all primitives
```

---

## Verification Commands

```bash
# Check for hardcoded values
grep -r "z-index:" --include="*.css" src/ | grep -v "var(--z-"
grep -r "#[0-9a-fA-F]\{3,6\}" --include="*.css" src/ | grep -v "/* " | head -20

# Run full verification
pnpm verify

# Run accessibility audit (if added)
pnpm a11y:audit

# Check architecture boundaries
pnpm lint
```
