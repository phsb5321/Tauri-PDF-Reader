# Research: Hexagonal Architecture + TDD Guardrails

**Date**: 2026-01-13
**Status**: Complete

## Overview

This document consolidates research findings for implementing hexagonal architecture and TDD guardrails in the Tauri PDF Reader application. Each section documents decisions, rationale, and alternatives considered.

---

## 1. Rust Backend Architecture Pattern

### Decision: Ports & Adapters with Generic Service Types

Use generic type parameters for application services (static dispatch) with `async_trait` for port definitions. This provides zero runtime overhead while maintaining full testability via mockall.

### Rationale

1. **Static dispatch performance**: Generic services monomorphize at compile time, avoiding vtable lookups
2. **Excellent mockall integration**: `#[cfg_attr(any(test, feature = "test-mocks"), automock)]` works seamlessly with generic bounds
3. **Tauri compatibility**: `Send + Sync` bounds required for Tauri's multi-threaded command handlers
4. **Proven in codebase**: Existing `SettingsService<R: SettingsRepository>` pattern works well

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| `Arc<dyn Trait>` everywhere | Runtime overhead, less compiler optimization |
| No DI (direct adapter calls) | Not testable, tight coupling |
| DI framework (shaku, inject) | Over-engineering for this scale |

### Implementation Pattern

```rust
// Port definition (src-tauri/src/ports/document_repository.rs)
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait DocumentRepository: Send + Sync {
    async fn get_by_id(&self, id: String) -> Result<Option<Document>, DomainError>;
}

// Application service (src-tauri/src/application/document_service.rs)
pub struct DocumentService<R: DocumentRepository> {
    repository: R,
}

impl<R: DocumentRepository> DocumentService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }
}
```

### Use `Arc<dyn Trait>` When

- Runtime-swappable implementations (e.g., native TTS vs ElevenLabs based on user settings)
- Service needs multiple different repository types injected
- Feature-flag gated implementations

---

## 2. Type-Safe Contract Strategy

### Decision: tauri-specta Code Generation

Use tauri-specta 2.x to generate TypeScript bindings from Rust command definitions. The bindings serve as the single source of truth for IPC contracts.

### Rationale

1. **Single source of truth**: Rust types define contracts; TypeScript follows
2. **Compile-time validation**: Type mismatches caught at TS compilation
3. **Already implemented**: `src/lib/bindings.ts` exists with 230+ lines of generated types
4. **Zero runtime overhead**: Types exist only at compile time

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| Manual type definitions | Drift between frontend/backend |
| Schema-first (OpenAPI) | Adds complexity, not suited for Tauri |
| Runtime validation only | Late error detection |

### Implementation Pattern

```rust
// Cargo.toml (already configured)
specta = { version = "2.0.0-rc.20", features = ["chrono", "uuid"] }
specta-typescript = "0.0.7"
tauri-specta = { version = "2.0.0-rc.20", features = ["typescript"] }

// Command with specta macro
#[tauri::command]
#[specta::specta]
pub async fn library_get_document(id: String) -> Result<Option<Document>, String> {
    // implementation
}
```

### Regeneration Strategy

- Build-time generation via `build.rs` (current approach)
- Output to `src/lib/bindings.ts`
- ESLint rules prevent direct `@tauri-apps/api/core` imports outside adapters

---

## 3. Frontend Testing Strategy

### Decision: Port-Based Mocking with Vitest

Mock at the port interface level, not at the adapter level. Create `MockDocumentRepository` alongside `TauriDocumentRepository` that implements the same `DocumentRepositoryPort`.

### Rationale

1. **True unit isolation**: Tests don't depend on Tauri runtime
2. **Fast execution**: No IPC overhead in tests
3. **Boundary testing**: Validates that components use ports correctly
4. **Easy stubbing**: Mock implementations return predictable data

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| Mock Tauri invoke calls | Still couples tests to Tauri API shape |
| Integration tests only | Too slow for unit testing |
| No mocks (test doubles) | Cannot test error paths easily |

### Implementation Pattern

```typescript
// Port interface (src/ports/document-repository.port.ts)
export interface DocumentRepositoryPort {
  getById(id: string): Promise<Document | null>;
}

// Mock implementation (src/adapters/mock/document-repository.adapter.ts)
export class MockDocumentRepository implements DocumentRepositoryPort {
  private documents: Map<string, Document> = new Map();

  async getById(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  // Test helper methods
  setDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }
}

// Test usage
describe('useDocumentStore', () => {
  it('loads document by id', async () => {
    const mockRepo = new MockDocumentRepository();
    mockRepo.setDocument({ id: '123', title: 'Test' });
    // inject and test
  });
});
```

