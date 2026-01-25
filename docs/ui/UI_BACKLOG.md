# UI Polish Backlog

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete
**Source**: `docs/ui/UX_AUDIT.md`

---

## Overview

This backlog contains prioritized UI improvements derived from the UX audit. Each item includes acceptance criteria, keyboard behavior requirements, and empty/error state handling.

---

## Priority Levels

| Level | Criteria | Target |
|-------|----------|--------|
| **P0** | Blocks core functionality, critical UX issues | Sprint 1 |
| **P1** | Major usability issues, common user complaints | Sprint 2-3 |
| **P2** | Minor improvements, nice-to-have features | Backlog |

---

## P0 - Critical (Sprint 1)

### B001: Implement Keyboard Shortcuts

**Source**: UX_AUDIT R01
**Status**: In Progress

**Description**: Users cannot perform common actions via keyboard, blocking power users and accessibility.

**Acceptance Criteria**:
- [ ] Ctrl+O opens file dialog
- [ ] Ctrl+, opens settings
- [ ] Ctrl+H toggles highlights panel
- [ ] Ctrl+B toggles library sidebar
- [ ] Escape closes modals and panels
- [ ] Space toggles TTS play/pause (when not in input)
- [ ] Arrow keys navigate pages

**Keyboard Behavior**:
- Shortcuts work regardless of focus location (except when in text input)
- Focus should not be trapped after shortcut execution
- Shortcuts should have visible hints in UI (tooltips)

**Empty/Error States**: N/A

---

### B002: Add Help/Onboarding System

**Source**: UX_AUDIT R02
**Status**: Pending

**Description**: New users have no guidance on how to use the application.

**Acceptance Criteria**:
- [ ] First-time users see a welcome overlay
- [ ] Overlay highlights key features (open file, highlight, TTS)
- [ ] User can dismiss and "don't show again"
- [ ] Help can be re-accessed from settings

**Keyboard Behavior**:
- Tab navigates between help items
- Enter/Space activates "Next" or "Dismiss"
- Escape closes help overlay

**Empty/Error States**:
- If help content fails to load, show simple text fallback

---

## P1 - Major (Sprint 2-3)

### B003: Add Loading Indicators

**Source**: UX_AUDIT R03, P01
**Status**: Pending

**Description**: Users have no feedback when operations are in progress.

**Acceptance Criteria**:
- [ ] PDF loading shows progress bar with percentage
- [ ] TTS initialization shows spinner on play button
- [ ] Long operations show skeleton or loading state

**Keyboard Behavior**:
- Focus remains on trigger element during loading
- Loading state announced to screen readers

**Empty/Error States**:
- If loading fails, show error message with retry option

---

### B004: Improve Error Messages

**Source**: UX_AUDIT R05, P03
**Status**: Pending

**Description**: Error messages are generic and don't help users recover.

**Acceptance Criteria**:
- [ ] Error messages include specific cause
- [ ] Error messages include suggested action
- [ ] Error toast includes retry button where applicable
- [ ] Network errors distinguished from file errors

**Keyboard Behavior**:
- Error toast is announced to screen readers
- Retry button is focusable
- Escape dismisses error toast

**Empty/Error States**:
- Error toast shows contextual icon (error variant)
- Retry action attempts same operation

---

### B005: Add Toolbar Panel Toggles

**Source**: UX_AUDIT T01, T02, T03
**Status**: Pending

**Description**: Settings, sidebar, and library are not accessible from toolbar.

**Acceptance Criteria**:
- [ ] Toolbar includes settings icon button
- [ ] Toolbar includes sidebar toggle (left panel)
- [ ] Toolbar includes highlights toggle (right panel)
- [ ] Active state shown when panel is open
- [ ] Tooltips show keyboard shortcuts

**Keyboard Behavior**:
- All toggle buttons focusable via Tab
- Enter/Space activates toggle
- Ctrl+B, Ctrl+H work as shortcuts

**Empty/Error States**: N/A

