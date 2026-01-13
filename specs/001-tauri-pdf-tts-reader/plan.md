# Implementation Plan: Tauri PDF Reader with TTS and Highlights

**Branch**: `001-tauri-pdf-tts-reader` | **Date**: 2026-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-tauri-pdf-tts-reader/spec.md`

## Summary

A desktop PDF reader application built with Tauri 2.x that enables users to open local PDFs, listen via native text-to-speech, create persistent highlights with notes, and track reading progress across sessions. The application follows an offline-first architecture with SQLite persistence and optional opt-in telemetry.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Rust 1.75+ (backend)
**Primary Dependencies**: React 18+, Tauri 2.x, pdf.js, Zustand, Zod, tauri-plugin-sql, tauri-plugin-dialog
**Storage**: SQLite via tauri-plugin-sql (local database)
**Testing**: Vitest (frontend), cargo test (backend), tauri-driver (E2E)
**Target Platform**: Desktop (Windows, macOS, Linux)
**Project Type**: Tauri desktop app (frontend WebView + Rust backend)
**Performance Goals**: PDF first page <500ms, page navigation <200ms, UI interactions <100ms, startup <2s
**Constraints**: <150MB base memory, offline-capable, keyboard accessible
**Scale/Scope**: Single-user desktop app, supports PDFs up to 500+ pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Type Safety First | ✅ PASS | TypeScript strict mode + Zod schemas (frontend), Rust types + serde (backend) |
| II. Separation of Concerns | ✅ PASS | Frontend: UI/pdf.js rendering. Backend: persistence/TTS/files. Clear IPC boundary. |
| III. Error Resilience | ✅ PASS | FR-032 crash recovery, edge cases defined for all failure modes |
| IV. Test Coverage | ✅ PASS | Contract tests, integration tests, cargo tests planned |
| V. Performance Budget | ✅ PASS | SC-001/002/008 align with constitution targets |
| VI. Accessibility | ✅ PASS | TTS core feature, keyboard navigation required (FR-030) |
| VII. Offline-First | ✅ PASS | SQLite local storage, no network for core features (FR-038) |
| VIII. Security Boundaries | ✅ PASS | Tauri capabilities model, file dialog for access, CSP configured |

**Gate Result**: PASS - All principles satisfied. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-tauri-pdf-tts-reader/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   ├── library.contract.md
│   ├── highlights.contract.md
│   └── tts.contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/                           # Frontend (React/TypeScript)
├── components/
│   ├── pdf-viewer/            # PDF rendering, text layer, highlight overlay
│   ├── playback-bar/          # TTS controls
│   ├── sidebar/               # TOC, highlights panel
│   ├── library/               # Document library view
│   └── settings/              # Settings panel
├── stores/
│   ├── document-store.ts      # Current document state
│   ├── library-store.ts       # Library management
│   ├── tts-store.ts           # TTS playback state
│   └── settings-store.ts      # User preferences
├── lib/
│   ├── schemas.ts             # Zod schemas (shared types)
│   ├── tauri-invoke.ts        # Type-safe IPC wrapper
│   └── pdf-utils.ts           # pdf.js helpers
└── hooks/                     # React hooks

src-tauri/                     # Backend (Rust)
├── src/
│   ├── main.rs                # Tauri entry point
│   ├── commands/
│   │   ├── library.rs         # Document CRUD commands
│   │   ├── highlights.rs      # Highlight CRUD commands
│   │   ├── tts.rs             # TTS control commands
│   │   ├── settings.rs        # Settings persistence
│   │   └── telemetry.rs       # Opt-in telemetry
│   ├── db/
│   │   ├── mod.rs             # Database module
│   │   ├── schema.rs          # Table definitions
│   │   └── migrations/        # SQLite migrations
│   ├── services/
│   │   ├── document.rs        # Document management
│   │   ├── tts.rs             # Native TTS adapter
│   │   └── recovery.rs        # Auto-save & crash recovery
│   └── lib.rs
├── Cargo.toml
└── tauri.conf.json

tests/                         # Test suites
├── contract/                  # IPC contract tests
├── integration/               # Frontend-backend integration
└── e2e/                       # tauri-driver E2E tests
```

**Structure Decision**: Tauri standard layout with `src/` for frontend and `src-tauri/` for Rust backend. Feature-organized components and domain-organized Rust modules.

## Complexity Tracking

No constitution violations requiring justification. Design adheres to all principles.
