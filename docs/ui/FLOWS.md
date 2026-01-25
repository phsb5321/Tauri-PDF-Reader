# Information Architecture: User Flows

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete

---

## Overview

This document defines the primary user jobs, navigation model, and user flows for the Tauri PDF Reader. It serves as the foundation for UI organization and feature prioritization.

---

## Primary User Jobs

The application supports six primary user jobs that define how users interact with the system.

| # | Job | Frequency | Priority | Primary Screen |
|---|-----|-----------|----------|----------------|
| 1 | Find/Open Document | High | P0 | Reader/Library |
| 2 | Read Comfortably | Very High | P0 | Reader |
| 3 | Create Highlight | Medium | P1 | Reader |
| 4 | Navigate Highlights | Medium | P1 | Highlights Panel |
| 5 | Use TTS Playback | Medium | P1 | Reader + Playback Bar |
| 6 | Manage Library | Low | P2 | Library View |

---

## User Flow Diagrams

### 1. Find and Open Document

```mermaid
flowchart TD
    Start([Start]) --> A{Has recent docs?}
    A -->|Yes| B[Show recent documents]
    A -->|No| C[Show empty state]

    B --> D{User action}
    C --> D

    D -->|Click recent| E[Load document]
    D -->|Click Open| F[Open file dialog]
    D -->|Drag & drop| G[Receive dropped file]
    D -->|Keyboard Ctrl+O| F

    F --> H{File selected?}
    H -->|Yes| I[Validate PDF]
    H -->|No| Start

    G --> I

    I --> J{Valid PDF?}
    J -->|Yes| K[Add to library]
    J -->|No| L[Show error]

    K --> E
    L --> Start

    E --> M[Render first page]
    M --> N{Has saved position?}
    N -->|Yes| O[Restore position]
    N -->|No| P[Start at page 1]

    O --> End([Document Open])
    P --> End

    style Start fill:#e8f5e9
    style End fill:#e3f2fd
    style L fill:#ffebee
```

**Key Decisions**:
- Recent documents shown prominently
- Multiple entry points (button, keyboard, drag/drop)
- Position restoration for returning users
- Clear error states

---

### 2. Read Comfortably

```mermaid
flowchart TD
    Start([Document Open]) --> A[View page content]

    A --> B{User needs}

    B -->|Navigate| C[Page navigation]
    B -->|Zoom| D[Zoom controls]
    B -->|Reference| E[Open sidebar]
    B -->|Continue| A

    C --> C1{Method}
    C1 -->|Buttons| C2[Click prev/next]
    C1 -->|Keyboard| C3[Arrow keys]
    C1 -->|Go to page| C4[Enter page number]
    C1 -->|TOC| C5[Click TOC item]
    C2 --> A
    C3 --> A
    C4 --> A
    C5 --> A

    D --> D1{Method}
    D1 -->|Buttons| D2[Click +/-]
    D1 -->|Keyboard| D3[Ctrl +/-]
    D1 -->|Preset| D4[Select fit mode]
    D2 --> A
    D3 --> A
    D4 --> A

    E --> E1{Panel type}
    E1 -->|Navigation| E2[Show TOC]
    E1 -->|Context| E3[Show Highlights]
    E1 -->|Settings| E4[Show Settings]
    E2 --> A
    E3 --> A
    E4 --> A

    style Start fill:#e3f2fd
```

**Key Decisions**:
- Multiple navigation methods supported
- Sidebars available but not required
- Keyboard shortcuts for power users
- Focus on document content

---

### 3. Create Highlight

```mermaid
flowchart TD
    Start([Reading Document]) --> A[Select text with mouse]

    A --> B{Selection valid?}
    B -->|No| Start
    B -->|Yes| C[Show highlight toolbar]

    C --> D{User action}
    D -->|Choose color| E[Select color from palette]
    D -->|Cancel| F[Dismiss toolbar]
    D -->|Add note| G[Open note editor]

    E --> H[Create highlight]
    F --> Start

    G --> I[Enter note text]
    I --> J{Save note?}
    J -->|Yes| H
    J -->|No| F

    H --> K[Save to database]
    K --> L[Update highlight overlay]
    L --> M[Show success indicator]
    M --> Start

    style Start fill:#e3f2fd
    style H fill:#e8f5e9
```

