# Feature Specification: Tauri PDF Reader with TTS and Highlights

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Created**: 2026-01-11
**Status**: Draft
**Input**: VoxPage extension pivot - desktop Tauri app for reliable PDF reading with TTS, highlights, and reading progress

## Clarifications

### Session 2026-01-11

- Q: How should documents be uniquely identified? → A: Content hash (SHA-256 of file) - same file = same ID regardless of path
- Q: What data recovery strategy should be used? → A: Auto-save with recovery - periodic saves + restore prompt on crash detection
- Q: What observability/diagnostics approach should be used? → A: Full telemetry system - opt-in usage analytics + error reporting to server

## Overview

This specification defines a desktop PDF reader application built with Tauri that provides:
- Reliable local PDF rendering and navigation
- Text-to-speech playback with configurable voices and speed
- Text highlighting with color options and notes
- Reading progress persistence and resume functionality
- Library management for organizing documents

The application targets three primary personas:
1. **Students/Readers**: Need highlights, notes, and speed control for study materials
2. **Professionals**: Read reports and documents, need quick resume and efficient highlighting
3. **Accessibility Users**: Depend on TTS for reliable playback with clear visual focus

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and Read a PDF (Priority: P1)

A user wants to open a local PDF file and read it in the application with standard navigation controls.

**Why this priority**: This is the foundational capability - without PDF rendering, no other features function. This delivers immediate value as a basic PDF reader.

**Independent Test**: Can be fully tested by opening any PDF file and navigating through pages. Delivers value as a functional PDF viewer.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** the user clicks "Open PDF" and selects a local PDF file, **Then** the PDF is displayed with the first page visible and text is selectable.
2. **Given** a PDF is open, **When** the user clicks next/previous page buttons or uses keyboard shortcuts, **Then** the displayed page changes accordingly.
3. **Given** a PDF is open, **When** the user enters a specific page number, **Then** the application navigates to that page.
4. **Given** a PDF is open, **When** the user adjusts zoom level, **Then** the PDF renders at the new scale while maintaining readability.

---

### User Story 2 - Listen to PDF with Text-to-Speech (Priority: P1)

A user wants to have the PDF content read aloud using text-to-speech while following along visually.

**Why this priority**: TTS is a core differentiating feature and critical for accessibility users. Combined with P1 PDF viewing, this creates the minimum viable product.

**Independent Test**: Can be tested by opening any PDF and pressing play - audio should start and the current reading position should be visually indicated.

**Acceptance Scenarios**:

1. **Given** a PDF is open, **When** the user clicks the play button, **Then** TTS begins reading from the current position and the active text chunk is visually highlighted.
2. **Given** TTS is playing, **When** the user clicks pause, **Then** playback stops at the current position and can be resumed.
3. **Given** TTS is playing, **When** the user adjusts the speed slider, **Then** the playback speed changes without restarting.
4. **Given** TTS is playing, **When** the user selects a different voice from the voice picker, **Then** playback continues with the new voice.
5. **Given** TTS is playing and reaches the end of a page, **When** there are more pages, **Then** playback automatically continues to the next page.

---

### User Story 3 - Create and Manage Highlights (Priority: P2)

A user wants to highlight important text passages in the PDF and optionally add notes to them.

**Why this priority**: Highlights are essential for study and reference use cases. This builds on the core reading experience and adds significant value for retention and review.

**Independent Test**: Can be tested by selecting text and applying a highlight - the highlight should persist across app restarts and be visible in the highlights panel.

**Acceptance Scenarios**:

1. **Given** a PDF is open, **When** the user selects text with the mouse, **Then** a highlight toolbar appears with color options.
2. **Given** text is selected and the highlight toolbar is visible, **When** the user clicks a color, **Then** the text is highlighted with that color and the highlight is saved.
3. **Given** a highlight exists, **When** the user clicks on the highlight, **Then** a context menu appears with options to change color, add/edit note, or delete.
4. **Given** highlights exist in the document, **When** the user opens the highlights panel, **Then** all highlights are listed by page with their text content and any notes.
5. **Given** the highlights panel is open, **When** the user clicks a highlight in the list, **Then** the reader navigates to that highlight's location.

---

### User Story 4 - Resume Reading from Last Position (Priority: P2)

A user wants their reading progress saved automatically so they can resume where they left off.

**Why this priority**: Progress persistence removes friction from returning to documents. This is expected behavior in modern reading applications.

**Independent Test**: Can be tested by opening a PDF, navigating to a specific page, closing the app, and reopening - the document should resume at the last position.

**Acceptance Scenarios**:

1. **Given** the user is reading a PDF on page 50, **When** they close the application, **Then** the current page and scroll position are saved.
2. **Given** the user previously read a PDF to page 50, **When** they reopen that PDF, **Then** the application navigates to page 50 at the saved scroll position.
3. **Given** TTS was playing at a specific chunk, **When** the user closed and reopened the document, **Then** the user can resume TTS from the last played position.

---

### User Story 5 - Manage Document Library (Priority: P3)

