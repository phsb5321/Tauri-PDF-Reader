# Feature Specification: UI/UX Research + Visual Polish

**Feature ID**: 003-ui-ux-polish
**Status**: Draft
**Created**: 2026-01-13
**Last Updated**: 2026-01-13
**Branch**: `003-ui-ux-polish`

---

## 1. Overview

### 1.1 Problem Statement

The Tauri PDF Reader has functional core features (PDF viewing, highlights, TTS) but lacks:
- **Visual polish**: Inconsistent spacing, typography, and design language
- **Usability refinement**: The "reading loop" (open → read → highlight → review → TTS) has friction points
- **Desktop ergonomics**: Underutilized keyboard controls, missing side panels, suboptimal focus management
- **Design system**: No documented tokens, reusable components, or layout conventions

Users experience confusion about:
- How to navigate between library and reader
- When highlight mode is active
- TTS playback state and controls
- Where to find highlights they've created

### 1.2 Goal

Run a **UI research + design improvement** effort focused on:
- **Usability**: fewer clicks, clearer flows, better keyboard control
- **Beauty**: consistent spacing/typography, cohesive design language
- **Desktop-first ergonomics**: side panels, shortcuts, focus management
- **PDF reading + highlights + TTS**: make the "reading loop" feel smooth and obvious

This is *research-driven* and must end with an implementable backlog + UI conventions that devs can ship.

### 1.3 Solution Summary

A research-driven UI/UX improvement effort that:
1. **Inventories** current UI screens with screenshots and annotations
2. **Researches** patterns from document reader applications and accessibility standards
3. **Audits** current UI against usability heuristics
4. **Defines** information architecture and key user journeys
5. **Establishes** a minimal design system with tokens and components
6. **Prioritizes** improvements into an implementable backlog
7. **Validates** with at least one "before/after" implementation

### 1.4 Success Criteria (Definition of Done)

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| UX Audit complete | Issues documented with severity | 100% screens covered |
| Information architecture | User flows documented | 6 primary jobs mapped |
| Design system baseline | Tokens + core components | 8 token categories, 5+ components |
| Keyboard accessibility | Tab order, focus management | WCAG 2.2 Level A |
| Critical loop test | E2E: open → highlight → TTS (measured from document open) | < 5 clicks |
| Validation slice | Before/after implementation | 1 screen improved |

### 1.5 Out of Scope

- Major feature additions (new functionality)
- Mobile-first responsive design (desktop-first priority)
- Complete redesign (incremental improvements only)
- Backend architecture changes
- Internationalization/localization

---

## 2. User Stories

### US1: Designer Documents Current State
**As a** designer/developer
**I want** a comprehensive baseline of current UI screens
**So that** I can identify specific issues and track improvements

**Acceptance Criteria:**
- [ ] All screens mapped with screenshots
- [ ] Each screen annotated with purpose and primary actions
- [ ] Confusion points identified per screen
- [ ] Baseline document created at `docs/ui/UI_BASELINE.md`

### US2: Designer Researches Best Practices
**As a** designer
**I want** actionable patterns from document reader applications
**So that** improvements are grounded in proven UX patterns

**Acceptance Criteria:**
- [ ] Document reader layout patterns documented
- [ ] Sidebar/panel patterns with sizing guidance
- [ ] Keyboard accessibility requirements defined
- [ ] TTS UI patterns researched
- [ ] Research document created at `docs/ui/UI_RESEARCH.md`

### US3: Designer Audits UX Issues
**As a** designer
**I want** a structured heuristic evaluation of the UI
**So that** issues are prioritized by severity

**Acceptance Criteria:**
- [ ] Nielsen's 10 heuristics applied
- [ ] Critical reading loop timed and analyzed
- [ ] Issues categorized as P0/P1/P2
- [ ] Each issue has repro steps and proposed fix
- [ ] Audit document created at `docs/ui/UX_AUDIT.md`

### US4: Designer Defines Information Architecture
**As a** designer
**I want** clear user flows and navigation model
**So that** improvements maintain coherent structure

**Acceptance Criteria:**
- [ ] 6 primary user jobs documented
- [ ] Flow diagrams for each job
- [ ] Navigation model defined (sidebar + panels)
- [ ] Flows document created at `docs/ui/FLOWS.md`

### US5: Developer Implements Design System
**As a** developer
**I want** documented design tokens and components
**So that** UI changes are consistent and maintainable

**Acceptance Criteria:**
- [ ] Design tokens defined (spacing, typography, colors, radii)
- [ ] 5+ core components documented
- [ ] Layout rules established
- [ ] Tokens implemented in code
- [ ] Design system document at `docs/ui/DESIGN_SYSTEM.md`

### US6: Developer Ships Polish Backlog
**As a** developer
**I want** prioritized work items with acceptance criteria
**So that** improvements can be shipped incrementally

