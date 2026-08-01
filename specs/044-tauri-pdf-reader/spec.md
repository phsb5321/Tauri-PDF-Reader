# Feature Specification: Tauri PDF Reader with Highlights and TTS

**Feature Branch**: `044-tauri-pdf-reader`  
**Created**: 2026-01-11  
**Status**: Draft  
**Input**: Research-first bootstrap for a Tauri 2.x desktop app that opens local PDFs reliably, supports text selection and highlights, and reads text aloud with cross-platform TTS.
**Prior Work Reference**: VoxPage commit `735a0a7` (telemetry, PDF improvements)

---

## Research Decisions Summary

This specification is the result of extensive research into the feasibility of building a Tauri 2.x desktop application for PDF reading with highlights and text-to-speech. The following key decisions were made based on technical research:

### Decision A: PDF Rendering Strategy

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| PDF.js in WebView | Excellent text layer, selection support, familiar from VoxPage, quick highlight overlays, active community | Bundled in frontend, slightly larger app size | **CHOSEN for v0** |
| Native Pdfium (Rust) | More control, can write real PDF annotations, smaller frontend | Complex packaging, native libs per-platform, steeper learning curve | Future consideration |

**Rationale**: PDF.js provides proven text layer rendering and selection that we already understand from VoxPage. The text layer DOM structure enables straightforward highlight overlay implementation without PDF rewriting complexity.

### Decision B: Highlight Model

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Overlay highlights (app-side JSON) | Simple to implement, no PDF modification, fast iteration | Highlights not portable to other PDF readers | **CHOSEN for v0** |
| Embedded PDF annotations | Portable, standard format | Complex to write, PDF.js can read but not write annotations, requires Pdfium or similar | Future iteration |

**Rationale**: Overlay highlights stored as JSON allow rapid development. Real PDF annotations require writing to the PDF file format which adds significant complexity. The overlay approach stores highlight metadata (page, rects/quads, color, createdAt) in SQLite.

### Decision C: Text-to-Speech Strategy

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Native TTS (Rust `tts` crate) | Cross-platform (Windows/macOS/Linux), reliable, no webview dependency | Requires Rust FFI, Speech Dispatcher on Linux | **CHOSEN for v0** |
| Web Speech API | Simple JavaScript API | Unreliable in Linux webviews, may not be available | Fallback only |
| tauri-plugin-tts | Tauri 2.x compatible, cross-platform | Community plugin, less mature | Alternative if `tts` crate has issues |

**Rationale**: The Rust `tts` crate (v0.26) provides high-level TTS across all desktop platforms: Windows (WinRT/SAPI), macOS (AVFoundation/AppKit), Linux (Speech Dispatcher). Web Speech API is unreliable in Tauri's webview on Linux.

### Decision D: Local File Loading

**Solution**: Use Tauri's asset protocol with `convertFileSrc()` and proper scope configuration.

- Local PDF files selected via file dialog are converted to asset protocol URLs
- CSP must allow `asset:` protocol for PDF.js to load files
- File system scope permissions must be configured in capabilities

### Decision E: Persistence Model

**Solution**: SQLite via `tauri-plugin-sql` (official Tauri plugin, uses sqlx).

### Decision F: E2E Testing

**Solution**: `tauri-driver` with WebDriver on Linux/Windows. macOS has limited support.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and View Local PDF (Priority: P1)

As a user, I want to open a PDF file from my computer and view it in the application so I can read documents without browser security restrictions.

**Why this priority**: This is the foundational capability. Without reliable PDF opening, no other features work. This directly solves the `file://` URL problem encountered in VoxPage.

**Independent Test**: Can be fully tested by opening any local PDF and verifying all pages render correctly. Delivers the core value of reliable local PDF access.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** I click "Open PDF" and select a file, **Then** the PDF renders in the viewer with all pages accessible.
2. **Given** a PDF is open, **When** I navigate between pages, **Then** each page renders correctly with text visible.
3. **Given** a PDF is open, **When** I zoom in/out, **Then** the content scales appropriately and remains readable.

---

### User Story 2 - Select Text and Create Highlights (Priority: P2)

As a user, I want to select text in the PDF and create colored highlights so I can mark important passages for later reference.

**Why this priority**: Highlighting is the primary annotation feature and enables the read-aloud use case. Without text selection, TTS of specific passages is not possible.

**Independent Test**: Can be tested by selecting text and clicking "Highlight", then verifying the highlight persists after closing and reopening the document.

**Acceptance Scenarios**:

1. **Given** a PDF is open, **When** I click and drag to select text, **Then** the text selection is visually indicated.
2. **Given** text is selected, **When** I click "Highlight" or use a keyboard shortcut, **Then** the selected text is highlighted with a visible color overlay.
3. **Given** highlights exist, **When** I close and reopen the document, **Then** all highlights are restored in their original positions.
4. **Given** a highlight exists, **When** I click on it, **Then** I can delete it or change its color.

---

### User Story 3 - Read Highlighted Text Aloud (Priority: P3)

As a user, I want to hear highlighted passages read aloud so I can consume content without reading.

**Why this priority**: TTS is the "audio reading" core feature, but depends on text selection/highlighting working first.

**Independent Test**: Can be tested by selecting a highlight and clicking "Play", verifying audio output matches the highlighted text.

**Acceptance Scenarios**:

1. **Given** a highlight exists, **When** I click "Play" on that highlight, **Then** the highlighted text is read aloud.
2. **Given** audio is playing, **When** I click "Pause", **Then** playback stops and can be resumed.
3. **Given** audio is playing, **When** I adjust the speed slider, **Then** the speech rate changes accordingly.
4. **Given** multiple voices are available, **When** I select a different voice, **Then** subsequent playback uses the selected voice.

---

### User Story 4 - Read Current Page Aloud (Priority: P4)

As a user, I want to read the entire current page aloud so I can listen to full pages without manually selecting text.

**Why this priority**: Full-page reading extends the TTS feature for users who want hands-free reading without creating highlights.

**Independent Test**: Can be tested by clicking "Read Page" and verifying all visible text is spoken in reading order.

**Acceptance Scenarios**:

1. **Given** a PDF page is displayed, **When** I click "Read Page", **Then** all text on the current page is read aloud in reading order.
2. **Given** page reading is in progress, **When** I navigate to another page, **Then** reading stops.

---

### User Story 5 - Manage Document Library (Priority: P5)

As a user, I want to see a list of recently opened documents with their reading progress so I can quickly resume reading.

**Why this priority**: Library management improves user experience but is not required for core functionality.

**Independent Test**: Can be tested by opening multiple PDFs and verifying they appear in a "Recent" list with last page viewed.

**Acceptance Scenarios**:

1. **Given** I have opened PDFs before, **When** I view the library, **Then** I see a list of recently opened documents with titles and thumbnails.
2. **Given** I was on page 50 of a document, **When** I reopen it from the library, **Then** it opens to page 50.

---

### Edge Cases

- What happens when the user opens a password-protected PDF? → Display password prompt; if cancelled, show error message.
- What happens when the PDF has no extractable text (scanned image)? → Inform user that text selection and TTS are unavailable for this document.
- What happens when TTS is unavailable on the system? → Display message with instructions to install speech synthesis (e.g., Speech Dispatcher on Linux).
- What happens when a highlight spans multiple pages? → Store as separate highlights per page, play sequentially.
- What happens when the PDF file is deleted after being added to the library? → Show "File not found" error when attempting to open, offer to remove from library.

---

## Requirements *(mandatory)*

### Functional Requirements

#### PDF Viewing
- **FR-001**: System MUST open local PDF files from the file system without `file://` URL restrictions.
- **FR-002**: System MUST render PDF pages with visible text using a text layer that supports selection.
- **FR-003**: System MUST support page navigation (next/previous, go to page, scroll).
- **FR-004**: System MUST support zoom controls (fit width, fit page, percentage zoom).
- **FR-005**: System MUST handle multi-page PDFs of varying sizes (1 page to 1000+ pages).

#### Text Selection and Highlights
- **FR-006**: System MUST allow users to select text by clicking and dragging.
- **FR-007**: System MUST create visual highlight overlays on selected text when user requests.
- **FR-008**: System MUST persist highlights to local storage (survives app restart).
- **FR-009**: System MUST support multiple highlight colors.
- **FR-010**: System MUST allow users to delete existing highlights.

#### Text-to-Speech
- **FR-011**: System MUST read highlighted text aloud using native speech synthesis.
- **FR-012**: System MUST read the current page text aloud when requested.
- **FR-013**: System MUST provide playback controls: play, pause, stop.
- **FR-014**: System MUST allow users to adjust speech rate.
- **FR-015**: System MUST allow users to select from available system voices.

#### Document Library
- **FR-016**: System MUST track recently opened documents.
- **FR-017**: System MUST persist reading progress (current page) per document.
- **FR-018**: System MUST allow users to remove documents from the library.