A user wants to organize their PDF collection with a library view showing recently opened documents and reading progress.

**Why this priority**: Library management improves the experience for users with multiple documents but is not essential for the core reading/listening workflow.

**Independent Test**: Can be tested by importing multiple PDFs and verifying they appear in the library with correct metadata and progress indicators.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** the user views the library screen, **Then** all previously opened PDFs are listed with title, last opened date, and progress percentage.
2. **Given** the library contains documents, **When** the user searches by title, **Then** matching documents are filtered and displayed.
3. **Given** a document is in the library, **When** the user right-clicks and selects "Remove from library", **Then** the document is removed from the list (file remains on disk).
4. **Given** a document is in the library, **When** the user edits the display title, **Then** the custom title is shown in the library instead of the filename.

---

### User Story 6 - Follow-Along Reading Mode (Priority: P3)

A user wants the display to automatically scroll and highlight the text currently being read by TTS.

**Why this priority**: Follow-along mode significantly enhances the listening experience but requires TTS (P1) to be functional first.

**Independent Test**: Can be tested by enabling follow-along mode and starting TTS - the view should automatically scroll to keep the current reading position visible.

**Acceptance Scenarios**:

1. **Given** follow-along mode is enabled and TTS is playing, **When** the reading position advances, **Then** the view automatically scrolls to keep the current chunk visible.
2. **Given** follow-along mode is enabled, **When** TTS moves to a new page, **Then** the page automatically changes and the new content is displayed.
3. **Given** follow-along mode is enabled, **When** the user manually scrolls or navigates, **Then** follow-along temporarily pauses until TTS catches up or the user re-enables it.

---

### User Story 7 - Export Highlights and Notes (Priority: P4)

A user wants to export their highlights and notes to share or use in other applications.

**Why this priority**: Export is a power-user feature that adds value but is not essential for the core reading experience.

**Independent Test**: Can be tested by creating highlights, exporting, and verifying the exported file contains all highlight data in the expected format.

**Acceptance Scenarios**:

1. **Given** a document has highlights and notes, **When** the user selects "Export highlights" and chooses Markdown format, **Then** a .md file is created with all highlights organized by page.
2. **Given** a document has highlights and notes, **When** the user selects "Export highlights" and chooses JSON format, **Then** a .json file is created with structured highlight data.
3. **Given** the export dialog is open, **When** the user selects the export location, **Then** the file is saved to that location with the document title in the filename.

---

### User Story 8 - Configure TTS and Appearance Settings (Priority: P4)

A user wants to customize voice defaults, highlight colors, and keyboard shortcuts to match their preferences.

**Why this priority**: Settings improve personalization but the application should work well with sensible defaults.

**Independent Test**: Can be tested by changing settings and verifying they persist and affect application behavior.

**Acceptance Scenarios**:

1. **Given** the settings screen is open, **When** the user selects a default TTS voice and speed, **Then** new documents use these defaults.
2. **Given** the settings screen is open, **When** the user customizes highlight colors, **Then** the new colors appear in the highlight toolbar.
3. **Given** the settings screen is open, **When** the user views keyboard shortcuts, **Then** all available shortcuts are listed with their current bindings.

---

### Edge Cases

- What happens when a PDF has no extractable text (scanned image)? System should display the PDF visually but show a message that TTS is unavailable for this document.
- What happens when the selected TTS voice is no longer available (uninstalled)? System should fall back to the default system voice and notify the user.
- How does the system handle very large PDFs (1000+ pages)? Pages should load on-demand with virtualization; indexing happens in the background.
- What happens when a PDF file is moved or deleted externally? Library shows the document as "File not found" with option to relocate or remove.
- What happens when TTS text chunks exceed engine limits? System should split text into safe-length chunks automatically.
- How does highlight anchoring work if the PDF text layer is imprecise? Highlights are stored with multiple anchoring strategies (text content + bounding boxes + page/offset) for robust matching.
- What happens if the application crashes or is force-quit? On next launch, system detects unclean shutdown and offers to restore the last auto-saved session state.

## Requirements *(mandatory)*

### Functional Requirements

**PDF Viewing**
- **FR-001**: System MUST support opening local PDF files via file chooser dialog
- **FR-002**: System MUST render PDF pages with selectable text layer
- **FR-003**: System MUST support page navigation (next, previous, go-to-page)
- **FR-004**: System MUST support zoom controls (fit-to-width, fit-to-page, percentage)
- **FR-005**: System MUST display a table of contents if the PDF contains one

**Text-to-Speech**
- **FR-006**: System MUST list available system voices for user selection
- **FR-007**: System MUST support playback controls: play, pause, stop
- **FR-008**: System MUST support adjustable playback speed (0.5x to 3x range)
- **FR-009**: System MUST support next/previous chunk navigation during playback
- **FR-010**: System MUST visually indicate the current reading position during TTS playback
- **FR-011**: System MUST extract text from PDF in reading order for TTS consumption

