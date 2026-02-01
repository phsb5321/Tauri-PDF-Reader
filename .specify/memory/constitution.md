<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0 (initial constitution)
Modified principles: N/A (new document)
Added sections:
  - Core Principles (5 principles)
  - Architecture Constraints
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  ✅ plan-template.md - "Constitution Check" section exists, aligns with principles
  ✅ spec-template.md - User stories/requirements format aligns with Test-First principle
  ✅ tasks-template.md - Test tasks and phase structure align with principles
  ✅ agent-file-template.md - Code style section aligns with naming/style principles
  ✅ checklist-template.md - Generic, no constitution-specific updates needed
Follow-up TODOs: None
-->

# Tauri PDF Reader Constitution

## Core Principles

### I. Hexagonal Architecture (Ports & Adapters)

All code MUST follow the hexagonal architecture pattern with strict layer boundaries:

- **Domain** (`src/domain/`, `src-tauri/src/domain/`): Pure business logic with zero external dependencies. Domain code MUST NOT import from adapters, infrastructure, or UI layers.
- **Ports** (`src/ports/`, `src-tauri/src/ports/`): Interface definitions only. Ports define contracts that adapters implement.
- **Adapters** (`src/adapters/`, `src-tauri/src/adapters/`): Implement port interfaces and depend on external systems (Tauri IPC, SQLite, filesystem).
- **Application** (`src/application/`, `src-tauri/src/application/`): Orchestrates domain logic through ports. May depend on domain and ports only.
- **UI** (`src/components/`, `src/hooks/`, `src/stores/`): Consumes application services. MUST NOT directly access adapters except through dependency injection.

**Rationale**: Enforced via ESLint boundaries plugin. Violations fail CI. This ensures testability, maintainability, and clear separation of concerns.

### II. Type-Safe Tauri IPC (NON-NEGOTIABLE)

Direct `invoke()` calls from `@tauri-apps/api/core` are FORBIDDEN in application code.

All Tauri IPC MUST use one of:
- Type-safe adapters in `src/adapters/tauri/`
- Generated bindings: `import { commands } from '@/lib/bindings'`
- API wrappers in `src/lib/api/`

**Rationale**: Type safety prevents runtime errors from IPC contract mismatches. The `tauri-specta` bindings provide compile-time guarantees. ESLint `no-restricted-imports` enforces this rule.

### III. Test-First Development

Testing discipline with 80% coverage threshold:

- Frontend tests MUST be written for all domain logic, adapters, and critical UI flows
- Backend tests MUST use `--features test-mocks` for isolated testing
- Coverage thresholds (80% lines, functions, branches, statements) are enforced in CI
- Architecture boundary tests in `src/__tests__/architecture/` MUST pass

**Rationale**: High test coverage ensures refactoring safety and documents expected behavior. The 80% threshold balances coverage with development velocity.

### IV. Design System Consistency

All UI code MUST use CSS tokens from `src/ui/tokens/`:

- Colors: `var(--color-bg-*)`, `var(--color-text-*)`, `var(--color-border)`
- Spacing: `var(--space-1)` through `var(--space-8)` (4px base)
- Typography: `var(--text-xs)` through `var(--text-xl)`
- Z-index: `var(--z-base)` through `var(--z-toast)` - hardcoded z-index values are FORBIDDEN
- Motion: `var(--transition-fast)`, `var(--transition-normal)`

Reusable components from `src/ui/components/` MUST be used instead of creating duplicates.

**Rationale**: Consistent design tokens ensure visual coherence and simplify theming. Z-index tokens prevent layering conflicts.

### V. State Management Patterns

Zustand stores MUST follow established patterns:

- Complex state MUST use state machine pattern with `VALID_TRANSITIONS` map
- All state transitions MUST be logged via `console.debug('[StoreName] action:', ...)`
- Async callbacks MUST use refs to prevent stale closure bugs
- Stores MUST be named `use<Name>Store` (e.g., `useAiTtsStore`)

**Rationale**: State machines make complex flows predictable and debuggable. Debug logging aids troubleshooting. Ref pattern prevents common React closure bugs.

## Architecture Constraints

### Technology Stack

- **Frontend**: React 18.3+, TypeScript 5.6+, Vite, Zustand 5.x
- **Backend**: Rust 2021 edition, Tauri 2.x, SQLite via tauri-plugin-sql
- **Testing**: Vitest (frontend), Cargo test with test-mocks feature (backend)
- **Package Manager**: pnpm (required)

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| TS files | kebab-case | `document-repository.ts` |
| React components | PascalCase | `PageNavigation.tsx` |
| Interfaces/Types | PascalCase | `DocumentRepositoryPort` |
| Functions | camelCase | `getDocumentById` |
| Constants | SCREAMING_SNAKE | `VALID_TRANSITIONS` |
| Rust files | snake_case | `document_repository.rs` |
| Rust structs | PascalCase | `Document` |
| Tauri commands | snake_case | `library_add_document` |
| Ports | `*Port` suffix | `DocumentRepositoryPort` |
| Adapters | `Tauri*` prefix | `TauriDocumentRepository` |

### Error Handling

- Frontend: Use `AppError` from `@/domain/errors` with kinds: `NotFound`, `Validation`, `Storage`, `Tts`, `FileSystem`
- Backend: Use `DomainError` enum. Tauri commands return `Result<T, String>` with format `ERROR_CODE: message`

## Development Workflow

### Verification Commands

```bash
pnpm verify          # Full CI check (MUST pass before merge)
pnpm lint            # ESLint including architecture boundaries
pnpm typecheck       # TypeScript strict mode check
pnpm test:run        # All frontend tests
pnpm test:coverage   # Coverage with 80% threshold
cd src-tauri && cargo test --features test-mocks  # Backend tests
cd src-tauri && cargo clippy -- -D warnings       # Rust linting
```

### Code Review Requirements

- All PRs MUST pass `pnpm verify`
- Architecture boundary violations MUST be resolved, not suppressed
- New features MUST include tests meeting coverage threshold
- Tauri command changes MUST regenerate bindings (`pnpm tauri dev`)

## Governance

This constitution supersedes all other development practices in this repository.

### Amendment Process

1. Propose amendment with rationale in PR description
2. Update constitution version following semver:
   - MAJOR: Principle removal or incompatible redefinition
   - MINOR: New principle or material expansion
   - PATCH: Clarifications and wording improvements
3. Update `LAST_AMENDED_DATE` to change date
4. Propagate changes to dependent templates if affected

### Compliance

- All PRs and code reviews MUST verify compliance with these principles
- Complexity beyond these constraints MUST be justified in PR description
- Use `AGENTS.md` for runtime development guidance and quick reference

**Version**: 1.0.0 | **Ratified**: 2026-02-01 | **Last Amended**: 2026-02-01