**Key Decisions**:
- Toolbar appears near selection (context-aware)
- Color selection immediate (no dialog)
- Notes are optional
- Visual feedback on creation

---

### 4. Navigate Highlights

```mermaid
flowchart TD
    Start([Open Highlights Panel]) --> A{Has highlights?}

    A -->|No| B[Show empty state]
    A -->|Yes| C[List all highlights]

    B --> D[Prompt to create first]
    D --> End1([Close Panel])

    C --> E{User action}

    E -->|Click highlight| F[Navigate to location]
    E -->|Edit note| G[Open note editor]
    E -->|Delete| H[Confirm deletion]
    E -->|Export| I[Open export dialog]
    E -->|Filter| J[Apply filter]

    F --> K[Scroll to highlight]
    K --> L[Flash highlight]
    L --> End2([Continue Reading])

    G --> M[Edit note text]
    M --> N[Save changes]
    N --> C

    H --> O{Confirmed?}
    O -->|Yes| P[Delete highlight]
    O -->|No| C
    P --> C

    I --> Q[Select export format]
    Q --> R[Generate export]
    R --> S[Save/Copy result]
    S --> C

    J --> C

    style Start fill:#e3f2fd
    style End2 fill:#e8f5e9
```

**Key Decisions**:
- Click-to-navigate is primary action
- Confirmation before delete
- Export supports multiple formats
- Filter by color available

---

### 5. Use TTS Playback

```mermaid
flowchart TD
    Start([Document Open]) --> A{TTS available?}

    A -->|No| B[Show TTS error]
    A -->|Yes| C[Show playback bar]

    B --> End1([Handle Error])

    C --> D{User action}

    D -->|Configure| E[Open settings]
    D -->|Play| F[Start playback]

    E --> E1[Select voice]
    E --> E2[Adjust speed]
    E1 --> C
    E2 --> C

    F --> G{Has text?}
    G -->|No| H[Show no text warning]
    G -->|Yes| I[Begin speaking]

    H --> C

    I --> J[Highlight current sentence]
    J --> K[Auto-scroll if needed]
    K --> L{Sentence complete?}

    L -->|Yes| M{More text?}
    L -->|Paused| N[Wait for resume]

    M -->|Yes| I
    M -->|No| O[Playback complete]

    N --> P{User action}
    P -->|Resume| I
    P -->|Stop| C

    O --> C

    style Start fill:#e3f2fd
    style O fill:#e8f5e9
```

**Key Decisions**:
- TTS bar always visible when document open
- Sentence-level highlighting
- Auto-scroll keeps current text visible
- Clear feedback for empty/scanned pages

---

### 6. Manage Library

```mermaid
flowchart TD
    Start([Open Library]) --> A{Has documents?}

    A -->|No| B[Show empty state]
    A -->|Yes| C[Display document grid]

    B --> D[Prompt to add first]
    D --> E([Open File Flow])

    C --> F{User action}

    F -->|Search| G[Filter by query]
    F -->|Sort| H[Change sort order]
    F -->|Open doc| I[Load document]
    F -->|View info| J[Show document details]

    G --> C
    H --> C

    I --> End1([Reader View])

    J --> K[Display metadata]
    K --> L{User action}
    L -->|Edit| M[Edit metadata]
    L -->|Delete| N[Confirm delete]
    L -->|Close| C

    M --> C
    N --> O{Confirmed?}
    O -->|Yes| P[Remove from library]
    O -->|No| C
    P --> C

    style Start fill:#e3f2fd
    style End1 fill:#e8f5e9
```

**Key Decisions**:
- Grid view for visual scanning
- Search by title/content
- Reading progress visible
- Delete requires confirmation

---

## Navigation Model

### Three-Column Layout

```
┌─────────────────────────────────────────────────────────────┐
│                          TOOLBAR                             │
│  [☰] [Open] Title        [Page Nav]        [Zoom] [⚙️]      │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│  LEFT    │           MAIN                   │    RIGHT      │
│  SIDEBAR │         CONTENT                  │    PANEL      │
│          │                                  │               │
│  - TOC   │       PDF Viewer                 │  - Highlights │
│  - Pages │                                  │  - Notes      │
│  - Library│                                 │  - Search     │
│          │                                  │               │
│  280px   │         (flex)                   │     320px     │
├──────────┴──────────────────────────────────┴───────────────┤
│                       FOOTER BAR                             │
│                    [TTS Controls]                            │
└─────────────────────────────────────────────────────────────┘
```

