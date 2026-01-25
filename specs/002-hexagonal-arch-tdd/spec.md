# Feature Specification: Hexagonal Architecture + TDD Guardrails

**Feature Branch**: `002-hexagonal-arch-tdd`
**Created**: 2026-01-13
**Status**: Draft
**Input**: User description: "Tauri: Hexagonal Frontend + Robust Rust Backend Architecture + TDD Guardrails"

## Clarifications

### Session 2026-01-13

- Q: What migration strategy for refactoring legacy code to hexagonal architecture? → A: Strangler Fig - migrate one module at a time, starting with lowest-risk (e.g., settings commands)
- Q: What test coverage threshold should be enforced? → A: 80% minimum coverage for new/modified code, enforced by pre-commit
- Q: What is the target duration for the full CI pipeline? → A: Under 10 minutes (prioritize thorough testing over speed)
- Q: How should architectural violations be detected? → A: Both static analysis (ESLint boundary plugins for TS, Rust module visibility) + architecture tests (ArchUnitTS) for comprehensive validation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Adds New Feature Without Breaking Existing Code (Priority: P1)

A developer wants to add a new capability to the PDF reader (e.g., a new export format or annotation type). With the current architecture, they must understand multiple large files and risk introducing regressions. After the hexagonal refactor, they can implement changes in isolated modules with clear boundaries.

**Why this priority**: This is the primary value proposition of hexagonal architecture - enabling safe, incremental development. Without this, every change carries high risk and cognitive overhead.

**Independent Test**: Can be tested by having a developer add a simple new feature (e.g., new highlight color option) and verifying they only need to modify domain and adapter layers without touching unrelated code. Success is measured by the change being confined to expected modules.

**Acceptance Scenarios**:

1. **Given** a developer needs to add a new document export format, **When** they implement it following the hexagonal structure, **Then** changes are isolated to the domain layer (export logic) and one adapter (file system), without modifying UI components or other adapters.
2. **Given** a developer modifies TTS functionality, **When** they make changes to the TTS port implementation, **Then** the PDF viewer and library components remain unaffected and their tests continue to pass.
3. **Given** a new Tauri command is needed, **When** the developer implements it, **Then** they create a thin command handler that delegates to an application service, with no business logic in the command handler itself.

---

### User Story 2 - Developer Runs Tests with Confidence Before Committing (Priority: P1)

A developer makes changes and wants to verify nothing is broken before pushing. The pre-commit hooks and CI pipeline catch issues early, preventing broken code from reaching the main branch.

**Why this priority**: TDD guardrails are the safety net that enables confident refactoring. Without automated quality gates, architectural rules decay over time.

**Independent Test**: Can be tested by intentionally introducing a bug, type error, or lint violation and verifying the pre-commit hook or CI catches it before the code can be merged.

**Acceptance Scenarios**:

1. **Given** a developer has uncommitted changes with a type error, **When** they attempt to commit, **Then** the pre-commit hook fails with a clear error message indicating the issue.
2. **Given** a developer pushes code that passes local checks, **When** CI runs the full test suite, **Then** any integration test failures are reported with actionable feedback.
3. **Given** a developer adds new functionality without tests, **When** they attempt to commit, **Then** the pre-commit hook fails if coverage for new/modified code falls below 80%.

---

### User Story 3 - Developer Writes Type-Safe Frontend-Backend Communication (Priority: P2)

A developer needs to call a Rust command from the frontend. Instead of guessing parameter names and types, they use the typed command client that provides autocomplete and compile-time validation.

**Why this priority**: Type-safe contracts prevent a major class of runtime bugs and improve developer productivity. This builds on the hexagonal foundation.

**Independent Test**: Can be tested by attempting to call a command with wrong parameter types and verifying TypeScript compilation fails, or by checking autocomplete suggestions in an IDE.

**Acceptance Scenarios**:

1. **Given** a developer writes frontend code to call `library_add_document`, **When** they import the typed command client, **Then** they get autocomplete for parameter names and TypeScript errors for type mismatches.
2. **Given** a developer calls a command with an incorrect parameter type, **When** they run the TypeScript compiler, **Then** compilation fails with a clear error indicating the type mismatch.
3. **Given** a new command is added to the Rust backend, **When** the types are regenerated, **Then** the frontend command client includes the new command with full type information.

---

### User Story 4 - Developer Tests Business Logic in Isolation (Priority: P2)

A developer wants to test PDF text extraction logic without starting the full Tauri application. With isolated domain logic and mock adapters, they can run fast unit tests.

**Why this priority**: Fast, isolated tests are the foundation of TDD. Slow integration tests discourage frequent testing and rapid iteration.

**Independent Test**: Can be tested by running domain unit tests with mock adapters and verifying they complete in under 1 second without any external dependencies.

**Acceptance Scenarios**:

1. **Given** a developer wants to test highlight merging logic, **When** they run unit tests for the domain layer, **Then** tests execute without database connections, file system access, or Tauri runtime.
2. **Given** a developer writes a new application service, **When** they create tests using mock ports, **Then** they can verify all business logic paths without real adapters.
3. **Given** a Rust domain function has complex business rules, **When** unit tests are run, **Then** edge cases are verified in under 100ms each using in-memory test doubles.

---

### User Story 5 - Maintainer Reviews Large File Refactor (Priority: P3)

A maintainer reviews a PR that splits a large file (e.g., 580-line `tts/engine.rs` or 397-line `tauri-invoke.ts`) into smaller, focused modules. The refactor maintains identical behavior while improving maintainability.

**Why this priority**: Large file refactoring is the concrete output of applying hexagonal principles. It depends on having the architecture and tests in place first.

**Independent Test**: Can be tested by running the full test suite before and after the refactor, verifying all tests pass and the application behavior is unchanged.

**Acceptance Scenarios**:

1. **Given** the `tts/engine.rs` file (580 lines) exists, **When** it is refactored into domain/application/adapter layers, **Then** no single resulting module exceeds 200 lines and all existing TTS functionality works identically.
2. **Given** the `commands/highlights.rs` file (465 lines) contains business logic, **When** it is refactored, **Then** command handlers contain only request parsing, delegation to services, and response mapping.
3. **Given** frontend files like `useAiTts.ts` (227 lines) mix concerns, **When** refactored to hexagonal structure, **Then** domain logic is testable without React hooks or Tauri runtime.

---

### Edge Cases

- What happens when a developer violates layering rules (e.g., domain importing from adapters)?
  - Two-layer enforcement: (1) ESLint boundary plugins provide instant IDE feedback for TypeScript violations; (2) ArchUnitTS architecture tests catch violations in CI with comprehensive reporting. Rust module visibility (`pub(crate)`, `pub(super)`) enforces backend boundaries at compile time.
- How does the system handle existing code that doesn't fit the hexagonal model?
  - Strangler Fig pattern: migrate one module at a time, starting with lowest-risk modules (e.g., settings commands). Legacy code coexists with new structure during incremental migration.
- What happens when contract types change between frontend and backend?
  - The type generation or validation process should fail fast with clear indication of the breaking change.
- How are circular dependencies between modules prevented?
  - The dependency injection pattern and unidirectional dependency flow (domain <- application <- adapters) inherently prevent cycles.
- How are feature-gated Rust commands (e.g., `native-tts`) handled in type generation?
  - Feature-gated commands are excluded from tauri-specta type generation until the feature is stabilized. During migration, these commands use legacy invoke patterns with documented ESLint exceptions. Resolution path: migrate to v2 hexagonal API or enable feature by default.

## Requirements *(mandatory)*

### Functional Requirements

**Phase 0: Baseline Establishment**

- **FR-001**: System MUST provide an inventory of all Tauri commands, their parameters, return types, and associated DTOs.
- **FR-002**: System MUST document the current build/test baseline including all passing and failing tests, lint violations, and type errors.
- **FR-003**: System MUST identify the top 10 largest files by line count in both frontend and backend codebases.

**Phase 1: Research & Decision Documentation**

