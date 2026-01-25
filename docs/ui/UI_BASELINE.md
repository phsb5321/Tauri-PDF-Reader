# UI Baseline Documentation

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete

---

## Overview

This document captures the current state of all UI screens in the Tauri PDF Reader application. It serves as a reference point for the UX audit and design system implementation.

---

## Screen Inventory

| Screen | Component | Purpose | Primary Actions | Screenshot |
|--------|-----------|---------|-----------------|------------|
| Reader | `ReaderView.tsx` | Main document viewing area | View PDF, scroll pages | [reader.png](./screenshots/reader.png) |
| Toolbar | `Toolbar.tsx` | Top navigation bar | Open file, navigate pages, zoom | [toolbar.png](./screenshots/reader.png) |
| Playback Bar | `AiPlaybackBar.tsx` | TTS audio controls | Play/pause, adjust speed, select voice | [playback-bar.png](./screenshots/playback-bar.png) |
| Highlights Panel | `HighlightsPanel.tsx` | Annotation management | View, edit, delete highlights | [highlights-panel.png](./screenshots/highlights-panel.png) |
| Settings Panel | `SettingsPanel.tsx` | Application configuration | Theme, TTS settings, shortcuts | [settings.png](./screenshots/settings.png) |
| Table of Contents | `TableOfContents.tsx` | Document navigation | Jump to chapters/sections | [toc.png](./screenshots/toc.png) |
| Library View | `LibraryView.tsx` | Document management | Browse, search, open documents | [library.png](./screenshots/library.png) |

---

## Screen Details

### 1. Reader View (Main Screen)

**Component**: `src/components/reader/ReaderView.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    PDF Viewer                               │
│                    (PdfViewer.tsx)                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Playback Bar (when document is open)                        │
└─────────────────────────────────────────────────────────────┘
```

**Primary Actions**:
1. View PDF document pages
2. Scroll through document
3. Select text for highlighting
4. Control TTS playback

**Confusion Points**:
- No visible indicator of current position in document (beyond page number)
- Text selection highlighting flow may be unclear for new users
- Playback bar only appears when document is open (may be unexpected)

---

### 2. Toolbar

**Component**: `src/components/Toolbar.tsx`

**Layout Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ [Open] Document Title    [◄] Page [X/Y] [►]    [−] [100%] [+] │
│  Left                      Center                    Right   │
└──────────────────────────────────────────────────────────────┘
```

**Elements**:
- **Left Section**: Open button, document title (truncated)
- **Center Section**: Page navigation (prev, current/total, next)
- **Right Section**: Zoom controls (zoom out, level, zoom in)

**Primary Actions**:
1. Open PDF file via file dialog
2. Navigate between pages
3. Adjust zoom level

**Confusion Points**:
- Limited access to settings (no visible settings button)
- No sidebar toggles visible in toolbar
- Document title may be heavily truncated

---

### 3. Playback Bar (AI TTS)

**Component**: `src/components/playback-bar/AiPlaybackBar.tsx`

**Layout Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ [Voice ▼]  [<<] [Play/Pause] [>>]  [Speed ▼]  Progress Bar   │
└──────────────────────────────────────────────────────────────┘
```

**Sub-components**:
- `AiVoiceSelector.tsx` - Voice selection dropdown
- `AiSpeedSlider.tsx` - Playback speed control
- `AiTtsSettings.tsx` - Additional TTS settings
- `ChunkNavigation.tsx` - Skip forward/backward

**Primary Actions**:
1. Start/stop TTS playback
2. Select voice
3. Adjust playback speed
4. Navigate through audio chunks

**Confusion Points**:
- "AI TTS" may not be immediately understood by all users
- Relationship between text on screen and audio position unclear
- Multiple voice/speed controls could be confusing

---

### 4. Highlights Panel

**Component**: `src/components/highlights/HighlightsPanel.tsx`

**Purpose**: Display and manage text highlights/annotations

**Elements**:
- List of highlights for current document
- Highlight color indicators
- Note editor (`NoteEditor.tsx`)
- Export functionality (`ExportDialog.tsx`)

**Primary Actions**:
1. View all highlights
2. Navigate to highlighted text
3. Edit highlight notes
4. Delete highlights
5. Export highlights

