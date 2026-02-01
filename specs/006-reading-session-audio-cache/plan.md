# Implementation Plan: Reading Session Manager with Audio Cache & Progress Persistence

**Branch**: `006-reading-session-audio-cache` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-reading-session-audio-cache/spec.md`

## Summary

This feature implements persistent reading sessions with audio cache management and export capabilities. The primary requirement is eliminating redundant TTS API costs by caching generated audio locally with SQLite metadata tracking. The technical approach extends the existing `AudioCacheAdapter` with chunk-level metadata, adds reading session persistence via new SQLite tables, and provides audiobook export via MP3 concatenation with ID3v2 chapter markers.

## Technical Context

**Language/Version**: TypeScript 5.6+ (frontend), Rust 2021 edition (backend)  
**Primary Dependencies**: React 18.3+, Zustand 5.x, Tauri 2.x, tauri-specta, rodio, id3  
**Storage**: SQLite via tauri-plugin-sql (metadata), filesystem (MP3 audio files)  
**Testing**: Vitest with 80% coverage (frontend), cargo test --features test-mocks (backend)  
**Target Platform**: Desktop (macOS, Windows, Linux) via Tauri  
**Project Type**: Tauri (desktop app with web frontend + Rust backend)  
**Performance Goals**: Cache lookups <10ms (SC-006), cached playback <500ms (SC-001), coverage display <100ms (SC-002)  
**Constraints**: Default 5GB cache limit with LRU eviction, offline-capable  
**Scale/Scope**: Single user, documents up to 1000 pages, sessions up to 50 documents

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Hexagonal Architecture (Ports & Adapters)

| Requirement                                 | Status | Evidence                                                                    |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Domain layer has zero external dependencies | PASS   | `session.ts`, `coverage.ts` define pure entities with validation logic only |
| Ports define interface contracts            | PASS   | `session-repository.ts`, Rust traits in `contracts/rust-traits.rs`          |
| Adapters implement port interfaces          | PASS   | `TauriSessionAdapter`, `SqliteSessionRepository` planned per quickstart     |
| Application orchestrates through ports      | PASS   | Commands in `tauri_api/sessions.rs` use injected repositories               |
| UI consumes application services only       | PASS   | `useSessionStore` uses adapters via DI, not direct IPC                      |

### II. Type-Safe Tauri IPC (NON-NEGOTIABLE)

| Requirement                         | Status | Evidence                                       |
| ----------------------------------- | ------ | ---------------------------------------------- |
| No direct invoke() calls            | PASS   | Adapters use `commands` from `@/lib/bindings`  |
| Use tauri-specta generated bindings | PASS   | All commands use `#[specta::specta]` attribute |
| Commands registered in lib.rs       | PASS   | Plan includes registration in both macros      |

**Note**: quickstart.md line 229-254 shows a direct `invoke()` example - this must be corrected to use generated bindings during implementation.

### III. Test-First Development

| Requirement                 | Status  | Evidence                                                   |
| --------------------------- | ------- | ---------------------------------------------------------- |
| Domain logic tests          | PLANNED | `session.test.ts`, `coverage.test.ts` for validation logic |
| Adapter tests               | PLANNED | Backend tests with `--features test-mocks`                 |
| 80% coverage threshold      | PLANNED | Verification checklist in quickstart.md                    |
| Architecture boundary tests | PASS    | Existing tests in `src/__tests__/architecture/`            |

### IV. Design System Consistency

| Requirement                   | Status  | Evidence                                                        |
| ----------------------------- | ------- | --------------------------------------------------------------- |
| CSS tokens for colors/spacing | PLANNED | Components will use `var(--color-*)`, `var(--space-*)`          |
| Z-index tokens only           | PLANNED | Modal dialogs will use `var(--z-modal)`                         |
| Reuse existing UI components  | PLANNED | Will use `Button`, `Panel`, `ListRow` from `src/ui/components/` |

### V. State Management Patterns

| Requirement                     | Status  | Evidence                                       |
| ------------------------------- | ------- | ---------------------------------------------- |
| State machine for complex state | PASS    | Export process states defined in data-model.md |
| Debug logging                   | PLANNED | `console.debug('[SessionStore]')` pattern      |
| Ref pattern for async callbacks | PLANNED | Standard Zustand pattern                       |
| Store naming convention         | PASS    | `useSessionStore`, extends `useAiTtsStore`     |

**Constitution Check Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/006-reading-session-audio-cache/
├── plan.md              # This file
├── research.md          # Phase 0 output (COMPLETE)
├── data-model.md        # Phase 1 output (COMPLETE)
├── quickstart.md        # Phase 1 output (COMPLETE)
├── contracts/           # Phase 1 output (COMPLETE)
│   ├── tauri-commands.ts
│   └── rust-traits.rs
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Tauri Desktop Application Structure (existing)
src/                                    # Frontend (React/TypeScript)
├── adapters/tauri/
│   └── session.adapter.ts              # NEW: Tauri IPC adapter for sessions
├── components/
│   ├── session-menu/
│   │   └── SessionMenu.tsx             # NEW: Sidebar session manager
│   ├── audio-progress/
│   │   └── AudioCacheProgress.tsx      # NEW: Cache coverage indicator
│   └── export-dialog/
│       └── AudioExportDialog.tsx       # NEW: Export options dialog
├── domain/
│   ├── sessions/
│   │   └── session.ts                  # NEW: Session entity + validation
│   └── cache/
│       └── coverage.ts                 # NEW: Coverage stats entity
├── ports/
│   └── session-repository.ts           # NEW: Session repository interface
├── stores/
│   └── session-store.ts                # NEW: Zustand session state
└── lib/bindings.ts                     # Auto-generated Tauri bindings

src-tauri/src/                          # Backend (Rust)
├── adapters/
│   ├── sqlite/
│   │   └── session_repo.rs             # NEW: SQLite session repository
│   └── audio_cache.rs                  # MODIFY: Add metadata tracking
├── application/
│   └── audio_export_service.rs         # NEW: Export orchestration
├── commands/
│   └── sessions.rs                     # NEW: Tauri command handlers
├── db/
│   └── migrations.rs                   # MODIFY: Add migration v3
├── domain/
│   └── sessions/
│       ├── mod.rs                      # NEW: Module exports
│       ├── session.rs                  # NEW: Session entity
│       └── coverage.rs                 # NEW: Coverage stats
└── ports/
    └── session_repository.rs           # NEW: Repository trait

tests/                                  # Frontend tests
├── domain/
│   ├── sessions/
│   │   └── session.test.ts             # NEW: Session validation tests
│   └── cache/
│       └── coverage.test.ts            # NEW: Coverage calculation tests
└── adapters/
    └── session.adapter.test.ts         # NEW: Adapter tests
```

**Structure Decision**: Tauri desktop application with existing hexagonal architecture. New code follows established patterns in both frontend (TypeScript) and backend (Rust) layers.

## Complexity Tracking

> No constitution violations requiring justification. Feature aligns with existing patterns.

| Aspect                  | Justification                                            |
| ----------------------- | -------------------------------------------------------- |
| New SQLite tables       | Required for session persistence (FR-010 through FR-013) |
| Enhanced cache metadata | Required for coverage tracking (FR-007, FR-008)          |
| id3 crate dependency    | Required for audiobook chapter markers (FR-015)          |