---

### B006: Handle Scanned PDFs

**Source**: UX_AUDIT R04
**Status**: Pending

**Description**: Users can select text on scanned pages with no readable content.

**Acceptance Criteria**:
- [ ] Detect pages with no extractable text
- [ ] Show warning banner on scanned pages
- [ ] Disable TTS play for scanned pages
- [ ] Suggest OCR solution in warning

**Keyboard Behavior**:
- Warning banner is announced to screen readers
- Warning can be dismissed with Escape

**Empty/Error States**:
- Warning: "This page appears to be scanned. Text selection and TTS may not work."

---

### B007: Add Delete Confirmation

**Source**: UX_AUDIT H01
**Status**: Pending

**Description**: Highlights can be deleted accidentally without confirmation.

**Acceptance Criteria**:
- [ ] Delete action shows confirmation dialog
- [ ] Dialog includes highlight text preview
- [ ] Confirm button is destructive styled
- [ ] Cancel is default/focused

**Keyboard Behavior**:
- Dialog traps focus
- Tab cycles through dialog buttons
- Escape cancels and closes dialog
- Enter activates focused button

**Empty/Error States**:
- If deletion fails, show error toast with retry

---

### B008: Add Undo for Deletions

**Source**: UX_AUDIT H02
**Status**: Pending

**Description**: Deleted highlights cannot be recovered.

**Acceptance Criteria**:
- [ ] Deletion shows undo toast for 5 seconds
- [ ] Undo restores highlight completely
- [ ] Toast auto-dismisses after timeout
- [ ] Only most recent deletion is undoable

**Keyboard Behavior**:
- Undo button in toast is focusable
- Ctrl+Z triggers undo (within 5 seconds)

**Empty/Error States**:
- If undo fails, show error message

---

### B009: Explain Voice Settings

**Source**: UX_AUDIT P04
**Status**: Pending

**Description**: TTS voice options are not explained to users.

**Acceptance Criteria**:
- [ ] Voice dropdown shows voice preview/description
- [ ] Speed control shows current speed value
- [ ] Settings include help text for each option

**Keyboard Behavior**:
- Arrow keys navigate voice options
- Enter selects voice
- Tab moves to next control

**Empty/Error States**:
- If no voices available, show "No voices installed" message

---

### B010: Improve TTS Feedback

**Source**: UX_AUDIT P02
**Status**: Pending

**Description**: Users don't know when page has no readable text for TTS.

**Acceptance Criteria**:
- [ ] Check for text before starting playback
- [ ] Show message if page has no text
- [ ] Disable play button for empty pages
- [ ] Show text preview in playback bar

**Keyboard Behavior**:
- Message toast is announced to screen readers

**Empty/Error States**:
- Empty: "No readable text on this page"
- Error: "TTS failed to initialize. Check voice settings."

---

## P2 - Minor (Backlog)

### B011: Add Undo/Redo System

**Source**: UX_AUDIT R06
**Status**: Backlog

**Description**: Users cannot undo accidental actions beyond highlights.

**Acceptance Criteria**:
- [ ] Ctrl+Z undoes last action
- [ ] Ctrl+Shift+Z redoes last undone action
- [ ] Undo/redo history (limited to last 10 actions)

**Keyboard Behavior**:
- Standard shortcuts (Ctrl+Z, Ctrl+Shift+Z)

---

### B012: Add Highlight Search/Filter

**Source**: UX_AUDIT H04
**Status**: Backlog

**Description**: Users cannot search or filter highlights.

**Acceptance Criteria**:
- [ ] Search box in highlights panel
- [ ] Filter by highlight color
- [ ] Show result count

**Keyboard Behavior**:
- Ctrl+F in panel focuses search box
- Arrow keys navigate results

**Empty/Error States**:
- No matches: "No highlights match your search"

---

### B013: Improve Zoom Display

**Source**: UX_AUDIT T04
**Status**: Backlog

