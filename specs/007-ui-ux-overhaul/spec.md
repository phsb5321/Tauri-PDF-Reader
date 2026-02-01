# Feature Specification: UI/UX Overhaul

**Feature Branch**: `007-ui-ux-overhaul`  
**Created**: 2026-02-01  
**Status**: Draft  
**Input**: Create a professional, consistent, accessible UI/UX for the Tauri PDF Reader without breaking core flows. Incremental refactors shipped in slices.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keyboard Navigation (Priority: P1)

As a keyboard-focused user, I want to navigate the entire application using only my keyboard so I can work efficiently without reaching for the mouse.

**Why this priority**: Keyboard accessibility is foundational—it enables power users to work faster and ensures the app is usable by people who cannot use a mouse.

**Independent Test**: Can be fully tested by performing all core tasks (open PDF, navigate pages, zoom, toggle panels, play TTS) using only keyboard. Delivers accessibility compliance and power user efficiency.

**Acceptance Scenarios**:

1. **Given** the application is open with no document, **When** I press `Tab`, **Then** focus moves logically through toolbar elements from left to right.
2. **Given** the toolbar has focus, **When** I press `Arrow Right`, **Then** focus moves to the next toolbar button (roving tabindex).
3. **Given** a PDF is open, **When** I press `PageDown` or `→`, **Then** the viewer navigates to the next page.
4. **Given** text is selected, **When** I press `Ctrl+H`, **Then** the selection is highlighted with the default color.
5. **Given** a modal dialog is open, **When** I press `Escape`, **Then** the dialog closes and focus returns to the trigger element.
6. **Given** a modal dialog is open, **When** I press `Tab` repeatedly, **Then** focus cycles within the dialog (focus trap).

---

### User Story 2 - Screen Reader Accessibility (Priority: P1)

As a screen reader user, I want important changes announced to me so I understand what's happening in the application without visual cues.

**Why this priority**: WCAG 2.2 Level A compliance requires assistive technology support. Announcements prevent confusion when UI state changes.

**Independent Test**: Can be tested with NVDA/VoiceOver by navigating the app and verifying announcements for page changes, zoom changes, and action confirmations.

**Acceptance Scenarios**:

1. **Given** I navigate to a new page, **When** the page renders, **Then** the screen reader announces "Page X of Y".
2. **Given** I change the zoom level, **When** the zoom updates, **Then** the screen reader announces "Zoom X%".
3. **Given** I create a highlight, **When** the highlight is saved, **Then** the screen reader announces "Highlight added".
4. **Given** toolbar buttons have icons only, **When** I focus a button, **Then** the screen reader reads the accessible label.
5. **Given** a modal opens, **When** it appears, **Then** the screen reader announces the dialog title.

---

### User Story 3 - Consistent Visual Design (Priority: P2)

As a visual reader, I want consistent spacing, colors, and typography throughout the app so the interface feels polished and professional.

**Why this priority**: Visual consistency builds trust and reduces cognitive load. The current app has inconsistent spacing and hardcoded values.

**Independent Test**: Can be tested by auditing CSS for hardcoded values (should be zero) and visual comparison across all screens for spacing/alignment consistency.

**Acceptance Scenarios**:

1. **Given** any UI element with spacing, **When** I inspect the CSS, **Then** it uses design tokens (`--space-*`), not hardcoded px values.
2. **Given** any colored element, **When** I inspect the CSS, **Then** it uses semantic color tokens (`--color-*`), not hex values.
3. **Given** any z-indexed element, **When** I inspect the CSS, **Then** it uses z-index tokens (`--z-*`), not raw numbers.
4. **Given** focus is on any interactive element, **When** I view the focus indicator, **Then** it has consistent styling using `--shadow-focus`.
5. **Given** I switch between light and dark modes, **When** the theme changes, **Then** all colors adapt correctly using semantic tokens.

---

### User Story 4 - Action Feedback (Priority: P2)

As a user, I want immediate feedback when I perform actions so I know my actions were successful or failed.

