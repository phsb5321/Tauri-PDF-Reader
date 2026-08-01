<!--
Sync Impact Report
==================
Version change: 1.0.0 → 2.0.0
Date: 2026-08-01

Why MAJOR: two principles asserted properties the repository does not have, and
a Constitution Check that passes against a false statement is not a check. Both
are restated to what is measurably true today, and one of them is a
NON-NEGOTIABLE — an incompatible redefinition under this document's own semver
rule.

Renamed:
  - "Tauri PDF Reader Constitution" → "Lectrice Constitution". The name has been
    settled since 30/05/2026; every /speckit.plan Constitution Check since then
    has run against a document that predates the project having a name.

Modified principles:
  - II. Type-Safe Tauri IPC (NON-NEGOTIABLE) → "Typed Tauri IPC, Ratcheted".
    The old text said all IPC MUST use generated bindings, then listed
    `src/lib/api/` wrappers as a compliant option — those wrappers call raw
    `invoke()` and are exempted from the ESLint ban at eslint.config.js:181-183,
    so the principle contradicted itself. Measured on 2026-08-01: 53 of 91
    registered commands are outside the typed surface
    (COMMANDS_OUTSIDE_THE_TYPED_SURFACE, src-tauri/tests/bindings_contract.rs).
    The principle now governs the ratchet that shrinks that number rather than
    describing a state the repo has never been in.
  - III. Test-First Development → coverage clause corrected. The old text said
    "80% lines, functions, branches, statements ... enforced in CI". The
    enforced floors are 62 / 67 / 90 / 62 (vitest.config.ts); 80 is the target
    recorded in docs/coverage-budget.md. A gate nobody can pass is a gate
    nobody reads.

Added sections:
  - VI. Verification Discipline (new principle)

Removed sections: N/A

Templates requiring updates:
  ✅ plan-template.md - "Constitution Check" section still aligns; the two
     corrected principles are now checkable rather than aspirational
  ✅ spec-template.md - unchanged, no principle-specific text
  ✅ tasks-template.md - unchanged
  ✅ agent-file-template.md - unchanged
  ✅ checklist-template.md - generic

Follow-up TODOs: None
-->

# Lectrice Constitution

Lectrice is a Tauri 2.x desktop PDF reader with text highlighting and native
text-to-speech. The name is French for a person employed to read aloud to
someone.

## Core Principles

### I. Hexagonal Architecture (Ports & Adapters)

All code MUST follow the hexagonal architecture pattern with strict layer boundaries:

- **Domain** (`src/domain/`, `src-tauri/src/domain/`): Pure business logic with zero external dependencies. Domain code MUST NOT import from adapters, infrastructure, or UI layers.
- **Ports** (`src/ports/`, `src-tauri/src/ports/`): Interface definitions only. Ports define contracts that adapters implement.
- **Adapters** (`src/adapters/`, `src-tauri/src/adapters/`): Implement port interfaces and depend on external systems (Tauri IPC, SQLite, filesystem).
- **Application** (`src/application/`, `src-tauri/src/application/`): Orchestrates domain logic through ports. May depend on domain and ports only.
- **UI** (`src/components/`, `src/hooks/`, `src/stores/`): Consumes application services. MUST NOT directly access adapters except through dependency injection.

**Rationale**: Enforced via ESLint boundaries plugin. Violations fail CI. This ensures testability, maintainability, and clear separation of concerns.

### II. Typed Tauri IPC, Ratcheted (NON-NEGOTIABLE)

Direct `invoke()` calls from `@tauri-apps/api/core` are FORBIDDEN in application
code. Components, hooks, stores and services MUST reach the backend through
`src/adapters/tauri/` or the generated bindings
(`import { commands } from '@/lib/bindings'`). ESLint `no-restricted-imports`
enforces this, and `src/lib/api/**` is the one exempted glob
(`eslint.config.js:181-183`) because that is where the remaining hand-written
wrappers live.

The typed surface is incomplete and is governed as a **ratchet**, not as a claim:

- Every command registered in `generate_handler!` MUST either be collected by
  `collect_commands!` or be listed, with a reason, in
  `COMMANDS_OUTSIDE_THE_TYPED_SURFACE`
  (`src-tauri/tests/bindings_contract.rs`). Adding a command to one macro alone
  fails the test that names it.
- `src/lib/bindings.ts` is generated (`cargo run --example
  regenerate_bindings`), never hand-edited, and asserted byte-for-byte against
  what specta emits.