**Acceptance Criteria:**
- [ ] P0 items: must-have fixes
- [ ] P1 items: should-have improvements
- [ ] P2 items: nice-to-have enhancements
- [ ] Each item has keyboard behavior defined
- [ ] Each item has empty/error states
- [ ] Backlog document at `docs/ui/UI_BACKLOG.md`

### US7: Developer Adds Quality Gates
**As a** developer
**I want** tests and checklists to prevent UI regressions
**So that** polish work doesn't degrade over time

**Acceptance Criteria:**
- [ ] Component tests for core primitives
- [ ] E2E test for critical loop
- [ ] Focus/keyboard checklist
- [ ] Quality gates document at `docs/ui/QUALITY_GATES.md`

### US8: Team Validates with Implementation
**As a** team
**I want** at least one before/after UI improvement
**So that** the design system is proven in practice

**Acceptance Criteria:**
- [ ] One screen selected for improvement
- [ ] Before screenshot documented
- [ ] After implementation using new system
- [ ] After screenshot documented
- [ ] Validation notes added to design system doc

---

## 3. Current State Analysis

### 3.1 Existing Screens

Based on codebase exploration:

| Screen | Location | Status | Primary Action |
|--------|----------|--------|----------------|
| Reader | `ReaderView.tsx` | Active (main app) | Read PDF, create highlights |
| Library | `LibraryView.tsx` | Built, not integrated | Browse/open documents |
| Settings | `SettingsPanel.tsx` | Modal dialog | Configure app |
| Highlights Panel | `HighlightsPanel.tsx` | Built, not integrated | Review highlights |
| Table of Contents | `TableOfContents.tsx` | Built, not integrated | Navigate PDF outline |

### 3.2 Current Layout Architecture

```
┌─────────────────────────────────────────────────────┐
│ Toolbar (48px)                                      │
│ [Open] [Title] [Page Nav] [Zoom] [Settings]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│                 PDF Viewer                          │
│               (scrollable)                          │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ AI Playback Bar (when document open)                │
│ [Play] [Speed] [Voice] [Progress]                   │
└─────────────────────────────────────────────────────┘
```

### 3.3 Identified Gaps

1. **No Library Navigation**: Users start at empty reader, must use "Open" button
2. **No Sidebar**: Highlights panel and TOC exist but aren't integrated
3. **Hidden State**: Highlight mode on/off not visually obvious
4. **Disconnected TTS**: Playback bar exists but reading position unclear
5. **Inconsistent Spacing**: Ad-hoc pixel values throughout CSS

### 3.4 Existing Design Tokens (Implicit)

Current CSS variables provide a starting point:

```css
/* Colors */
--bg-color, --toolbar-bg, --viewer-bg, --border-color
--text-color, --text-muted, --accent-color, --error-color

/* No explicit tokens for: */
/* - Spacing scale */
/* - Typography scale */
/* - Border radius scale */
/* - Shadow scale */
/* - Z-index scale */
/* - Motion/transition scale */
```

---

## 4. Technical Design

### 4.1 Design System Architecture

```
src/
├── ui/
│   ├── tokens/
│   │   ├── index.css        # Imports all token files
│   │   ├── colors.css       # Color tokens
│   │   ├── spacing.css      # Spacing scale
│   │   ├── typography.css   # Font sizes, line heights
│   │   ├── radii.css        # Border radius scale
│   │   ├── shadows.css      # Shadow scale
│   │   ├── z-index.css      # Layer scale
│   │   ├── motion.css       # Transitions, animations
│   │   └── layout.css       # Fixed dimensions (sidebar, panel widths)
│   └── components/
│       ├── Button/
│       ├── IconButton/
│       ├── Panel/
│       ├── ListRow/
│       ├── EmptyState/
│       └── Toast/
```

### 4.2 Layout System

Target layout structure:

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (global)                                            │
├──────────┬──────────────────────────────────┬───────────────┤
│ Library  │                                  │ Right Panel   │
│ Sidebar  │       PDF Viewer                 │ (Highlights/  │
│ (280px)  │       (flex: 1)                  │  TOC)         │
│          │                                  │ (320px)       │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│ Playback Bar (global footer)                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Component Hierarchy

```
App
├── AppLayout
│   ├── header: Toolbar
│   ├── sidebar: LibrarySidebar (collapsible)
│   ├── main: PdfViewer
│   ├── panel: RightPanel (Highlights | TOC)
│   └── footer: PlaybackBar
```