**Why this priority**: Lack of feedback creates uncertainty. Users should never wonder if their action worked.

**Independent Test**: Can be tested by performing CRUD operations on highlights and verifying toast notifications appear.

**Acceptance Scenarios**:

1. **Given** I create a highlight, **When** the highlight is saved, **Then** a success toast appears with "Highlight added".
2. **Given** I delete a highlight, **When** the deletion completes, **Then** a toast appears with "Highlight removed".
3. **Given** I export highlights, **When** the export completes, **Then** a success toast shows the save location.
4. **Given** an action fails, **When** the error occurs, **Then** an error toast appears with a retry action.
5. **Given** multiple actions occur quickly, **When** toasts appear, **Then** they stack in the bottom-right without overlapping.

---

### User Story 5 - Empty State Guidance (Priority: P3)

As a new user, I want clear guidance when there's no content so I know how to get started.

**Why this priority**: Empty states are often neglected but represent key moments of user confusion or abandonment.

**Independent Test**: Can be tested by opening the app fresh and verifying helpful empty states appear in all content areas.

**Acceptance Scenarios**:

1. **Given** no document is open, **When** I view the main area, **Then** I see an empty state with "Open a PDF to get started" and an Open button.
2. **Given** a document has no highlights, **When** I open the Highlights panel, **Then** I see an empty state explaining how to create highlights.
3. **Given** a search returns no results, **When** the search completes, **Then** I see an empty state suggesting to try different keywords.
4. **Given** no recent documents exist, **When** I view the library, **Then** I see an empty state with guidance to open a file.

---

### User Story 6 - Loading State Clarity (Priority: P3)

As a user opening large PDFs, I want to see loading progress so I know the app is working and haven't experienced a freeze.

**Why this priority**: PDF loading can take several seconds. Without feedback, users may think the app is broken.

**Independent Test**: Can be tested by opening a large PDF (100+ pages) and verifying skeleton/progress UI appears before content.

**Acceptance Scenarios**:

1. **Given** I open a large PDF, **When** loading takes >500ms, **Then** a skeleton placeholder appears showing the expected page layout.
2. **Given** loading is in progress, **When** I view the skeleton, **Then** it has a subtle pulse animation indicating activity.
3. **Given** a PDF page is rendering, **When** it completes, **Then** the skeleton transitions smoothly to the rendered content.

---

### Edge Cases

- What happens when a user opens the app with no recent files? → Show empty state with Open PDF action.
- What happens when keyboard shortcuts conflict with OS shortcuts? → Avoid conflicts (documented in research.md).
- What happens when a modal is open and user clicks outside? → Close modal (configurable per dialog).
- What happens when a toast action is clicked after the toast dismisses? → No action (toast is already gone).
- What happens when focus trap encounters zero focusable elements? → Focus the dialog container itself.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Foundation (Token System)
- **FR-001**: All spacing in CSS MUST use design tokens (`--space-1` through `--space-12`), not hardcoded pixel values.
- **FR-002**: All colors in CSS MUST use semantic color tokens (`--color-*`), not hex values.
- **FR-003**: All z-index values MUST use z-index tokens (`--z-*`), not raw numbers.
- **FR-004**: A `--shadow-focus` token MUST be defined and used for all focus indicators.

#### Accessibility
- **FR-005**: All interactive elements MUST be reachable via Tab key in logical order.
- **FR-006**: Toolbar MUST implement roving tabindex pattern (single Tab stop, Arrow key navigation).
- **FR-007**: Modal dialogs MUST implement focus trap (Tab cycles within, Escape closes).
- **FR-008**: Focus MUST return to the triggering element when a modal or panel closes.
- **FR-009**: Dynamic content changes MUST be announced via `aria-live` region.
- **FR-010**: All icon-only buttons MUST have accessible labels (`aria-label` or visible text).