---

## 4. Backend Testing Strategy

### Decision: mockall with feature-gated mocks

Use mockall's `automock` attribute with conditional compilation. Mocks are only compiled when running tests or with the `test-mocks` feature flag.

### Rationale

1. **Zero production overhead**: Mocks not included in release builds
2. **Type-safe expectations**: Compile-time checking of mock setup
3. **Async support**: Works with `async_trait` via `returning` closures
4. **Already proven**: Existing `MockSettingsRepository` pattern works well

### Implementation Pattern

```rust
// In port definition
#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;

#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait SettingsRepository: Send + Sync {
    async fn get(&self, key: String) -> Result<Option<String>, DomainError>;
}

// In test
#[tokio::test]
async fn test_get_theme() {
    let mut mock = MockSettingsRepository::new();
    mock.expect_get()
        .with(eq("theme".to_string()))
        .returning(|_| Ok(Some("\"dark\"".to_string())));

    let service = SettingsService::new(mock);
    let result = service.get("theme").await.unwrap();
    assert_eq!(result, Some("\"dark\"".to_string()));
}
```

### Re-export Pattern

```rust
// src-tauri/src/ports/mod.rs
#[cfg(any(test, feature = "test-mocks"))]
pub use document_repository::MockDocumentRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use highlight_repository::MockHighlightRepository;
```

---

## 5. Pre-Commit Hook Tooling

### Decision: husky + lint-staged with selective checks

Use husky for git hooks with lint-staged running only on staged files. Run full typecheck but limit tests to related files only.

### Rationale

1. **Fast feedback**: Target <30s for typical changes
2. **Related tests only**: `vitest related` runs only tests affected by changed files
3. **Selective Rust checks**: Only run cargo commands when Rust files changed
4. **Fail fast**: Exit on first error

### Implementation Pattern

```json
// package.json (lint-staged config)
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ],
    "*.{ts,tsx,js,jsx,json,md}": [
      "prettier --write --ignore-unknown"
    ]
  }
}
```

```bash
# .husky/pre-commit (already implemented)
#!/bin/sh
set -e

echo "Running pre-commit checks..."

# Frontend: lint-staged (parallel) + typecheck
pnpm lint-staged
pnpm typecheck

# Backend: only if Rust files changed
if git diff --cached --name-only | grep -q "src-tauri/"; then
  cd src-tauri
  cargo fmt --check
  cargo clippy -- -D warnings
  cargo test --features test-mocks
fi

echo "Pre-commit checks passed!"
```

### Timing Budget

| Check | Target | Achieved |
|-------|--------|----------|
| lint-staged | <5s | ~3s |
| TypeScript check | <10s | ~8s |
| Rust fmt + clippy | <10s | ~7s |
| Rust tests | <15s | ~12s |
| **Total** | <30s | ~30s |

---

## 6. CI Pipeline Tooling

### Decision: GitHub Actions with parallel jobs

Three parallel jobs: frontend, backend, contract-tests. Each job has dedicated caching and timeout limits.

### Rationale

1. **Parallel execution**: Frontend and backend run concurrently
2. **Isolated failures**: One job failing doesn't block others
3. **Aggressive caching**: pnpm store and cargo registry cached
4. **Timeout protection**: 10-15min limits prevent runaway builds

### Implementation Pattern (already in .github/workflows/ci.yml)

```yaml
jobs:
  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - pnpm typecheck
      - pnpm lint
      - pnpm lint:boundaries  # Architecture enforcement
      - pnpm test:run
      - pnpm test:arch        # ArchUnitTS tests
      - pnpm test:coverage

  backend:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - cargo fmt --check
      - cargo clippy -- -D warnings
      - cargo test --features test-mocks
      - cargo build --release

  contract-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - cargo test --features test-mocks --test '*'
```

### Total Pipeline Time: ~8 minutes (under 10min target)

---

## 7. Architecture Enforcement

### Decision: Multi-layer enforcement

