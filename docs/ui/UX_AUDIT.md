# UX Audit: Heuristic Evaluation

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete
**Method**: Nielsen's 10 Usability Heuristics

---

## Overview

This document provides a structured heuristic evaluation of the Tauri PDF Reader application. Each screen is evaluated against Nielsen's 10 usability heuristics, with issues categorized by severity.

### Severity Scale

| Level | Description | Impact |
|-------|-------------|--------|
| **P0** | Critical | Prevents task completion, must fix immediately |
| **P1** | Major | Significantly impairs usability, fix soon |
| **P2** | Minor | Annoyance or inefficiency, fix when possible |

---

## Nielsen's 10 Heuristics Reference

1. **Visibility of System Status**
2. **Match Between System and Real World**
3. **User Control and Freedom**
4. **Consistency and Standards**
5. **Error Prevention**
6. **Recognition Rather Than Recall**
7. **Flexibility and Efficiency of Use**
8. **Aesthetic and Minimalist Design**
9. **Help Users Recognize, Diagnose, and Recover from Errors**
10. **Help and Documentation**

---

## Screen Evaluations

### Reader Screen (`ReaderView.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | P1 | No loading indicator for large PDFs |
| 2. Real World Match | Pass | Familiar document layout |
| 3. User Control | P2 | No undo for accidental actions |
| 4. Consistency | Pass | Standard viewer conventions |
| 5. Error Prevention | P1 | Can select unreadable text (scanned PDFs) |
| 6. Recognition | P2 | Highlight colors not visible until selected |
| 7. Flexibility | P0 | No keyboard shortcuts for common actions |
| 8. Minimalist | Pass | Clean interface |
| 9. Error Recovery | P1 | Generic error messages |
| 10. Documentation | P0 | No help or onboarding |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| R01 | P0 | 7 | No keyboard shortcuts | Try Ctrl+O to open file | Implement standard shortcuts |
| R02 | P0 | 10 | No help/onboarding | Open app first time | Add help overlay or tooltip tour |
| R03 | P1 | 1 | No loading indicator | Open large PDF (50+ MB) | Add progress spinner with percentage |
| R04 | P1 | 5 | Scanned PDF text selection | Select text on scanned page | Detect scanned pages, show warning |
| R05 | P1 | 9 | Generic errors | Trigger any error | Show specific error messages with actions |
| R06 | P2 | 3 | No undo | Create accidental highlight | Add Ctrl+Z undo for highlights |
| R07 | P2 | 6 | Hidden highlight options | Look for highlight colors | Show color picker on selection |

---

### Toolbar (`Toolbar.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | P2 | Current zoom level could be clearer |
| 2. Real World Match | Pass | Standard toolbar icons |
| 3. User Control | Pass | Clear open/zoom controls |
| 4. Consistency | P1 | Missing settings/sidebar toggles |
| 5. Error Prevention | Pass | Buttons have clear functions |
| 6. Recognition | Pass | Icons with labels |
| 7. Flexibility | P1 | No quick access to frequently used features |
| 8. Minimalist | Pass | Appropriate information density |
| 9. Error Recovery | Pass | N/A |
| 10. Documentation | P2 | No tooltips with shortcuts |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| T01 | P1 | 4 | Missing settings toggle | Look for settings button | Add settings icon to toolbar |
| T02 | P1 | 4 | Missing sidebar toggles | Try to open TOC | Add left/right panel toggles |
| T03 | P1 | 7 | No library access | Try to browse documents | Add library/home button |
| T04 | P2 | 1 | Zoom level hard to read | Check current zoom | Use larger zoom percentage display |
| T05 | P2 | 10 | No shortcut hints | Hover over buttons | Add tooltip with keyboard shortcut |

---