#### Keyboard Navigation
- **FR-011**: Users MUST be able to open files with `Ctrl+O` / `Cmd+O`.
- **FR-012**: Users MUST be able to navigate pages with `PageDown`/`PageUp` and arrow keys.
- **FR-013**: Users MUST be able to zoom with `Ctrl++` / `Ctrl+-`.
- **FR-014**: Users MUST be able to toggle TTS playback with `Space` (when not in text input).
- **FR-015**: Users MUST be able to close any modal or panel with `Escape`.

#### User Feedback
- **FR-016**: Highlight CRUD operations MUST show toast notifications confirming success or failure.
- **FR-017**: Export operations MUST show toast with save location on success.
- **FR-018**: Error states MUST include actionable recovery options (e.g., retry button).

#### Empty States
- **FR-019**: "No document open" state MUST show guidance and primary action button.
- **FR-020**: Empty panels (highlights, search results) MUST show contextual guidance.

#### Architecture
- **FR-021**: All `@tauri-apps/plugin-dialog` usage MUST go through an adapter (no direct imports in components).
- **FR-022**: No new direct `invoke()` calls MUST be added to components (preserve hexagonal architecture).

### Key Entities

- **Design Token**: A CSS custom property defining a design value (color, spacing, shadow). Key attributes: name, value, category, usage guidelines.

- **UI Primitive**: A reusable, atomic component (Button, IconButton, Panel, Toast, EmptyState, ListRow). Key attributes: props interface, variants, states, accessibility requirements.

- **Keyboard Shortcut**: A key combination mapped to an application action. Key attributes: key combo, action name, context (global vs local), platform variant.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of CSS files pass audit for design token usage (no hardcoded spacing, colors, or z-index values).
- **SC-002**: Users can complete the "open document → navigate pages → create highlight → play TTS" flow using only keyboard in under 60 seconds.
- **SC-003**: All modal dialogs pass focus trap testing (Tab does not escape, Escape closes, focus returns).
- **SC-004**: `pnpm lint` passes with zero accessibility-related errors (currently 15+ errors).
- **SC-005**: Screen reader users receive announcements for page changes, zoom changes, and CRUD confirmations.
- **SC-006**: Empty states exist for: no document, no highlights, no search results, no recent files.
- **SC-007**: Toast notifications appear for all highlight and export operations.
- **SC-008**: Architecture boundary lint rules pass (no direct `@tauri-apps/plugin-dialog` imports in components).

---

## Assumptions

1. **Incremental adoption**: Changes will be shipped in small slices, not as a big-bang rewrite.
2. **Existing token system**: The current `src/ui/tokens/` structure is adequate and will be expanded, not replaced.
3. **No new dependencies**: Accessibility features will be implemented with custom hooks, not external libraries (except potentially Radix for future primitives).
4. **Desktop-first**: Mobile/touch optimization is out of scope; focus is on keyboard + mouse.
5. **Current components retained**: Existing components will be refactored, not replaced.
6. **Testing requirements**: New code will maintain 80% coverage threshold.

---

## Constraints

- **No direct `invoke()` calls**: UI layer must use adapters/bindings.
- **No architectural changes**: Ports and adapters pattern must be preserved.
- **Incremental delivery**: Each task should be independently shippable.
- **WCAG 2.2 Level A minimum**: Focus visible, keyboard operability, no keyboard traps.
- **Cross-platform shortcuts**: Use `CommandOrControl` modifier for platform parity.

---

## Related Documents

- **Research**: `specs/007-ui-ux-overhaul/research.md` - Detailed findings from component audit and web research
- **Design Spec**: `specs/007-ui-ux-overhaul/ui-spec.md` - Visual system, component specs, interaction rules
- **Task Backlog**: `specs/007-ui-ux-overhaul/ui-tasks-seed.md` - Prioritized implementation backlog
- **Prior UI Work**: `specs/003-ui-ux-polish/` - Previous UI research and specifications

---

## Out of Scope

- Complete visual redesign or rebrand
- Mobile/responsive layout optimization
- New feature functionality (focus is on UX of existing features)
- E2E test infrastructure (documented gap, deferred)
- Command palette (P2, may be deferred to future milestone)
- Sidebar redesign (P2, may be deferred to future milestone)
