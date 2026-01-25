# Architecture Documentation

This document describes the hexagonal architecture patterns used in this Tauri PDF Reader application.

## Overview

The codebase follows **Hexagonal Architecture** (also known as Ports & Adapters pattern) to achieve:
- **Testability**: Domain logic can be tested without I/O
- **Maintainability**: Clear boundaries between layers
- **Flexibility**: Easy to swap adapters (e.g., different databases)

## Layer Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         UI Layer                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │   Components   │  │     Hooks       │  │     Stores       │   │
│  │ (PDF Viewer,   │  │ (useAiTts,      │  │ (document-store, │   │
│  │  Settings)     │  │  useHighlights) │  │  settings-store) │   │
│  └───────┬────────┘  └────────┬────────┘  └────────┬─────────┘   │
│          │                    │                     │             │
│          └────────────────────┼─────────────────────┘             │
│                               ▼                                   │
├──────────────────────────────────────────────────────────────────┤
│                     Application Layer                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Use cases, service orchestration                          │  │
│  │  src/application/ (frontend), src-tauri/src/application/   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                   │
│                               ▼                                   │
├──────────────────────────────────────────────────────────────────┤
│                       Domain Layer                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │    Highlight    │  │       TTS        │  │    Document     │  │
│  │  merge logic,   │  │  text chunking,  │  │  validation,    │  │
│  │  validation     │  │  state machine   │  │  hash compute   │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘  │
│                               │                                   │
│                               ▼                                   │
├──────────────────────────────────────────────────────────────────┤
│                      Ports (Interfaces)                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ HighlightRepo   │  │   TtsEngine      │  │  DocumentRepo   │  │
│  │   (trait)       │  │    (trait)       │  │    (trait)      │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘  │
│                               │                                   │
│                               ▼                                   │
├──────────────────────────────────────────────────────────────────┤
│                   Adapters (Infrastructure)                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   SQLite Repos  │  │   Native TTS     │  │   Tauri IPC     │  │
│  │  (sqlx-based)   │  │  (tts crate)     │  │  (invoke API)   │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Dependency Rules

The fundamental rule of hexagonal architecture is that **dependencies point inward**:

```
UI → Application → Domain ← Ports ← Adapters
         ↓            ↑
         └────────────┘
```

1. **Domain Layer** - Has NO external dependencies. Pure business logic.
2. **Ports Layer** - Defines interfaces that the domain needs (repository traits).
3. **Adapters Layer** - Implements ports, depends on external libraries (sqlx, tts crate).
4. **Application Layer** - Orchestrates domain logic through ports.
5. **UI Layer** - Consumes application services, renders views.

## Directory Structure

### Frontend (TypeScript)

```
src/
├── components/          # UI Layer - React components
├── hooks/               # UI Layer - React hooks (UI state only)
├── stores/              # UI Layer - Zustand stores
├── application/         # Application Layer - Use cases
├── domain/              # Domain Layer - Business logic
│   ├── highlight/       # Highlight merging, validation
│   └── tts/             # Text chunking, state machine
├── ports/               # Ports - Repository interfaces
├── adapters/            # Adapters - Tauri IPC implementations
└── lib/
    ├── api/             # Type-safe Tauri command wrappers
    └── bindings.ts      # Generated types from tauri-specta
```

### Backend (Rust)

```
src-tauri/src/
├── commands/            # Thin command handlers (Tauri entry points)
│   ├── highlights/      # Highlight CRUD commands
│   ├── library/         # Document library commands
│   ├── settings.rs      # Settings commands
│   └── tts.rs           # TTS commands
├── application/         # Application Layer - Services
│   ├── highlight_service.rs
│   ├── library_service.rs
│   ├── settings_service.rs
│   └── tts_service.rs
├── domain/              # Domain Layer - Pure business logic
│   ├── highlight/       # Highlight entity, merging
│   ├── document/        # Document entity, validation
│   ├── settings/        # Settings validation
│   └── tts/             # Text chunking logic
├── ports/               # Ports - Repository traits
├── adapters/            # Adapters - Implementations
│   ├── sqlite/          # SQLite repositories
│   └── native_tts/      # Native TTS adapter
├── tts/                 # TTS engine wrapper
│   ├── engine.rs        # TtsEngine struct
│   ├── types.rs         # TTS types
│   └── chunking.rs      # Text chunking
└── db/                  # Database schema and models
```

## Testing Strategy

### Domain Tests
- **Location**: `src/domain/**/__tests__/`, `src-tauri/src/domain/**/mod.rs` (inline)
- **Characteristics**: Pure unit tests, no mocks needed, run in <1ms each
- **Examples**: Text chunking edge cases, highlight merge logic

### Application Tests
- **Location**: `src-tauri/src/application/*.rs` (inline test modules)
- **Characteristics**: Use mock ports, verify orchestration logic
- **Coverage**: 80%+ for new/modified code

### Contract Tests
- **Location**: `src/__tests__/contracts/`, `src-tauri/tests/`
- **Purpose**: Verify adapters implement ports correctly

### Architecture Tests
- **Location**: `src/__tests__/architecture/`
- **Purpose**: Enforce layer boundaries (no domain → adapter imports)

## Common Patterns

### Adding a New Feature

1. **Define domain logic** in `domain/` - pure functions, no I/O
2. **Define port interface** in `ports/` if new I/O needed
3. **Implement adapter** in `adapters/` for the port
4. **Create application service** in `application/` to orchestrate
5. **Wire up in UI** - hooks/components consume application services

### Example: Adding New Highlight Color

```typescript
// 1. Domain - src/domain/highlight/colors.ts
export const VALID_COLORS = ['#FFFF00', '#00FF00', '#FF00FF', '#00FFFF'];
export function isValidColor(color: string): boolean { ... }

// 2. Application service uses domain validation
// 3. UI hook uses application service
// 4. No port/adapter needed (color is just data)
```

### Example: Adding Export Format

```rust
// 1. Domain - define export format logic
// src-tauri/src/domain/export/mod.rs
pub fn format_as_csv(highlights: &[Highlight]) -> String { ... }

// 2. Application service orchestrates
// src-tauri/src/application/export_service.rs
pub fn export_highlights(format: ExportFormat) -> Result<String> { ... }

// 3. Command handler delegates (thin)
// src-tauri/src/commands/export.rs
#[tauri::command]
pub async fn export_highlights(format: String) -> Result<String> {
    export_service.export(format.parse()?)
}
```

## Performance Considerations

- **Domain tests**: Target <100ms for entire domain test suite
- **Lazy loading**: Adapters initialized only when needed
- **Event-driven**: TTS uses events for chunk progress (non-blocking)

## Security Boundaries

- **Tauri CSP**: Configured in `tauri.conf.json`
- **Input validation**: Domain layer validates all inputs
- **SQL injection**: Parameterized queries in SQLite adapters