### Playback Bar (`AiPlaybackBar.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | P1 | No visual feedback for TTS loading |
| 2. Real World Match | Pass | Standard audio player layout |
| 3. User Control | P2 | Can't easily stop TTS mid-sentence |
| 4. Consistency | P2 | "AI TTS" terminology unclear |
| 5. Error Prevention | P1 | No warning before playing on silent text |
| 6. Recognition | Pass | Standard playback icons |
| 7. Flexibility | P2 | Limited speed options |
| 8. Minimalist | Pass | Appropriate controls |
| 9. Error Recovery | P1 | TTS errors not clearly communicated |
| 10. Documentation | P1 | Voice settings not explained |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| P01 | P1 | 1 | No TTS loading feedback | Click play, wait for voice | Show loading spinner on play button |
| P02 | P1 | 5 | No empty text warning | Play on page with no text | Show message "No readable text on page" |
| P03 | P1 | 9 | Unclear TTS errors | Trigger TTS failure | Show specific error with retry option |
| P04 | P1 | 10 | Voice settings unexplained | Open voice dropdown | Add tooltip explaining voice options |
| P05 | P2 | 3 | Hard to stop mid-sentence | Press stop during TTS | Add immediate stop with fade |
| P06 | P2 | 4 | "AI TTS" unclear | Read label | Rename to "Text-to-Speech" |
| P07 | P2 | 7 | Limited speeds | Look for 1.75x speed | Add more speed options (0.5 to 3x) |

---

### Highlights Panel (`HighlightsPanel.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | Pass | Highlights load immediately |
| 2. Real World Match | Pass | List format familiar |
| 3. User Control | P2 | No bulk actions |
| 4. Consistency | Pass | Standard list patterns |
| 5. Error Prevention | P1 | No confirmation for delete |
| 6. Recognition | Pass | Highlight colors visible |
| 7. Flexibility | P2 | No search/filter |
| 8. Minimalist | Pass | Clean layout |
| 9. Error Recovery | P1 | Deleted highlights can't be recovered |
| 10. Documentation | P2 | Export options not explained |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| H01 | P1 | 5 | No delete confirmation | Delete a highlight | Add confirmation dialog |
| H02 | P1 | 9 | No undo delete | Delete highlight, try to undo | Add undo toast for 5 seconds |
| H03 | P2 | 3 | No bulk actions | Try to delete multiple | Add multi-select mode |
| H04 | P2 | 7 | No search/filter | Look for search box | Add filter by color, search by text |
| H05 | P2 | 10 | Export unclear | Find export button | Add export icon with tooltip |

---

### Settings Panel (`SettingsPanel.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | Pass | Settings apply immediately |
| 2. Real World Match | Pass | Standard settings format |
| 3. User Control | Pass | Changes reversible |
| 4. Consistency | P2 | TTS settings split across locations |
| 5. Error Prevention | Pass | Valid options only |
| 6. Recognition | Pass | Clear labels |
| 7. Flexibility | Pass | Appropriate options |
| 8. Minimalist | P2 | Some options could be grouped better |
| 9. Error Recovery | Pass | Can restore defaults |
| 10. Documentation | P2 | Options not fully explained |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| S01 | P2 | 4 | TTS settings scattered | Find all TTS options | Group TTS settings in one section |
| S02 | P2 | 8 | Poor section grouping | Scan all settings | Reorganize into logical groups |
| S03 | P2 | 10 | Options unexplained | Hover over option | Add descriptions for each setting |

---

### Table of Contents (`TableOfContents.tsx`)

| Heuristic | Rating | Finding |
|-----------|--------|---------|
| 1. System Status | Pass | Loading state clear |
| 2. Real World Match | Pass | Book TOC metaphor |
| 3. User Control | Pass | Click to navigate |
| 4. Consistency | Pass | Standard outline format |
| 5. Error Prevention | P2 | No feedback for PDFs without TOC |
| 6. Recognition | Pass | Indent shows hierarchy |
| 7. Flexibility | P2 | No collapse/expand for nested items |
| 8. Minimalist | Pass | Clean list |
| 9. Error Recovery | Pass | N/A |
| 10. Documentation | Pass | Self-explanatory |

**Issues Summary**:

