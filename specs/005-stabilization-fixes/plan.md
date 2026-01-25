# Implementation Plan: Selection + Read-along Highlights + TTS Playback Stability

**Branch**: `005-stabilization-fixes` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-stabilization-fixes/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix critical user-facing bugs in the Tauri PDF reader that prevent core features from working: text selection fails due to DOM container mismatch, TTS read-along highlights are invisible or stale, playback triggers duplicate audio streams, multi-page TTS stops after page 1, and audio/timestamp caching is incomplete. This is a **stabilization sprint** focused on fixing existing behavior rather than adding new features.

**Technical Approach**:
1. Selection: Replace `pageContainerRef.contains()` with `closest('[data-page-number]')` for stable page root detection
2. Highlights: Remove prop-based textLayerRef in favor of dynamic DOM lookup to avoid stale references
3. Playback: Implement explicit state machine with request ID gating to prevent double-play
4. Multi-page: Fix closure-captured state issues in playback completion handlers
5. Persistence: Populate existing cache metadata table and implement LRU eviction

## Technical Context

**Language/Version**: TypeScript 5.6.x (frontend), Rust 2021 edition (backend)
**Primary Dependencies**: React 18.3, Tauri 2.x, pdf.js 4.10, Zustand 5.x, Zod 3.24 (FE); tauri 2.x, sqlx 0.8, serde 1.x (BE)
**Storage**: SQLite via tauri-plugin-sql (local database for documents, highlights, TTS cache metadata)
**Testing**: Vitest (frontend unit/integration), cargo test (backend), Playwright (E2E)
**Target Platform**: Linux/macOS/Windows desktop via Tauri
**Project Type**: Desktop app (Tauri: Rust backend + React frontend)
**Performance Goals**: PDF first page <500ms, page navigation <200ms, UI interactions <100ms, cache hit <50ms
**Constraints**: Offline-first (no network required for core), <150MB base memory, audio cache eviction at configurable limit
**Scale/Scope**: Single-user desktop app, PDFs up to 1000+ pages, audio cache per-document/per-page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate (Phase 0)

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Type Safety First | ✅ PASS | TypeScript strict mode, Zod validation, Rust Result<T,E> patterns already in place |
| II. Separation of Concerns | ✅ PASS | Changes respect FE/BE boundary; state machine in Zustand, cache in Rust |
| III. Error Resilience | ✅ PASS | Spec defines graceful degradation for TTS failures, error recovery UI |
| IV. Test Coverage | ✅ PASS | Spec mandates unit/integration/E2E tests per workstream |
| V. Performance Budget | ✅ PASS | Cache hit <50ms target; no changes to render path |
| VI. Accessibility | ✅ PASS | TTS is accessibility feature; keyboard shortcuts preserved |
| VII. Offline-First | ✅ PASS | Audio caching enables offline replay; no network for core |
| VIII. Security Boundaries | ✅ PASS | File access via Tauri dialog; no new permissions needed |

### Technology Constraints

| Constraint | Status | Notes |
|------------|--------|-------|
| Tauri 2.x | ✅ | No framework changes |
| React 18+ | ✅ | StrictMode-safe fixes required |
| TypeScript 5.x | ✅ | Strict mode maintained |
| Rust 1.75+ | ✅ | No toolchain changes |
| pdf.js | ✅ | No pdf.js text layer modifications |
| Zustand | ✅ | State machine additions |
| SQLite | ✅ | Cache metadata table already exists |

### Gate Result: **PASS** - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-stabilization-fixes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Tauri Desktop Application (Frontend + Backend in single repo)
src/                            # React/TypeScript frontend
├── components/
│   ├── PdfViewer.tsx           # Main PDF viewer (selection handling - ISSUE #1)
│   ├── TextLayer.tsx           # Text layer + selection (ISSUE #1, #8)
│   ├── PageNavigation.tsx      # Page navigation controls
│   └── pdf-viewer/
│       ├── PdfPage.tsx         # Individual page rendering
│       ├── TtsWordHighlight.tsx # Read-along highlights (ISSUE #2, #6)
│       └── TtsWordHighlight.css
├── components/playback-bar/
│   ├── AiPlaybackBar.tsx       # TTS controls (ISSUE #3, #4)
│   └── AiTtsSettings.tsx
├── hooks/
│   ├── useAiTts.ts             # TTS hook
│   └── useTtsWordHighlight.ts  # Word highlight hook (ISSUE #3, #5, #9)
├── stores/
│   ├── ai-tts-store.ts         # TTS state machine (ISSUE #3)
│   ├── document-store.ts       # Document state
│   └── tts-highlight-store.ts  # Highlight state
├── lib/
│   └── coordinate-transform.ts  # Coordinate utils (ISSUE #8)
└── services/

src-tauri/                      # Rust/Tauri backend
├── src/
│   ├── adapters/
│   │   └── audio_cache.rs      # TTS cache (ISSUE #7)
│   ├── commands/
│   │   └── ai_tts.rs           # TTS commands
│   ├── db/
│   │   ├── migrations.rs       # DB schema
│   │   └── models.rs
│   └── lib.rs
└── tests/

src/__tests__/                  # Frontend tests
├── architecture/               # Boundary validation
├── ui/                         # Component tests
└── integration/                # Integration tests

e2e/                            # Playwright E2E tests
```

**Structure Decision**: Tauri desktop app with React frontend (`src/`) and Rust backend (`src-tauri/`). Tests colocated with source. E2E tests in dedicated `e2e/` directory.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations identified. All changes align with existing architecture and constitution principles.*

---

### Post-Design Gate (Phase 1)

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Type Safety First | ✅ PASS | All new types defined in data-model.md; WordTiming interface matches Rust struct |
| II. Separation of Concerns | ✅ PASS | Cache logic in Rust adapter; state machine in Zustand store; UI unchanged |
| III. Error Resilience | ✅ PASS | Cache validation detects corruption; request ID prevents race conditions |
| IV. Test Coverage | ✅ PASS | Spec defines test requirements per workstream; quickstart includes verification steps |
| V. Performance Budget | ✅ PASS | LRU eviction prevents unbounded disk growth; access_count enables hybrid caching |
| VI. Accessibility | ✅ PASS | No accessibility regressions; TTS highlight fixes improve screen reader compatibility |
| VII. Offline-First | ✅ PASS | Audio caching with timings enables full offline replay |
| VIII. Security Boundaries | ✅ PASS | Cache stored in app_data_dir; no external file access added |

### Gate Result: **PASS** - Design complete. Ready for `/speckit.tasks`.

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/005-stabilization-fixes/plan.md` | ✅ Complete |
| Research | `specs/005-stabilization-fixes/research.md` | ✅ Complete |
| Data Model | `specs/005-stabilization-fixes/data-model.md` | ✅ Complete |
| API Contracts | `specs/005-stabilization-fixes/contracts/tauri-commands.md` | ✅ Complete |
| Quickstart | `specs/005-stabilization-fixes/quickstart.md` | ✅ Complete |

## Next Steps

Run `/speckit.tasks` to generate the task breakdown from this plan.
