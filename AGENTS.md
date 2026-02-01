# AGENTS.md

Instructions for AI coding agents working in this Tauri PDF Reader codebase.

## Quick Reference

```bash
# Development
pnpm install                 # Install dependencies
pnpm tauri dev               # Start dev server + Tauri

# Verification (run before committing)
pnpm verify                  # All CI checks
pnpm lint                    # ESLint + architecture boundaries
pnpm typecheck               # TypeScript check

# Frontend tests
pnpm test:run                              # All tests (201+)
pnpm test -- src/path/to/file.test.ts      # Single test file
pnpm test -- -t "test name pattern"        # Tests matching pattern
pnpm test:coverage                         # Coverage (80% threshold)

# Backend tests
cd src-tauri && cargo test --features test-mocks           # All tests (177+)
cd src-tauri && cargo test test_name --features test-mocks # Single test
cd src-tauri && cargo clippy -- -D warnings                # Lint
cd src-tauri && cargo fmt --check                          # Format check
```

## Architecture: Hexagonal (Ports & Adapters)

```
UI (components, hooks) → Application → Domain ← Ports ← Adapters
```

**Dependency rules** (enforced by ESLint boundaries):
- **Domain** (`src/domain/`): Pure business logic, no external dependencies
- **Ports** (`src/ports/`): Interface definitions only
- **Adapters** (`src/adapters/`): Implement ports, depend on external systems
- **Application** (`src/application/`): Orchestrates domain + ports
- **UI** (`src/components/`): Consumes application services

### Critical: Tauri IPC Restriction

**Direct `invoke()` calls are forbidden.** Always use:
- Type-safe adapters in `src/adapters/tauri/`
- Generated bindings: `import { commands } from '@/lib/bindings'`
- API wrappers in `src/lib/api/`

```typescript
// WRONG - will fail lint
import { invoke } from '@tauri-apps/api/core';
await invoke('some_command');

// CORRECT
import { commands } from '@/lib/bindings';
await commands.someCommand();
```

## Code Style

### TypeScript

- **Strict mode**: `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- **Unused vars**: Prefix with `_` (e.g., `_unusedParam`)
- **Console**: Only `console.warn`, `console.error`, `console.debug` allowed
- **Prefer const**: Always use `const` over `let` when possible

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (TS) | kebab-case | `document-repository.ts` |
| Files (React) | PascalCase | `PageNavigation.tsx` |
| Interfaces/Types | PascalCase | `DocumentRepositoryPort` |
| Functions | camelCase | `getDocumentById` |
| Constants | SCREAMING_SNAKE | `VALID_TRANSITIONS` |
| Hooks | usePrefix | `useDocumentStore` |
| Stores | use*Store | `useAiTtsStore` |
| Test files | *.test.ts(x) | `highlights.test.ts` |
| Ports | *Port suffix | `DocumentRepositoryPort` |
| Adapters | Tauri* prefix | `TauriDocumentRepository` |

### Rust

- **Edition**: 2021
- **Clippy**: Warnings as errors (`-D warnings`)
- **Serde**: Use `#[serde(rename_all = "camelCase")]` for JSON
- **Commands**: snake_case (`library_add_document`)

| Type | Convention | Example |
|------|------------|---------|
| Files/Modules | snake_case | `document_repository.rs` |
| Structs/Enums | PascalCase | `Document`, `DomainError` |
| Functions | snake_case | `get_document_by_id` |
| Traits | PascalCase | `DocumentRepository` |
| Constants | SCREAMING_SNAKE | `DEFAULT_PAGE_SIZE` |

## Error Handling

### Frontend

```typescript
import { AppError } from '@/domain/errors';

// Throw domain errors
throw AppError.notFound('Document not found');
throw AppError.validation('Invalid page number');

// Error kinds: 'NotFound' | 'Validation' | 'Storage' | 'Tts' | 'FileSystem'
```

### Backend

```rust
use crate::domain::error::DomainError;

// Return Result with DomainError
fn get_doc(id: &str) -> Result<Document, DomainError> {
    Err(DomainError::NotFound(format!("Document {id} not found")))
}

// Tauri commands return Result<T, String>
// Error format: "ERROR_CODE: Human readable message"
```

## UI Design System

Use CSS tokens from `src/ui/tokens/`:

```css
background: var(--color-bg-toolbar);
padding: var(--space-4);           /* 16px */
font-size: var(--text-sm);
z-index: var(--z-modal);           /* 1000 */
transition: var(--transition-fast);
```

Reusable components in `src/ui/components/`: `Button`, `IconButton`, `Panel`, `EmptyState`, `ListRow`, `Toast`

## State Management (Zustand)

```typescript
// State machine pattern for complex state
const VALID_TRANSITIONS: Record<State, State[]> = {
  idle: ['loading'],
  loading: ['playing', 'error'],
  playing: ['paused', 'idle'],
  // ...
};

// Debug logging
console.debug('[StoreName] action:', oldState, '->', newState);

// Prevent stale closures in async callbacks
const pageRef = useRef(currentPage);
useEffect(() => { pageRef.current = currentPage; }, [currentPage]);
```

## Testing Patterns

### Frontend (Vitest)

```typescript
// Domain tests: pure unit tests
describe('mergeHighlights', () => {
  it('merges overlapping highlights', () => {
    expect(mergeHighlights(input)).toEqual(expected);
  });
});

// Component tests: mock adapters
vi.mock('@/adapters/tauri/document-repository.adapter');
```

### Backend (Cargo)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_add_document() {
        // Use test-mocks feature for isolated tests
    }
}
```

## Project Structure

```
src/                          # Frontend (React/TypeScript)
  adapters/tauri/             # Tauri IPC implementations
  application/                # Use cases
  components/                 # React components
  domain/                     # Pure business logic
  hooks/                      # React hooks
  lib/api/                    # API wrappers
  lib/bindings.ts             # Generated Tauri bindings
  ports/                      # Interface definitions
  stores/                     # Zustand stores
  ui/components/              # Reusable UI primitives
  ui/tokens/                  # CSS custom properties

src-tauri/src/                # Backend (Rust)
  adapters/                   # SQLite repos, audio cache
  application/                # Service implementations
  commands/                   # Thin Tauri command handlers
  domain/                     # Entities and business rules
  ports/                      # Repository traits
```

## Common Gotchas

1. **Tauri IPC**: Never import from `@tauri-apps/api/core` directly
2. **Architecture boundaries**: Domain layer cannot import from adapters
3. **Test mocks**: Backend tests require `--features test-mocks`
4. **Coverage**: 80% threshold enforced - add tests for new code
5. **Type generation**: Run `pnpm tauri dev` to regenerate bindings after Rust changes
6. **Z-index**: Always use tokens, never hardcode values
7. **Page targeting**: Use `data-page-number` attribute, not refs

## Active Technologies
- TypeScript 5.6+ (frontend), Rust 2021 edition (backend) + React 18.3+, Zustand 5.x, Tauri 2.x, tauri-specta, rodio, id3 (006-reading-session-audio-cache)
- SQLite via tauri-plugin-sql (metadata), filesystem (MP3 audio files) (006-reading-session-audio-cache)

## Recent Changes
- 006-reading-session-audio-cache: Added TypeScript 5.6+ (frontend), Rust 2021 edition (backend) + React 18.3+, Zustand 5.x, Tauri 2.x, tauri-specta, rodio, id3