**Highlighting**
- **FR-012**: System MUST capture user text selection within the PDF view
- **FR-013**: System MUST render highlights as overlays on the PDF pages
- **FR-014**: System MUST support multiple highlight colors (minimum 4 colors)
- **FR-015**: System MUST allow users to add, edit, and delete notes on highlights
- **FR-016**: System MUST persist highlights across application sessions
- **FR-017**: System MUST provide a highlights panel listing all highlights by page

**Progress & Persistence**
- **FR-018**: System MUST save reading position (page and scroll) when closing a document
- **FR-019**: System MUST restore reading position when reopening a document
- **FR-020**: System MUST save TTS playback position for resume functionality
- **FR-021**: System MUST persist all data locally using structured storage
- **FR-031**: System MUST auto-save reading progress and highlights periodically (at least every 30 seconds or on significant user actions)
- **FR-032**: System MUST detect unclean shutdown and prompt user to restore unsaved session data on next launch

**Library Management**
- **FR-022**: System MUST maintain a library of opened documents with metadata
- **FR-023**: System MUST display progress percentage for each library document
- **FR-024**: System MUST support removing documents from library without deleting files
- **FR-025**: System MUST support custom display titles for documents

**Export**
- **FR-026**: System MUST support exporting highlights to Markdown format
- **FR-027**: System MUST support exporting highlights to JSON format

**Settings**
- **FR-028**: System MUST persist user preferences for TTS defaults (voice, speed)
- **FR-029**: System MUST persist user preferences for highlight colors
- **FR-030**: System MUST provide keyboard shortcuts for common actions:
  - Navigation: Arrow Left/Right (prev/next page), Page Up/Down, Home/End (first/last page), Ctrl+G (go to page)
  - TTS: Space (play/pause), Escape (stop), Ctrl+Left/Right (prev/next chunk)
  - Zoom: Ctrl+Plus/Minus (zoom in/out), Ctrl+0 (fit to page)
  - General: Ctrl+O (open file), Ctrl+F (search), F11 (fullscreen)

**Observability & Telemetry**
- **FR-033**: System MUST maintain structured local logs for debugging purposes
- **FR-034**: System MUST provide a "Copy debug logs" action for user-initiated troubleshooting
- **FR-035**: System MUST support opt-in usage analytics (disabled by default)
- **FR-036**: System MUST support opt-in automatic error reporting to a telemetry server
- **FR-037**: System MUST clearly disclose what data is collected before user opts in
- **FR-038**: System MUST function fully offline when telemetry is disabled

### Key Entities

- **Document**: Represents a PDF in the library. Contains: unique identifier (SHA-256 content hash - enables duplicate detection and survives file relocation), file path, display title, page count, current page, scroll position, last opened timestamp, reading progress percentage.

- **Highlight**: A marked text passage within a document. Contains: unique identifier, document reference, page number, text content, bounding rectangles, color, optional note, creation timestamp.

- **Reading Progress**: Tracks position within a document. Contains: document reference, current page, scroll offset, last TTS chunk identifier.

- **Settings**: User preferences. Contains: default TTS voice, default TTS speed, highlight color palette, keyboard shortcut mappings, theme preference, telemetry opt-in status (analytics and error reporting, both disabled by default).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open a PDF and begin reading within 3 seconds of file selection
- **SC-002**: Users can start TTS playback within 2 seconds of clicking play
- **SC-003**: Creating a highlight requires no more than 2 user actions (select text, click color)
- **SC-004**: Reading position restores accurately within 1 page of where the user left off
- **SC-005**: System handles PDFs up to 500 pages with page render time <500ms and navigation <200ms (measured via performance profiling)
- **SC-006**: TTS playback continues without interruption for documents up to 100 pages
- **SC-007**: Highlights remain accurately positioned after closing and reopening a document
- **SC-008**: Application launches and displays library within 2 seconds
- **SC-009**: Core workflow (open PDF, play TTS, create highlight) is discoverable via standard UI patterns (file menu, toolbar buttons, context menus) with no hidden gestures required
- **SC-010**: Exported highlights contain 100% of the user's annotations with correct page references

## Assumptions

- Users have PDF files stored locally on their computer
- Target operating systems (Windows, macOS, Linux) provide native TTS voices
- PDF files contain extractable text (not scanned images) for TTS functionality
- Users have sufficient disk space for the SQLite database storing highlights and progress
- Network connectivity is not required for core functionality (offline-first design); network is only used for optional opt-in telemetry

## Out of Scope

- Cloud synchronization of highlights or reading progress
- PDF annotation editing (modifying the actual PDF file)
- OCR for scanned/image-based PDFs
- Cloud-based TTS voices (native OS voices only for MVP)
- Collaborative features (sharing, real-time collaboration)
- Mobile platform support (desktop only: Windows, macOS, Linux)
- PDF creation or editing capabilities
- Integration with external note-taking applications

## Dependencies

- Tauri 2.x framework for desktop application shell
- PDF rendering library (pdf.js) for viewing and text extraction
- Native TTS APIs provided by each operating system
- SQLite for local data persistence