### 4.4 Keyboard Navigation Model

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Global | Move focus forward |
| `Shift+Tab` | Global | Move focus backward |
| `Escape` | Modal/Panel | Close overlay |
| `Space` | Reader | Toggle TTS play/pause |
| `←`/`→` | Reader | Previous/Next page |
| `Ctrl+O` | Global | Open file dialog |
| `Ctrl+,` | Global | Open settings |
| `Ctrl+H` | Reader | Toggle highlights panel |
| `Ctrl+B` | Reader | Toggle library sidebar |

### 4.5 Focus Management Rules

1. **Initial Focus**: When app loads, focus toolbar "Open" button
2. **Modal Opens**: Focus first interactive element in modal
3. **Modal Closes**: Return focus to element that triggered modal
4. **Panel Opens**: Focus panel header or first item
5. **Panel Closes**: Return focus to toggle button
6. **Page Change**: Maintain focus on page navigation

---

## 5. Deliverables

### 5.1 Documentation Deliverables

| Document | Path | Purpose |
|----------|------|---------|
| UI Baseline | `docs/ui/UI_BASELINE.md` | Current state screenshots + notes |
| UI Research | `docs/ui/UI_RESEARCH.md` | Patterns + best practices |
| UX Audit | `docs/ui/UX_AUDIT.md` | Issues + severity + fixes |
| User Flows | `docs/ui/FLOWS.md` | Navigation + flow diagrams |
| Design System | `docs/ui/DESIGN_SYSTEM.md` | Tokens + components + rules |
| UI Backlog | `docs/ui/UI_BACKLOG.md` | Prioritized work items |
| Quality Gates | `docs/ui/QUALITY_GATES.md` | Tests + checklists |

### 5.2 Code Deliverables

| Deliverable | Path | Purpose |
|-------------|------|---------|
| Design tokens | `src/ui/tokens/*.css` | CSS custom properties |
| Core components | `src/ui/components/*` | Reusable UI primitives |
| Component tests | `src/__tests__/ui/*` | Component unit tests |
| E2E critical loop | `e2e/critical-loop.spec.ts` | Integration test |

### 5.3 Validation Deliverable

- One screen improved using new design system
- Before/after screenshots documented
- Implementation validates token/component approach

---

## 6. Phases

### Phase 0: Inventory + Baseline Capture (Repo Exploration)
**Output**: `docs/ui/UI_BASELINE.md`

Map the current screens:
- Library / document list
- Reader (PDF) + highlight tools
- Highlights list/manager
- TTS player controls
- Settings (TTS/AI/voice/etc)

Capture current UI with screenshots + short notes per screen:
- "What am I supposed to do here?"
- Most confusing element
- Most frequent action

### Phase 1: Web Research (Patterns + Benchmarks)
**Output**: `docs/ui/UI_RESEARCH.md`

#### 1.1 Document-reader UI patterns
Research and extract *actionable patterns* for:
- Reader layout (center canvas + sidebars)
- Highlights/annotations sidebar patterns (grouping, filtering, search)
- Toolbars (discoverable but not noisy)

Inspiration sources:
- Document viewer inspiration galleries for layout ideas
- Sidebar sizing + collapse behaviors (width ranges, collapsed states)
- "Dashboard-ish" patterns for dense info without clutter

#### 1.2 Keyboard + accessibility for desktop apps
Research & define baseline requirements:
- Focus management, modals, panels
- Keyboard-only usage of reader + highlights + playback controls
- Shortcut design that doesn't conflict with OS/screen readers

Sources:
- WCAG 2.2 baseline principles
- WebAIM keyboard accessibility practices
- Microsoft Windows keyboard accessibility guidance (accelerators/access keys)
- Shortcut caution + focus operability notes

#### 1.3 TTS UI ergonomics
Extract patterns for:
- Playback control layout (play/pause, speed, voice, skip)
- Feedback states (buffering, errors, current sentence/paragraph)
- "Reading mode" vs "editing mode"

### Phase 2: UX Audit (Heuristics + Flow Friction)
**Output**: `docs/ui/UX_AUDIT.md`

Perform a structured audit (with screenshots):
- Heuristic eval: consistency, visibility, feedback, error prevention
- "Critical loop" timing: open doc → read → highlight → review → play TTS
- Identify friction:
  - unclear affordances
  - too many controls
  - inconsistent spacing/typography
  - hidden state (e.g., highlight mode on/off)
  - weak empty states

Output format:
- Issue list (severity P0/P1/P2)
- Repro steps
- Proposed fix (1–3 sentences)
- Screenshot reference

### Phase 3: Information Architecture + Key User Journeys
**Output**: `docs/ui/FLOWS.md`

Define the app's top jobs:
1. Find/open document
2. Read comfortably
3. Create highlights quickly
4. Navigate highlights
5. Listen with TTS while tracking location
6. Export/share/organize (if applicable)

"Primary navigation model" decision:
- left nav (library) + central reader + right panel (highlights/tts)
- or alternative layout justified via research