**Description**: Current zoom level is hard to read in toolbar.

**Acceptance Criteria**:
- [ ] Larger zoom percentage display
- [ ] Dropdown with preset zoom levels
- [ ] Visual indicator of fit mode

---

### B014: Add Tooltip Shortcuts

**Source**: UX_AUDIT T05
**Status**: Backlog

**Description**: Toolbar buttons don't show keyboard shortcuts in tooltips.

**Acceptance Criteria**:
- [ ] All toolbar buttons have tooltips
- [ ] Tooltips include keyboard shortcut
- [ ] Format: "Open (Ctrl+O)"

---

### B015: Organize Settings Sections

**Source**: UX_AUDIT S01, S02
**Status**: Backlog

**Description**: Settings are not well organized.

**Acceptance Criteria**:
- [ ] Group TTS settings in one section
- [ ] Add section headings
- [ ] Add collapsible sections

---

### B016: Add TOC Empty State

**Source**: UX_AUDIT C01
**Status**: Backlog

**Description**: No feedback when PDF has no table of contents.

**Acceptance Criteria**:
- [ ] Show "No table of contents" message
- [ ] Suggest alternative navigation methods

**Empty/Error States**:
- "This document doesn't have a table of contents. Use page navigation or search."

---

### B017: Add TOC Collapse/Expand

**Source**: UX_AUDIT C02
**Status**: Backlog

**Description**: Nested TOC items cannot be collapsed.

**Acceptance Criteria**:
- [ ] Expandable/collapsible TOC sections
- [ ] Expand all / Collapse all options
- [ ] Remember expand state

**Keyboard Behavior**:
- Arrow keys expand/collapse sections
- Enter navigates to selected item

---

### B018: Improve TTS Stop Behavior

**Source**: UX_AUDIT P05
**Status**: Backlog

**Description**: Stopping TTS mid-sentence is abrupt.

**Acceptance Criteria**:
- [ ] Stop button fades audio out
- [ ] Escape immediately stops
- [ ] Position preserved for resume

---

### B019: Rename AI TTS Label

**Source**: UX_AUDIT P06
**Status**: Backlog

**Description**: "AI TTS" terminology may confuse users.

**Acceptance Criteria**:
- [ ] Rename to "Text-to-Speech"
- [ ] Add explanatory subtitle

---

### B020: Add More Speed Options

**Source**: UX_AUDIT P07
**Status**: Backlog

**Description**: TTS speed options are limited.

**Acceptance Criteria**:
- [ ] Add 0.5x, 0.75x options
- [ ] Add 2.5x, 3x options
- [ ] Show current speed prominently

---

### B021: Add Bulk Highlight Actions

**Source**: UX_AUDIT H03
**Status**: Backlog

**Description**: Users cannot perform bulk actions on highlights.

**Acceptance Criteria**:
- [ ] Multi-select mode in highlights panel
- [ ] Bulk delete selected
- [ ] Bulk export selected
- [ ] Select all / Deselect all

**Keyboard Behavior**:
- Shift+Click for range select
- Ctrl+Click for individual select
- Ctrl+A selects all

---

### B022: Improve Export UX

**Source**: UX_AUDIT H05
**Status**: Backlog

**Description**: Export options are not clearly visible.

**Acceptance Criteria**:
- [ ] Export button in panel header
- [ ] Format options in dropdown
- [ ] Preview before export

---

### B023: Add Settings Descriptions

**Source**: UX_AUDIT S03
**Status**: Backlog

**Description**: Settings options lack explanations.

**Acceptance Criteria**:
- [ ] Each setting has description text
- [ ] Help icons with tooltip details

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 | 2 | Sprint 1 |
| P1 | 8 | Sprint 2-3 |
| P2 | 13 | Backlog |
| **Total** | **23** | |

---

## Next Steps

1. Complete P0 items in Sprint 1
2. Plan P1 items for subsequent sprints
3. Review P2 items quarterly for promotion
4. Add new items as discovered