#### Cross-Platform
- **FR-019**: System MUST run on Windows 10+, macOS 10.15+, and Linux (Ubuntu 20.04+).
- **FR-020**: System MUST use native TTS engines on each platform (SAPI/WinRT on Windows, AVFoundation on macOS, Speech Dispatcher on Linux).

### Key Entities

- **Document**: Represents a PDF file in the library. Key attributes: file path, title (from metadata or filename), page count, last opened date, current page (reading progress), file hash (for identity).

- **Highlight**: A text highlight within a document. Key attributes: document reference, page number, position data (quads/rects in PDF coordinates), color, created timestamp, text content (for TTS).

- **ReadingSession**: Tracks reading activity. Key attributes: document reference, start time, end time, pages viewed.

- **AppSettings**: User preferences. Key attributes: default highlight color, default voice, speech rate, theme.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open a local PDF and view the first page within 3 seconds of file selection.
- **SC-002**: Text selection and highlight creation completes within 500ms of user action.
- **SC-003**: TTS playback begins within 1 second of clicking "Play".
- **SC-004**: Application successfully opens 95% of standard PDF files (non-encrypted, non-corrupted).
- **SC-005**: Reading progress and highlights persist with 100% reliability across app restarts.
- **SC-006**: Application runs on all three target platforms (Windows, macOS, Linux) without platform-specific crashes.
- **SC-007**: 80% of test users successfully complete the "open PDF → highlight text → play audio" workflow on first attempt without assistance.

---

## Assumptions

1. **PDF.js bundling**: PDF.js will be bundled with the frontend and loaded from the app's resources, not from a CDN.
2. **Single-window application**: The app will have a single main window; multi-window support is not required for v0.
3. **Local-only storage**: All data (highlights, library, settings) is stored locally; no cloud sync for v0.
4. **No OCR**: Scanned PDFs without text layers are not supported for selection/TTS in v0.
5. **Speech Dispatcher availability**: Linux users are assumed to have Speech Dispatcher installed (common on most desktop Linux distributions).
6. **No annotation export**: Highlights are not exported back to the PDF file in v0; they exist only in the app's database.

---

## Technical Research References

### Tauri 2.x
- Project creation: https://tauri.app/start/create-project/
- Permissions system: https://tauri.app/security/permissions/
- File system plugin: https://tauri.app/plugin/file-system/
- SQL plugin: https://tauri.app/plugin/sql/
- WebDriver testing: https://tauri.app/develop/tests/webdriver/

### PDF.js
- Getting started: https://mozilla.github.io/pdf.js/getting_started/
- Examples: https://mozilla.github.io/pdf.js/examples/
- Current version: v5.4.530

### TTS
- Rust `tts` crate: https://docs.rs/tts/latest/tts/
- Supported backends: Windows (WinRT), macOS (AVFoundation/AppKit), Linux (Speech Dispatcher), Android, WebAssembly

---

## Spike Plan (Pre-Implementation Validation)

Before full implementation, the following time-boxed spikes should validate key assumptions:

### Spike A: PDF Opening (2 hours)
**Goal**: Open local PDF via file dialog, convert path to asset URL, render first page with PDF.js.
**Success**: PDF displays with text layer visible.
**Document**: What worked, what failed, any CSP or scope issues encountered.

### Spike B: Text Selection and Highlight (2 hours)
**Goal**: Select text in PDF.js text layer, compute bounding rects, render overlay highlight, persist to JSON/SQLite.
**Success**: Highlight persists after page navigation and app restart.
**Document**: Coordinate transformation issues, text layer DOM structure.

### Spike C: Native TTS (2 hours)
**Goal**: Call Rust `tts` crate from Tauri command, speak provided text, verify voice selection and rate control.
**Success**: Audio plays on all three platforms with adjustable rate and voice.
**Document**: Platform-specific setup requirements, voice enumeration.

### Spike D: E2E Test (2 hours)
**Goal**: Run `tauri-driver` WebDriver test that opens a PDF and verifies a UI element.
**Success**: Automated test passes in CI (Linux).
**Document**: Driver setup, CI configuration.

---

## Out of Scope (v0 Non-Goals)

- Full-featured PDF editor (forms, signatures, redaction)
- OCR for scanned documents
- Cloud sync or multi-device accounts
- Word-level highlighting during TTS (future iteration)
- PDF annotation embedding (exporting highlights back to PDF)
- Mobile platforms (iOS/Android)
- Printing support