### Phase 4: Visual Design System Baseline (Ship-ready)
**Output**: `docs/ui/DESIGN_SYSTEM.md` + `src/ui/tokens/*` + `src/ui/components/*`

Create a minimal design system that can be implemented directly:
- **Design tokens**: spacing scale, font sizes, radii, shadows, z-index, motion durations
- **Component inventory**:
  - buttons (primary/secondary/ghost)
  - icon buttons (toolbar)
  - panel + resizable split view
  - list row (doc item, highlight item)
  - empty state component
  - toast/notifications
  - modal + command palette (optional)
- **Layout rules**:
  - sidebar width defaults + collapsed width guidance
  - reader toolbar density rules
  - consistent padding grid (avoid "random px")

### Phase 5: Prototype + Backlog (Prioritized Implementation Plan)
**Output**: `docs/ui/UI_BACKLOG.md`

Turn audit into work items:
- P0 (must): reader layout clarity, highlight creation, playback controls, keyboard basics
- P1 (should): highlights organization/search, better empty states, settings rework
- P2 (nice): animations, theming, advanced shortcuts, command palette

Each item must include:
- user-facing acceptance criteria
- keyboard behavior
- empty/error states
- test notes (unit/e2e)

### Phase 6: Quality Gates (Regression Prevention)
**Output**: `docs/ui/QUALITY_GATES.md`

Add UI guardrails aligned with TDD:
- Component tests for core UI primitives
- E2E "critical loop" test (open → highlight → play)
- Optional: visual regression snapshots for key screens

Checklist items:
- focus order correct
- Escape closes overlays
- no dead-end keyboard traps

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep into features | High | Strict "polish only" boundary |
| Design system overhead | Medium | Start minimal, grow as needed |
| Regression from changes | Medium | Quality gates before shipping |
| Inconsistent application | Low | Document conventions clearly |

---

## 8. Dependencies

### 8.1 Internal Dependencies

- Hexagonal architecture (002) should be stable before major UI changes
- Existing component structure must be understood before refactoring

### 8.2 External Dependencies

- No external design tools required (code-first approach)
- Web research uses public sources only

---

## 9. Appendix

### A. Nielsen's 10 Usability Heuristics

1. Visibility of system status
2. Match between system and real world
3. User control and freedom
4. Consistency and standards
5. Error prevention
6. Recognition rather than recall
7. Flexibility and efficiency of use
8. Aesthetic and minimalist design
9. Help users recognize, diagnose, recover from errors
10. Help and documentation

### B. WCAG 2.2 Level A Requirements (Keyboard)

- 2.1.1 Keyboard: All functionality available via keyboard
- 2.1.2 No Keyboard Trap: Focus can move away from any component
- 2.4.1 Bypass Blocks: Skip to main content
- 2.4.3 Focus Order: Logical navigation sequence
- 2.4.7 Focus Visible: Keyboard focus is visible

### C. Design Token Categories

> **Note**: Full token schema with CSS implementation details is defined in `specs/003-ui-ux-polish/data-model.md`

| Category | Examples |
|----------|----------|
| Color | Primary, secondary, background, text, error, success |
| Spacing | 4px, 8px, 12px, 16px, 24px, 32px, 48px |
| Typography | Font family, sizes, weights, line heights |
| Radius | Small (4px), medium (8px), large (12px), full (9999px) |
| Shadow | Subtle, medium, strong, focus |
| Z-index | Base, dropdown, sticky, modal, toast |
| Motion | Fast (150ms), normal (250ms), slow (400ms) |
| Layout | Toolbar height, sidebar width, panel width |

---

## 10. Output Checklist

- [ ] `docs/ui/UI_BASELINE.md` - Current state screenshots + notes
- [ ] `docs/ui/UI_RESEARCH.md` - Patterns + best practices
- [ ] `docs/ui/UX_AUDIT.md` - Issues + severity + fixes
- [ ] `docs/ui/FLOWS.md` - Navigation + flow diagrams
- [ ] `docs/ui/DESIGN_SYSTEM.md` - Tokens + components + rules (+ tokens/components started in code)
- [ ] `docs/ui/UI_BACKLOG.md` - Prioritized work items
- [ ] `docs/ui/QUALITY_GATES.md` - Tests + checklists
- [ ] One implemented "before/after" UI slice to validate the system

---

## 11. Constraints

- Desktop-first interactions (mouse + keyboard)
- Avoid UI churn: prefer incremental improvements behind feature flags if needed
- Keep architecture: UI layer stays thin; application logic remains in use-cases/ports
- No external design tools required (code-first approach)
- WCAG 2.2 Level A keyboard accessibility required

---

## 12. Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-01-13 | Claude | Initial draft |
| 0.2 | 2026-01-13 | Claude | Added detailed phase descriptions, output checklist, constraints |