**Confusion Points**:
- Panel visibility toggle may not be discoverable
- Relationship between panel items and document location unclear
- Export options may be hidden

---

### 5. Settings Panel

**Component**: `src/components/settings/SettingsPanel.tsx`

**Sub-panels**:
- `ThemeToggle.tsx` - Light/dark/system theme
- `HighlightSettings.tsx` - Highlight color defaults
- `TtsSettings.tsx` - Native TTS configuration
- `KeyboardShortcuts.tsx` - Shortcut reference
- `TelemetrySettings.tsx` - Analytics preferences
- `DebugLogs.tsx` - Developer logging

**Primary Actions**:
1. Change theme
2. Configure TTS voices
3. View keyboard shortcuts
4. Access debug information

**Confusion Points**:
- How to access settings panel initially
- Many nested options could overwhelm
- TTS settings vs AI TTS settings distinction unclear

---

### 6. Table of Contents

**Component**: `src/components/sidebar/TableOfContents.tsx`

**Purpose**: Navigate document structure via outline/bookmarks

**Primary Actions**:
1. View document structure
2. Jump to specific sections

**Confusion Points**:
- Only available for PDFs with embedded TOC
- No fallback for documents without outline
- Panel toggle discoverability

---

### 7. Library View

**Component**: `src/components/library/LibraryView.tsx`

**Sub-components**:
- `SearchBar.tsx` - Filter documents
- `DocumentCard.tsx` - Individual document entry

**Purpose**: Browse and manage document collection

**Primary Actions**:
1. View all documents
2. Search by title
3. Open documents
4. View reading progress

**Confusion Points**:
- How to access library from reader view
- Document organization/sorting options
- Progress visualization clarity

---

## Component Hierarchy

```
App
└── ReaderView
    └── AppLayout
        ├── Toolbar (header)
        │   ├── Open Button
        │   ├── Document Title
        │   ├── PageNavigation
        │   └── ZoomControls
        │
        ├── PdfViewer (main)
        │   ├── PdfPage
        │   ├── TextLayer
        │   ├── HighlightOverlay
        │   ├── HighlightToolbar
        │   ├── HighlightContextMenu
        │   └── TtsHighlight
        │
        ├── Sidebar (optional)
        │   ├── TableOfContents
        │   ├── HighlightsPanel
        │   └── SettingsPanel
        │
        └── AiPlaybackBar (footer)
            ├── AiVoiceSelector
            ├── ChunkNavigation
            ├── AiSpeedSlider
            └── AiTtsSettings
```

---

## Current State Assessment

### Strengths
1. Clear separation of concerns in component structure
2. Logical layout with header/main/footer
3. Support for dark mode via system preference
4. TTS functionality well-integrated

### Areas for Improvement
1. **Discoverability**: Settings, panels, and features lack visible entry points
2. **Navigation**: No clear way to switch between reader and library
3. **Visual Hierarchy**: Toolbar sections could have clearer delineation
4. **Feedback**: Limited loading/progress indicators
5. **Keyboard**: No visible keyboard shortcut hints

---

## Screenshots

> **Note**: Screenshots require running the application with `pnpm tauri dev`.
> Capture each screen and save to `docs/ui/screenshots/` directory.

### Capture Checklist

- [ ] `reader.png` - Full reader view with document open
- [ ] `library.png` - Library view with document list
- [ ] `settings.png` - Settings panel expanded
- [ ] `highlights-panel.png` - Highlights panel with entries
- [ ] `playback-bar.png` - Playback bar during TTS
- [ ] `toc.png` - Table of contents panel

### Capture Instructions

1. Start the application: `pnpm tauri dev`
2. Open a sample PDF document
3. For each screen:
   - Navigate to the screen/panel
   - Use system screenshot tool (or browser dev tools)
   - Crop to relevant area
   - Save as PNG at 2x resolution if possible
4. Name files according to the checklist above

---

## Next Steps

1. Complete screenshot capture when application is running
2. Use this baseline for UX audit (Phase 5)
3. Reference component locations when implementing design system (Phase 7)
4. Update this document if significant UI changes are made