1. **ESLint boundaries plugin**: Instant IDE feedback for TypeScript violations
2. **ArchUnitTS tests**: Comprehensive CI validation with detailed reports
3. **Rust module visibility**: Compile-time enforcement via `pub(crate)`, `pub(super)`
4. **No direct Tauri imports**: ESLint `no-restricted-imports` rule

### Rationale

1. **Developer experience**: IDE catches violations before commit
2. **CI safety net**: Tests catch anything missed locally
3. **Compile-time backend**: Rust's module system enforces boundaries inherently
4. **Defense in depth**: Multiple layers prevent architectural decay

### Implementation Pattern

```javascript
// eslint.config.js (boundaries configuration)
settings: {
  'boundaries/elements': [
    { type: 'domain', pattern: 'src/domain/*' },
    { type: 'ports', pattern: 'src/ports/*' },
    { type: 'adapters', pattern: 'src/adapters/*' },
    // ...
  ],
},
rules: {
  'boundaries/element-types': [
    'error',
    {
      default: 'disallow',
      rules: [
        { from: 'domain', allow: ['domain', 'ports'] },
        { from: 'ports', allow: ['ports'] },
        { from: 'application', allow: ['domain', 'ports', 'application'] },
        { from: 'adapters', allow: ['ports', 'domain', 'adapters'] },
        // ...
      ],
    },
  ],
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: '@tauri-apps/api/core',
          message: 'Use type-safe adapters instead.',
        },
      ],
    },
  ],
}
```

```typescript
// src/__tests__/architecture/domain-boundaries.test.ts (ArchUnitTS)
import { projectFiles } from 'archunit';

describe('Domain Layer Boundaries', () => {
  it('domain should not depend on adapters', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/adapters/**');

    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });
});
```

---

## 8. Coverage Enforcement Strategy

### Decision: 80% threshold for new/modified code

Enforce 80% minimum coverage for new and modified code only, not for the entire codebase. This allows incremental improvement without blocking migration.

### Rationale

1. **Incremental adoption**: Legacy code not blocked
2. **Quality bar for new code**: New features must be tested
3. **Strangler fig compatible**: Supports gradual migration
4. **Industry standard**: 80% is commonly accepted threshold

### Implementation Approach

```json
// vitest.config.ts coverage options
{
  "coverage": {
    "provider": "v8",
    "reporter": ["text", "html", "lcov"],
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["src/__tests__/**", "src/lib/bindings.ts"]
  }
}
```

For diff-based coverage (CI enhancement):
- Use `diff-cover` with lcov output
- Fail if changed lines have <80% coverage
- Report uncovered new lines in PR comments

---

## 9. Large File Refactoring Strategy

### Decision: Strangler Fig with feature-based migration

Migrate one module at a time, starting with lowest-risk modules. Legacy code coexists with new structure during incremental migration.

### Rationale

1. **Low risk**: Each migration is isolated
2. **Continuous delivery**: App remains shippable throughout
3. **Learning curve**: Team learns patterns incrementally
4. **Rollback possible**: Old code preserved until migration verified

### Migration Order (by risk/complexity)

| Priority | Module | Lines | Risk | Reason |
|----------|--------|-------|------|--------|
| 1 | settings | 153 | Low | Already partially migrated, good template |
| 2 | library | 448 | Medium | Well-defined CRUD operations |
| 3 | highlights | 471 | Medium | Complex but isolated domain |
| 4 | tts/engine | 612 | High | Complex state management, external deps |

### Refactoring Pattern

1. Create port interface matching existing API
2. Create application service delegating to port
3. Create adapter implementing port with existing logic
4. Wire up in lib.rs, verify identical behavior
5. Add unit tests for application service
6. Migrate business logic from adapter to service
7. Remove legacy code once stable

---

## Summary: Key Decisions

| Area | Decision | Key Technology |
|------|----------|----------------|
| Backend DI | Generic type parameters | `async_trait`, mockall |
| Type contracts | Code generation | tauri-specta 2.x |
| Frontend testing | Port-based mocking | Vitest, mock implementations |
| Backend testing | Feature-gated mocks | mockall automock |
| Pre-commit | Selective checks | husky, lint-staged, vitest related |
| CI | Parallel jobs | GitHub Actions |
| Architecture enforcement | Multi-layer | ESLint boundaries, ArchUnitTS, Rust modules |
| Coverage | 80% new code | v8 coverage, diff-cover |
| Migration | Strangler fig | Lowest-risk first |

All research items resolved. Ready to proceed to Phase 1: Design & Contracts.