- The exception list may only get **shorter**. Lengthening it requires a stated
  reason in the PR description. It was 63 entries when the gate landed
  (PR #64) and 53 after the session family migrated (PR #65).
- Every `#[tauri::command]` in `src-tauri/src/tauri_api/` MUST carry
  `#[specta::specta]`.

**Rationale**: the previous wording said all IPC was typed while most of it was
not, so the Constitution Check passed on a false statement and the real gap grew
unobserved. A number that must shrink is enforceable; an absolute that was never
true is not.

### III. Test-First Development

Testing discipline, with coverage held by a ratchet rather than a flat target:

- Frontend tests MUST be written for all domain logic, adapters, and critical UI flows
- Backend tests MUST use `--features test-mocks` for isolated testing
- Coverage floors are enforced in CI and are a **regression gate**, not an
  aspiration. The floors in `vitest.config.ts` are pinned just under the
  measured value and may only move **UP**; 80% across the board is the target,
  recorded with its ratchet history in `docs/coverage-budget.md`.
- Lowering a floor, deleting a test, or re-baselining a ratchet to reach green
  is FORBIDDEN. Excluding a path from the denominator is allowed only for code
  this repository does not write — generated or test-infrastructure files — and
  MUST be recorded in `docs/coverage-budget.md` with the measured before and
  after.
- Architecture boundary tests in `src/__tests__/architecture/` MUST pass

**Rationale**: the old text claimed an enforced 80% on all four metrics. The
enforced numbers were 62 / 67 / 90 / 62, so the stated gate had been failing
description for months while the real one did the work. A floor that describes
itself accurately can be ratcheted; one that does not gets ignored.

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

### VI. Verification Discipline

Every claim about behaviour MUST be proved by a runnable assertion, not by
inspection. Pixels and speakers are never the oracle — the state machine is.

- Climb the ladder until the user-visible claim is asserted by code:
  architecture/boundary test → state machine on a controlled clock → a
  deadlock-bounded Rust test that fails on hang → mockIPC headless E2E →
  `tauri-driver` real E2E (opt-in, env-gated).
- Any change to `src-tauri/src/ai_tts/player.rs`, or to a `!Send`/`!Sync`
  boundary, ships with a timeout-guarded test proving no lock is held across
  `sink.sleep_until_end()`.
- A slice ends with either a runnable assertion or a specific documented
  blocker. "Needs your eyes", "looks synced" and "should work" are not endings.
  The single legal human defer is subjective aesthetics, as a checklist of
  60 seconds or less.

**Rationale**: the failure this prevents is a slice that ships, claims victory,
and leaves the symptom unchanged. Written down here because it gates
`/speckit.implement` completion, not just review.

## Architecture Constraints

### Technology Stack

- **Frontend**: React 18.3+, TypeScript 5.6+, Vite, Zustand 5.x
- **Backend**: Rust 2021 edition, Tauri 2.x, SQLite via tauri-plugin-sql
- **Testing**: Vitest (frontend), Cargo test with test-mocks feature (backend)
- **Package Manager**: pnpm (required)

### Naming Conventions

| Element          | Convention      | Example                   |
| ---------------- | --------------- | ------------------------- |
| TS files         | kebab-case      | `document-repository.ts`  |
| React components | PascalCase      | `PageNavigation.tsx`      |
| Interfaces/Types | PascalCase      | `DocumentRepositoryPort`  |
| Functions        | camelCase       | `getDocumentById`         |
| Constants        | SCREAMING_SNAKE | `VALID_TRANSITIONS`       |
| Rust files       | snake_case      | `document_repository.rs`  |
| Rust structs     | PascalCase      | `Document`                |
| Tauri commands   | snake_case      | `library_add_document`    |
| Ports            | `*Port` suffix  | `DocumentRepositoryPort`  |
| Adapters         | `Tauri*` prefix | `TauriDocumentRepository` |

### Error Handling

- Frontend: Use `AppError` from `@/domain/errors` with kinds: `NotFound`, `Validation`, `Storage`, `Tts`, `FileSystem`
- Backend: Use `DomainError` enum. Tauri commands return `Result<T, String>` with format `ERROR_CODE: message`

## Development Workflow

### Resource-Conscious Development (CRITICAL)

**This machine runs multiple projects concurrently. ALWAYS minimize resource consumption.**

1. **NEVER run full test suites unless absolutely necessary** - Use targeted tests for changed files only
2. **NEVER run tests in parallel** - Sequential execution preserves system resources
3. **NEVER use watch modes** - Use single-run commands (`test:run` not `test`)
4. **NEVER run multiple heavy processes simultaneously** - Complete one before starting another
5. **ALWAYS prefer lightweight checks first** - Run in order: lint → typecheck → targeted tests
6. **ALWAYS close dev servers before running test suites** - Stop `pnpm tauri dev` first

### Verification Commands

```bash
# PREFERRED ORDER (lightweight first)
pnpm lint            # Step 1: ESLint including architecture boundaries
pnpm typecheck       # Step 2: TypeScript strict mode check

# Step 3: TARGETED tests only (prefer over full suite)
pnpm test -- src/path/to/changed-file.test.ts  # Single test file (PREFERRED)
cd src-tauri && cargo test specific_test_name --features test-mocks  # Single test (PREFERRED)

# Step 4: Full suite ONLY before final commit (resource intensive)
pnpm verify          # Full CI check (MUST pass before merge)
pnpm test:run        # All frontend tests - AVOID unless necessary
pnpm test:coverage   # Coverage with 80% threshold - AVOID unless necessary
cd src-tauri && cargo test --features test-mocks -j 1  # Backend tests, single thread
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

**Version**: 2.0.0 | **Ratified**: 2026-02-01 | **Last Amended**: 2026-08-01
