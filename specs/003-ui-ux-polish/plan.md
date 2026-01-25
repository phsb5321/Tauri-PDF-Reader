# Implementation Plan: UI/UX Research + Visual Polish

**Branch**: `003-ui-ux-polish` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-ui-ux-polish/spec.md`

## Summary

Research-driven UI/UX improvement effort for the Tauri PDF Reader that inventories current screens, researches document reader patterns and accessibility standards, audits UI against usability heuristics, defines information architecture, establishes a minimal design system with tokens and components, and prioritizes improvements into an implementable backlog. The output is primarily documentation and design artifacts, with one validation slice implementing a before/after improvement.

## Technical Context

**Language/Version**: TypeScript 5.6.x (frontend), CSS3 custom properties
**Primary Dependencies**: React 18.3, Zustand 5.x, CSS Custom Properties
**Storage**: N/A (documentation and styling only)
**Testing**: Vitest (component tests), Playwright (E2E critical loop)
**Target Platform**: Desktop (Windows, macOS, Linux via Tauri)
**Project Type**: Frontend-focused (UI layer modifications only)
**Performance Goals**: UI interactions < 100ms, First paint < 500ms (per constitution)
**Constraints**: Desktop-first, WCAG 2.2 Level A keyboard accessibility, offline-capable
**Scale/Scope**: ~6 screens, ~8 design token categories, ~5 core components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Type Safety First | PASS | Design tokens as typed CSS vars, component props typed |
| II. Separation of Concerns | PASS | UI-only changes, no backend modifications |
| III. Error Resilience | PASS | Empty states and error states in backlog |
| IV. Test Coverage | PASS | Component tests + E2E critical loop required |
| V. Performance Budget | PASS | UI interactions < 100ms target maintained |
| VI. Accessibility | PASS | WCAG 2.2 Level A is explicit success criterion |
| VII. Offline-First | PASS | No network dependencies introduced |
| VIII. Security Boundaries | PASS | No CSP changes, no new IPC commands |

**Gate Status**: PASS - All constitution principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-ux-polish/
├── plan.md              # This file
├── research.md          # Phase 0 output (UI patterns research)
├── data-model.md        # Phase 1 output (design tokens model)
├── quickstart.md        # Phase 1 output (design system quick start)
├── contracts/           # N/A - no API contracts for UI feature
└── tasks.md             # Phase 2 output (implementation tasks)
```

### Source Code (repository root)

```text
docs/ui/
├── UI_BASELINE.md       # Current state screenshots + notes
├── UI_RESEARCH.md       # Patterns + best practices
├── UX_AUDIT.md          # Issues + severity + fixes
├── FLOWS.md             # Navigation + flow diagrams
├── DESIGN_SYSTEM.md     # Tokens + components + rules
├── UI_BACKLOG.md        # Prioritized work items
└── QUALITY_GATES.md     # Tests + checklists

src/ui/
├── tokens/
│   ├── index.css        # Imports all token files
│   ├── colors.css       # Color tokens + dark mode
│   ├── spacing.css      # Spacing scale
│   ├── typography.css   # Font sizes, line heights
│   ├── radii.css        # Border radius scale
│   ├── shadows.css      # Shadow scale
│   ├── z-index.css      # Layer scale
│   ├── motion.css       # Transitions, animations
│   └── layout.css       # Fixed dimensions (sidebar, panel widths)
└── components/
    ├── Button/
    ├── IconButton/
    ├── Panel/
    ├── ListRow/
    ├── EmptyState/
    └── Toast/

src/__tests__/ui/
└── [component].test.tsx # Component unit tests

e2e/
└── critical-loop.spec.ts # E2E test for open → highlight → TTS
```

**Structure Decision**: Frontend-only structure with dedicated `src/ui/` directory for design system tokens and components. Documentation deliverables in `docs/ui/`. Tests colocated in `src/__tests__/ui/`.

## Complexity Tracking

> No constitution violations requiring justification.

| Item | Status | Notes |
|------|--------|-------|
| Design tokens | Simple | CSS custom properties, no build tooling |
| Component library | Minimal | 5-6 core components, not a full design system |
| E2E tests | Standard | Single critical path test, Playwright existing setup |

## Research Questions (Phase 0)

The following were researched and resolved:

1. **Document reader layout patterns**: How do apps like Adobe Reader, Preview, Calibre handle sidebar + main content + panels?
   - **RESOLVED**: See research.md - Three-column layout (280px left, 320px right) adopted

2. **TTS UI patterns**: How do audiobook apps and screen readers visualize playback state and progress?
   - **RESOLVED**: See research.md - Sentence highlighting with background color adopted

3. **Keyboard accessibility**: What are the standard shortcuts for document readers? Focus management patterns?
   - **RESOLVED**: See research.md - Standard shortcuts documented, WCAG 2.2 Level A requirements defined

4. **Design token best practices**: CSS custom properties vs CSS-in-JS vs Tailwind? What's most maintainable for this scale?
   - **RESOLVED**: See research.md - CSS custom properties chosen for native support and simplicity

5. **Collapsible panel patterns**: Standard widths, animation timing, toggle behaviors for sidebars?
   - **RESOLVED**: See research.md - 200ms ease-out animation, 280px/320px widths

## Dependencies

### Internal
- Feature 002 (Hexagonal Architecture) must be stable - COMPLETE
- Existing component structure documented in spec

### External
- No external design tools (code-first approach)
- Web research uses public sources only

## Phase Outputs

### Phase 0: Research (Complete)
- Output: `research.md` - UI patterns research documented

### Phase 1: Design (Complete)
- Output: `data-model.md` - Design token schema defined
- Output: `quickstart.md` - Design system usage guide created
- Output: No API contracts needed (UI-only feature)

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Begin Phase 1 (Setup) - create directory structure
3. Begin Phase 2 (Foundational) - implement design tokens