### Panel Purposes

| Panel | Purpose | Content |
|-------|---------|---------|
| **Left Sidebar** | Navigation | TOC, Page thumbnails, Library |
| **Main Content** | Document | PDF viewer, primary workspace |
| **Right Panel** | Context | Highlights, Notes, Search results |
| **Toolbar** | Actions | Open, Navigate, Zoom, Settings |
| **Footer** | Playback | TTS controls, progress |

### State Transitions

```mermaid
stateDiagram-v2
    [*] --> Empty: App Launch
    Empty --> Reading: Open Document
    Reading --> Library: Toggle Library
    Library --> Reading: Select Document
    Reading --> Reading: Navigate/Zoom/Highlight
    Reading --> [*]: Close App

    state Reading {
        [*] --> Viewing
        Viewing --> Selecting: Text Selection
        Selecting --> Highlighting: Create Highlight
        Highlighting --> Viewing: Complete
        Selecting --> Viewing: Cancel

        Viewing --> Speaking: Start TTS
        Speaking --> Viewing: Stop TTS
    }
```

---

## Decision Rationale

### Why Three-Column Layout?

1. **Industry Standard**: Adobe Reader, Foxit, Calibre all use this pattern
2. **Separation of Concerns**: Navigation (left), Content (center), Context (right)
3. **Flexible**: Panels can be hidden for focused reading
4. **Scalable**: Works on various screen sizes

### Why Collapsible Panels?

1. **Focus Mode**: Users can hide panels for distraction-free reading
2. **Screen Real Estate**: Smaller screens benefit from full-width content
3. **User Preference**: Some users prefer minimal UI

### Why Footer for TTS?

1. **Persistent Access**: Always visible during playback
2. **Familiar Pattern**: Matches audio player conventions
3. **Non-intrusive**: Doesn't compete with document content

### Why Not Tabs?

1. **Parallel Access**: Users may want TOC and highlights simultaneously
2. **Context Preservation**: Panels maintain state when hidden
3. **Discoverability**: Panels are more visible than tab contents

---

## Keyboard Navigation Map

```
┌─────────────────────────────────────────────────────────────┐
│  Tab Order:                                                  │
│  1. Skip Link (optional)                                     │
│  2. Toolbar: Open → Page Nav → Zoom → Settings               │
│  3. Left Sidebar: Search → TOC items                         │
│  4. Main Content: PDF viewer                                 │
│  5. Right Panel: Panel header → List items                   │
│  6. Footer: Voice → Play/Pause → Speed                       │
└─────────────────────────────────────────────────────────────┘

Global Shortcuts:
├── Ctrl+O → Open file
├── Ctrl+W → Close document
├── Ctrl+, → Open settings
├── Ctrl+B → Toggle left sidebar
├── Ctrl+H → Toggle right panel (highlights)
├── Space → Play/Pause TTS
├── ← / → → Navigate pages
├── Ctrl++ / Ctrl+- → Zoom in/out
└── Escape → Close modal / Stop TTS
```

---

## Screen Transitions

```mermaid
graph LR
    subgraph Views
        E[Empty State]
        R[Reader View]
        L[Library View]
    end

    subgraph Panels
        T[TOC Panel]
        H[Highlights Panel]
        S[Settings Panel]
    end

    subgraph Dialogs
        O[Open Dialog]
        X[Export Dialog]
        D[Delete Confirm]
    end

    E -->|Open file| O
    O -->|Select| R
    E -->|Library| L
    L -->|Select doc| R
    R -->|Library button| L
    R -->|Toggle| T
    R -->|Toggle| H
    R -->|Toggle| S
    H -->|Export| X
    H -->|Delete| D

    style R fill:#e3f2fd
    style L fill:#e8f5e9
```

---

## Next Steps

1. Implement navigation controls in toolbar (Phase 7)
2. Add keyboard shortcuts (Phase 7)
3. Create panel toggle components (Phase 7)
4. Test navigation flows with users