- **FR-004**: System MUST document the chosen Rust backend architecture pattern with rationale and alternatives considered.
- **FR-005**: System MUST document the type-safe contract strategy (generation, validation, or schema-first) with implementation details.
- **FR-006**: System MUST document the testing strategy for domain, application, and adapter layers in both frontend and backend.
- **FR-007**: System MUST document the pre-commit and CI enforcement tooling choices.

**Phase 2: Architecture Definition**

- **FR-008**: Frontend MUST be organized into distinct layers: domain, application, ports, adapters, and UI.
- **FR-009**: Frontend domain layer MUST NOT import from UI or adapter layers.
- **FR-010**: Frontend ports MUST be defined as TypeScript interfaces owned by the core layers.
- **FR-011**: Rust backend MUST be organized into distinct layers: domain, application, ports, adapters, and tauri_api.
- **FR-012**: Rust tauri_api layer MUST contain only command handlers that delegate to application services.
- **FR-013**: Rust ports MUST be defined as traits that enable dependency injection and testability.

**Phase 3: Type-Safe Contracts**

- **FR-014**: System MUST provide a single source of truth for command contracts (DTOs shared between frontend and backend).
- **FR-015**: Frontend MUST have a typed command client that wraps all Tauri invoke calls.
- **FR-016**: System MUST NOT allow raw `invoke("string", {...})` calls outside the command client adapter.
- **FR-017**: System MUST validate inputs at the boundary (frontend before invoke, backend in command handlers).

**Phase 4: Large File Refactoring**

- **FR-018**: System MUST refactor identified large files into modules with clear single responsibilities.
- **FR-019**: Each refactored module MUST have corresponding unit tests.
- **FR-020**: Refactoring MUST NOT change observable application behavior (verified by existing and new tests).

**Phase 5: TDD Guardrails**

- **FR-021**: System MUST provide pre-commit hooks that run formatters, linters, and type checks.
- **FR-022**: System MUST provide pre-commit hooks that run affected unit tests and enforce 80% minimum coverage for new/modified code.
- **FR-023**: CI pipeline MUST run the complete test suite including integration and contract tests.
- **FR-024**: System MUST provide a verification script that runs all checks locally.
- **FR-025**: System MUST enforce architectural boundaries via ESLint boundary plugins (frontend) and Rust module visibility (backend), with ArchUnitTS architecture tests in CI for comprehensive validation.

### Key Entities

- **Port**: An interface/trait defining a capability needed by domain/application logic (e.g., `StoragePort`, `TtsPort`, `CommandBusPort`).
- **Adapter**: A concrete implementation of a Port for a specific runtime (e.g., `TauriStorageAdapter`, `MockStorageAdapter`).
- **Command Contract**: The type definition for request/response of a Tauri command, shared between frontend and backend.
- **Application Service**: A use-case orchestrator that coordinates domain logic and ports without framework dependencies.
- **Domain Entity**: Core business objects (Document, Highlight, Settings) with invariants and behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can add a new feature by modifying only the relevant domain, application, and adapter modules, with changes isolated to the expected layers (verified by code review checklist).
- **SC-002**: Pre-commit hooks complete in under 30 seconds for typical changes, providing fast feedback.
- **SC-003**: Full CI pipeline completes in under 10 minutes, enabling thorough integration and contract testing.
- **SC-004**: Unit tests for domain and application layers execute in under 5 seconds without external dependencies.
- **SC-005**: No Tauri command handler contains business logic beyond request parsing and response mapping (verified by code review or static analysis).
- **SC-006**: 100% of Tauri commands have corresponding typed wrappers in the frontend command client.
- **SC-007**: No raw `invoke()` calls exist outside the command client adapter (verified by grep/lint rule).
- **SC-008**: All files identified as "large" (originally 300+ lines) are refactored to modules under 200 lines each.
- **SC-009**: Contract tests exist for each command group covering happy path and error scenarios.
- **SC-010**: Documentation accurately reflects the implemented architecture with diagrams and examples.
- **SC-011**: New developers can understand and follow the architectural patterns within their first contribution (verified by onboarding feedback or documentation clarity review).