| ID | Severity | Heuristic | Issue | Repro Steps | Proposed Fix |
|----|----------|-----------|-------|-------------|--------------|
| C01 | P2 | 5 | No TOC fallback | Open PDF without outline | Show "No table of contents available" |
| C02 | P2 | 7 | No collapse/expand | View nested TOC | Add expand/collapse for sections |

---

## Critical Reading Loop Analysis

**User Task**: Open document → Create highlight → Activate TTS

### Current Flow

```
1. Open app (0 clicks)
2. Click "Open" button (1 click)
3. Navigate file dialog (varies, ~3-5 clicks)
4. Select text with mouse (1 action)
5. Choose highlight color (1 click - context menu)
6. Click play on TTS bar (1 click)

Total: 7-9 clicks/actions
```

### Timing Analysis

| Step | Current | Target | Gap |
|------|---------|--------|-----|
| App load | ~2s | <1s | Optimize startup |
| Open file dialog | ~1s | ~1s | OK |
| PDF render (10pg) | ~1s | <500ms | Optimize rendering |
| PDF render (100pg) | ~3s | <1s | Lazy loading needed |
| Text selection | Instant | Instant | OK |
| Highlight creation | ~200ms | <100ms | Minor optimization |
| TTS initialization | ~500ms | <200ms | Preload TTS engine |

### Improvement Opportunities

1. **Add keyboard shortcuts** (P0): Open with Ctrl+O, play with Space
2. **Quick highlight** (P1): Single click after selection
3. **TTS preload** (P1): Initialize TTS engine on app start
4. **Recent documents** (P2): Skip file dialog for recent files

---

## Issue Summary by Severity

### P0 - Critical (2 issues)

| ID | Screen | Issue | Impact |
|----|--------|-------|--------|
| R01 | Reader | No keyboard shortcuts | Power users blocked |
| R02 | Reader | No help/onboarding | New users confused |

### P1 - Major (12 issues)

| ID | Screen | Issue |
|----|--------|-------|
| R03 | Reader | No loading indicator |
| R04 | Reader | Scanned PDF handling |
| R05 | Reader | Generic errors |
| T01 | Toolbar | Missing settings toggle |
| T02 | Toolbar | Missing sidebar toggles |
| T03 | Toolbar | No library access |
| P01 | Playback | No TTS loading feedback |
| P02 | Playback | No empty text warning |
| P03 | Playback | Unclear TTS errors |
| P04 | Playback | Voice settings unexplained |
| H01 | Highlights | No delete confirmation |
| H02 | Highlights | No undo delete |

### P2 - Minor (13 issues)

| ID | Screen | Issue |
|----|--------|-------|
| R06 | Reader | No undo |
| R07 | Reader | Hidden highlight options |
| T04 | Toolbar | Zoom hard to read |
| T05 | Toolbar | No shortcut hints |
| P05 | Playback | Hard to stop mid-sentence |
| P06 | Playback | "AI TTS" unclear |
| P07 | Playback | Limited speeds |
| H03 | Highlights | No bulk actions |
| H04 | Highlights | No search/filter |
| H05 | Highlights | Export unclear |
| S01 | Settings | TTS settings scattered |
| S02 | Settings | Poor section grouping |
| S03 | Settings | Options unexplained |
| C01 | TOC | No TOC fallback |
| C02 | TOC | No collapse/expand |

---

## Recommendations

### Immediate Actions (P0)

1. **Implement keyboard shortcuts** - Use standard document reader shortcuts
2. **Add help system** - Onboarding overlay for first-time users

### Short-term (P1)

1. Add loading indicators throughout app
2. Improve error messages with specific guidance
3. Add toolbar toggles for settings, sidebar, library
4. Add confirmation dialogs for destructive actions
5. Improve TTS feedback and error handling

### Medium-term (P2)

1. Add undo/redo system
2. Enhance highlight workflow
3. Improve settings organization
4. Add tooltips with keyboard shortcuts
5. Add search/filter to highlights panel

---

## Next Steps

1. Create backlog items from these issues (Phase 8)
2. Prioritize P0 fixes for immediate implementation
3. Group P1 issues into sprint-sized work items
4. Track P2 issues for future improvement cycles
