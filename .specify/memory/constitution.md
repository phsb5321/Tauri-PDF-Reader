<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 0.0.0 → 1.0.0
Bump rationale: Initial constitution creation (MAJOR)

Modified principles: N/A (initial creation)

Added sections:
- 8 Core Principles (Type Safety, Separation of Concerns, Error Resilience,
  Test Coverage, Performance Budget, Accessibility, Offline-First, Security)
- Technology Constraints section
- Development Workflow section
- Governance section with strict amendment process

Removed sections: N/A (initial creation)

Templates status:
- .specify/templates/plan-template.md: ✅ Compatible (Constitution Check section exists)
- .specify/templates/spec-template.md: ✅ Compatible (requirements align with principles)
- .specify/templates/tasks-template.md: ✅ Compatible (test-first guidance present)
- .specify/templates/checklist-template.md: ✅ Compatible (flexible structure)

Deferred items: None

Follow-up TODOs: None
================================================================================
-->

# Tauri PDF Reader Constitution

## Core Principles

### I. Type Safety First

All data crossing boundaries MUST be validated at compile-time or runtime:

- **Frontend**: TypeScript strict mode enabled (`strictNullChecks`, `noImplicitAny`,
  `strictFunctionTypes`). All API responses validated with Zod schemas before use.
- **Backend**: Rust's type system enforced. All Tauri commands use typed parameters
  and return `Result<T, E>` for fallible operations.
- **IPC Boundary**: Shared types defined in `src/lib/schemas.ts` (Zod) and mirrored
  in Rust with `#[serde(rename_all = "camelCase")]`. No `any` types in IPC calls.

**Rationale**: Type errors caught at compile-time cost nothing; runtime type errors
in a desktop app cause crashes and data loss.

### II. Separation of Concerns

Clear boundaries between frontend and backend responsibilities:

- **Frontend (React/TypeScript)**: UI rendering, user interaction, PDF display via
  pdf.js, local component state. MUST NOT directly access filesystem or SQLite.
- **Backend (Rust/Tauri)**: Data persistence (SQLite), file operations, native TTS,
  system integration. MUST NOT contain UI logic or rendering decisions.
- **State Management**: Zustand stores own application state. Backend is the source
  of truth for persisted data; frontend caches and syncs.

**Rationale**: Tauri's security model depends on this separation. Mixing concerns
creates security vulnerabilities and makes testing impossible.

### III. Error Resilience

The application MUST NOT crash or freeze due to recoverable errors:

- All Tauri commands MUST return `Result<T, String>` or custom error types.
- Frontend MUST handle all error variants with user-friendly messages.
- PDF loading failures MUST show actionable feedback, not blank screens.
- Database errors MUST be logged and surfaced; data MUST NOT be silently lost.
- TTS failures MUST degrade gracefully (feature unavailable, not app crash).

**Rationale**: Desktop apps run unattended. Users lose trust when apps crash.
Graceful degradation preserves user work and provides recovery paths.

### IV. Test Coverage

Critical paths MUST have automated test coverage:

- **Contract Tests**: Tauri command interfaces tested for correct serialization.
- **Integration Tests**: IPC round-trips between frontend and backend verified.
- **Unit Tests**: Pure functions (utilities, transformations) tested in isolation.
- **Rust Tests**: `cargo test` MUST pass. Critical database operations tested.

Test requirements:
- New features MUST include tests for happy path and primary error cases.
- Bug fixes SHOULD include regression tests demonstrating the fix.
- Tests MUST NOT depend on external services or network access.

**Rationale**: A PDF reader handles user documents. Regressions in save/load
operations cause data loss. Tests are insurance against breaking changes.

### V. Performance Budget

The application MUST meet these performance targets:

- **PDF Render**: First page visible within 500ms of file open.
- **Page Navigation**: Next/previous page rendered within 200ms.
- **UI Interactions**: Button clicks, menu opens respond within 100ms.
- **Memory**: Base memory usage below 150MB; per-document overhead below 50MB.
- **Startup**: Application window visible within 2 seconds of launch.

**Rationale**: PDF readers compete with native apps. Sluggish performance drives
users back to system defaults. Performance is a feature.

### VI. Accessibility

The application MUST be usable by people with disabilities:

- **Keyboard Navigation**: All features accessible without mouse. Focus visible.
- **Screen Reader**: Semantic HTML, ARIA labels where needed, alt text for icons.
- **Text-to-Speech**: Native TTS feature serves users who cannot read screens.
- **High Contrast**: UI readable in system high-contrast modes.
- **Font Scaling**: UI respects system font size preferences.

**Rationale**: Accessibility is a legal requirement in many jurisdictions and
expands the user base. TTS is a core feature, not an afterthought.

### VII. Offline-First

The application MUST function without network connectivity:

- All data stored locally in SQLite database.
- PDF files accessed from local filesystem only.
- No features MAY require network requests to function.
- Updates MAY use network but MUST NOT block core functionality.

**Rationale**: PDF readers are document tools. Users expect them to work on
airplanes, in secure facilities, and without internet dependencies.

### VIII. Security Boundaries

The application MUST enforce security constraints:

- **CSP**: Content Security Policy configured in `tauri.conf.json`. No inline
  scripts, no external resource loading except configured allowlist.
- **File Access**: Restricted to user-selected files via dialog. No arbitrary
  filesystem traversal. Paths validated before operations.
- **IPC Security**: Tauri capabilities defined in `capabilities/`. Commands
  exposed only as needed. No blanket permissions.
- **Dependencies**: Rust dependencies audited (`cargo audit`). npm dependencies
  reviewed for known vulnerabilities.

**Rationale**: Desktop apps have filesystem access. A compromised PDF reader
is a serious security incident. Defense in depth required.

## Technology Constraints

The following technology decisions are fixed for this project:

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Framework | Tauri | 2.x | Native performance, security model, Rust backend |
| Frontend | React | 18+ | Component model, ecosystem, developer familiarity |
| Language (FE) | TypeScript | 5.x | Type safety, tooling, maintainability |
| Language (BE) | Rust | 1.75+ | Memory safety, performance, Tauri requirement |
| PDF Rendering | pdf.js | Latest | Industry standard, well-maintained, feature-complete |
| State | Zustand | Latest | Simple, TypeScript-friendly, minimal boilerplate |
| Database | SQLite | via tauri-plugin-sql | Local-first, no server, portable |
| Validation | Zod | Latest | Runtime type validation, TypeScript inference |
| Build | Vite | 5.x | Fast HMR, ESM-native, Tauri integration |
| Package Manager | pnpm | 8+ | Efficient, workspace support |

Technology changes require constitution amendment.

## Development Workflow

### Code Quality Gates

All code changes MUST pass these gates before merge:

1. **Type Check**: `pnpm build` (TypeScript) and `cargo check` (Rust) pass.
2. **Lint**: `pnpm lint` passes with no errors.
3. **Tests**: All existing tests pass. New code includes appropriate tests.
4. **No Regressions**: Manual smoke test of affected features.

### Review Requirements

- Changes to core data structures (Document, Highlight) require review.
- Changes to Tauri commands require security consideration.
- Performance-sensitive changes require measurement before/after.

### Commit Standards

- Commits SHOULD be atomic (one logical change per commit).
- Commit messages SHOULD follow conventional commits format.
- Breaking changes MUST be documented in commit message.

## Governance

### Constitution Authority

This constitution supersedes all other development practices. When in conflict:

1. Constitution principles take precedence.
2. If principles conflict, discuss and amend constitution.
3. Temporary exceptions MUST be documented with rationale and expiration.

### Amendment Process

Changes to this constitution require:

1. **Proposal**: Written description of change and rationale.
2. **Impact Analysis**: Which principles, templates, or workflows affected.
3. **Review**: Consideration of alternatives and trade-offs.
4. **Migration Plan**: How existing code/docs will be updated.
5. **Version Bump**: Following semantic versioning rules below.

### Version Policy

Constitution versions follow semantic versioning:

- **MAJOR** (X.0.0): Principle removed, redefined, or governance changed incompatibly.
- **MINOR** (x.Y.0): New principle added or existing materially expanded.
- **PATCH** (x.y.Z): Clarifications, typos, non-semantic wording improvements.

### Compliance Review

- New features SHOULD reference relevant principles in spec/plan documents.
- Code reviews MAY cite constitution violations as blocking issues.
- Periodic review of constitution relevance recommended quarterly.

**Version**: 1.0.0 | **Ratified**: 2026-01-11 | **Last Amended**: 2026-01-11
