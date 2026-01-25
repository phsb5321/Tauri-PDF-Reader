# Implementation Plan: PDF Rendering Quality & Hardware Acceleration

**Branch**: `004-pdf-render-quality` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-pdf-render-quality/spec.md`

## Summary

Implement browser-quality PDF rendering with configurable quality modes (Performance/Balanced/Ultra), automatic HiDPI adaptation, accurate text selection, and optional hardware acceleration toggle. The system will use a centralized `RenderPolicy` to compute scale factors with megapixel capping, plus platform-specific HW acceleration wiring for Windows (WebView2) and Linux (WebKitGTK).

## Technical Context

**Language/Version**: TypeScript 5.6.x (frontend), Rust 2021 edition (backend)
**Primary Dependencies**: React 18.3, pdfjs-dist 4.10, Zustand 5.x, Tauri 2.x
**Storage**: SQLite via tauri-plugin-sql (render settings persistence)
**Testing**: Vitest (frontend), cargo test (backend), Playwright (E2E visual regression)
**Target Platform**: Windows 10+, macOS 12+, Linux (WebKitGTK)
**Project Type**: Desktop (Tauri - frontend/backend hybrid)
**Performance Goals**: First page visible within 500ms, page navigation within 200ms, UI response within 100ms
**Constraints**: Memory capped at configurable megapixels (default 24MP), no render thrash on resize/zoom
**Scale/Scope**: Single-user desktop app, supporting PDFs up to hundreds of pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. Type Safety First | PASS | RenderSettings, RenderPlan, QualityMode will be typed with Zod schemas (frontend) and serde structs (backend). No `any` types in render pipeline. |
| II. Separation of Concerns | PASS | Rendering logic stays in frontend (pdf.js). Backend only persists settings. No UI logic in Rust. |
| III. Error Resilience | PASS | Canvas context failures handled gracefully with fallback. HW acceleration toggle provides recovery path. |
| IV. Test Coverage | PASS | Visual regression tests for quality modes. Unit tests for RenderPolicy calculations. Contract tests for settings persistence. |
| V. Performance Budget | PASS | Explicit performance targets in spec (500ms render, 200ms navigation). Megapixel cap prevents memory exhaustion. |
| VI. Accessibility | PASS | Text layer for screen readers preserved. High contrast mode compatibility maintained. |
| VII. Offline-First | PASS | All rendering local. No network dependencies for quality modes or HW acceleration. |
| VIII. Security Boundaries | PASS | No new permissions required. HW acceleration uses existing WebView capabilities. |

**Gate Result**: PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-pdf-render-quality/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── render-settings.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── rendering/
│       ├── RenderPolicy.ts          # NEW: Central render calculation logic
│       ├── QualityMode.ts           # NEW: Quality mode definitions
│       └── types.ts                 # NEW: RenderPlan, RenderSettings types
├── components/
│   ├── PdfViewer.tsx               # MODIFY: Use RenderPolicy
│   ├── pdf-viewer/
│   │   └── PdfPage.tsx             # MODIFY: Use RenderPolicy
│   └── settings/
│       ├── RenderSettings.tsx       # NEW: Quality mode UI
│       └── DebugOverlay.tsx         # NEW: Render diagnostics overlay
├── hooks/
│   └── useRenderSettings.ts         # NEW: Settings hook with persistence
├── stores/
│   └── render-store.ts              # NEW: Render settings state
└── services/
    └── pdf-service.ts               # MODIFY: Accept RenderPlan

src-tauri/
├── src/
│   ├── commands/
│   │   └── settings.rs              # MODIFY: Add render settings commands
│   └── domain/
│       └── settings.rs              # MODIFY: Add RenderSettings entity
└── tauri.conf.json                  # MODIFY: Add HW acceleration config (Windows)

tests/
├── unit/
│   └── rendering/
│       ├── RenderPolicy.test.ts     # NEW: Policy calculation tests
│       └── QualityMode.test.ts      # NEW: Mode scaling tests
├── integration/
│   └── render-settings.test.ts      # NEW: Settings persistence tests
└── visual/
    └── pdf-quality.spec.ts          # NEW: Screenshot comparison tests
```

**Structure Decision**: Extends existing hexagonal architecture. New `domain/rendering/` module for pure business logic (RenderPolicy). Settings flow through existing Tauri IPC pattern.

## Complexity Tracking

> No violations requiring justification.

| Item | Decision | Rationale |
|------|----------|-----------|
| Quality modes | 3 predefined modes | Simple user choice without overwhelming configuration |
| Megapixel cap | Single global value | Per-page caps add complexity without clear benefit |
| HW acceleration | Platform-specific implementation | Necessary due to WebView differences across platforms |

---

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Evidence |
|-----------|--------|----------------------|
| I. Type Safety First | PASS | Zod schemas defined in `contracts/render-settings.ts`. RenderSettings, RenderPlan, QualityMode fully typed. No `any` types. |
| II. Separation of Concerns | PASS | RenderPolicy in `domain/rendering/` (pure logic). UI in `components/settings/`. Backend only persists via Tauri IPC. |
| III. Error Resilience | PASS | Canvas context validation with graceful fallback. HW acceleration recovery flow documented. |
| IV. Test Coverage | PASS | Unit tests planned for RenderPolicy. Visual regression tests for quality modes. Integration tests for settings persistence. |
| V. Performance Budget | PASS | Megapixel capping (24 MP default) prevents memory exhaustion. Render debouncing (150ms) prevents thrash. |
| VI. Accessibility | PASS | TextLayer preserved for screen readers. High contrast mode unaffected by quality changes. |
| VII. Offline-First | PASS | All rendering local. Settings persisted to SQLite. No network dependencies. |
| VIII. Security Boundaries | PASS | No new Tauri capabilities required. HW acceleration uses existing WebView permissions. |

**Post-Design Gate Result**: PASS - Design adheres to all constitution principles.

---

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `research.md` | Technical decisions with rationale |
| Data Model | `data-model.md` | Entities, relationships, state transitions |
| Contracts | `contracts/render-settings.ts` | Zod schemas and TypeScript types |
| Quickstart | `quickstart.md` | Implementation guide and architecture overview |

---

## Next Steps

Run `/speckit.tasks` to generate detailed implementation tasks from this plan.
