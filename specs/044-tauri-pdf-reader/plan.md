# Implementation Plan: Tauri PDF Reader

**Branch**: `044-tauri-pdf-reader` | **Date**: 2026-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-tauri-pdf-reader/spec.md`

## Summary

Build a Tauri 2.x desktop application for reading local PDFs with text selection, persistent highlights (overlay model), and cross-platform native TTS. The app uses PDF.js in a WebView for rendering, SQLite for persistence, and the Rust `tts` crate for speech synthesis.

## Technical Context

**Language/Version**: Rust 1.75+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: Tauri 2.x, PDF.js v5.4.x, Rust `tts` crate v0.26
**Storage**: SQLite via `tauri-plugin-sql` (highlights, library, settings)
**Testing**: `tauri-driver` + WebDriver (E2E), Vitest (frontend unit), `cargo test` (Rust unit)
**Target Platform**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
**Project Type**: Desktop app (Tauri: Rust backend + Web frontend)
**Performance Goals**: PDF first page render <3s, highlight creation <500ms, TTS start <1s
**Constraints**: Cross-platform TTS via native engines, offline-capable, no cloud sync
**Scale/Scope**: Single-user desktop app, library of ~1000 PDFs, documents up to 1000+ pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution Principle | Applicability | Status |
|------------------------|---------------|--------|
| **I. Firefox-First** | NOT APPLICABLE - This is a standalone Tauri desktop app, not a browser extension. VoxPage extension remains Firefox-first; this is a separate project. | N/A |
| **II. Privacy by Design** | APPLIES - No external data transmission, all data local. No API keys required for core functionality. User content stays on device. | PASS |
| **III. Hexagonal Architecture** | ADAPTS - Tauri naturally separates frontend (WebView) from backend (Rust). IPC commands serve as the "ports" boundary. Will structure frontend with services/adapters pattern. | PASS |
| **IV. Test Coverage** | APPLIES - Unit tests for Rust commands, frontend services. E2E tests via tauri-driver. Contract tests for IPC boundary. | PASS |
| **V. Observability** | PARTIAL - Local-only app, telemetry optional. Will add structured logging for debugging. | PASS |
| **VI. Simplicity** | APPLIES - Overlay highlights (not PDF annotation), single window, local storage only. YAGNI followed. | PASS |

**Gate Evaluation**: All applicable constitution principles satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/044-tauri-pdf-reader/
├── plan.md              # This file
├── research.md          # Phase 0 output - Tauri/PDF.js/TTS integration patterns
├── data-model.md        # Phase 1 output - Entity schemas
├── quickstart.md        # Phase 1 output - Dev environment setup
├── contracts/           # Phase 1 output - Tauri IPC command definitions
│   ├── tts.contract.md
│   ├── library.contract.md
│   └── highlights.contract.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
tauri-pdf-reader/              # Separate Tauri project (not inside VoxPage extension)
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── main.rs            # Tauri entry point
│   │   ├── commands/          # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── tts.rs         # TTS commands (speak, pause, voices)
│   │   │   ├── library.rs     # Document library commands
│   │   │   └── highlights.rs  # Highlight CRUD commands
│   │   ├── db/                # Database layer
│   │   │   ├── mod.rs
│   │   │   ├── migrations/
│   │   │   └── models.rs
│   │   └── tts/               # TTS engine wrapper
│   │       ├── mod.rs
│   │       └── engine.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # TypeScript frontend
│   ├── components/            # UI components
│   │   ├── PdfViewer.tsx
│   │   ├── HighlightLayer.tsx
│   │   ├── Toolbar.tsx
│   │   └── Library.tsx
│   ├── services/              # Frontend business logic
│   │   ├── pdf-service.ts     # PDF.js wrapper
│   │   ├── highlight-service.ts
│   │   ├── tts-service.ts     # IPC to Rust TTS
│   │   └── library-service.ts
│   ├── stores/                # State management
│   │   ├── document-store.ts
│   │   └── settings-store.ts
│   ├── lib/                   # Utilities
│   │   └── tauri-invoke.ts    # Typed IPC wrapper
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── e2e/                   # tauri-driver WebDriver tests
│   ├── unit/                  # Vitest frontend tests
│   └── fixtures/              # Test PDFs
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

**Structure Decision**: Tauri standard structure with `src-tauri/` (Rust) and `src/` (frontend). This will be created as a sibling project to VoxPage or in a subdirectory, depending on mono-repo decision. For v0, treating as standalone project.

## Complexity Tracking

> No constitution violations requiring justification. All decisions follow YAGNI:
> - Overlay highlights (not embedded annotations) - simpler
> - SQLite (not separate ORM) - simpler
> - Single window (not multi-window) - simpler
> - Local only (no sync) - simpler
