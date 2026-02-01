# UI/UX Overhaul Research

**Feature**: 007-ui-ux-overhaul  
**Date**: 2026-02-01  
**Status**: Complete

---

## Executive Summary

This research consolidates findings from multiple parallel audits and web research to inform the UI/UX overhaul of the Tauri PDF Reader. The codebase has a **well-structured foundation** with design tokens and reusable primitives, but requires **consistency improvements** and **accessibility enhancements**.

| Area | Current State | Recommendation |
|------|---------------|----------------|
| **Design Tokens** | 92% CSS adoption, 9 token categories | Complete migration, add missing tokens |
| **UI Primitives** | 6 components in `src/ui/components/` | Expand to 10-12 primitives |
| **Component Hotspots** | 3 files >300 lines | Split `PdfViewer.tsx` |
| **Accessibility** | Partial implementation | Add focus traps, roving tabindex, ARIA |
| **Keyboard Shortcuts** | Basic navigation only | Implement standard PDF reader shortcuts |
| **Architecture Violations** | 4 files with direct plugin imports | Create adapters for `@tauri-apps/plugin-dialog` |

---

## 1. Component Architecture Audit

### 1.1 Component Inventory

**Total: 49 component files, 7,986 lines**

| Category | Count | Examples |
|----------|-------|----------|
| Page-level | 5 | `PdfViewer`, `LibraryView`, `ReaderView`, `Toolbar`, `AppLayout` |
| Feature | 24 | `AiPlaybackBar`, `HighlightsPanel`, `TableOfContents` |
| Settings | 11 | `SettingsPanel`, `TtsSettings`, `CacheSettings` |
| Reusable | 9 | `PageNavigation`, `ZoomControls`, `SearchBar` |

### 1.2 Hotspots (Complexity Concerns)

| File | Lines | Issue | Recommendation |
|------|-------|-------|----------------|
| `src/components/PdfViewer.tsx` | 620 | Too many responsibilities | Split into rendering, navigation, interaction hooks |
| `src/components/playback-bar/AiPlaybackBar.tsx` | 402 | Complex state, nested UI | Extract progress and settings sub-components |
| `src/components/export-dialog/AudioExportDialog.tsx` | 370 | Multi-state dialog | Extract state machine to hook |

### 1.3 Architecture Violations

**Direct Tauri Plugin Usage in Components** (should use adapters):

| File | Import | Fix |
|------|--------|-----|
| `src/components/export-dialog/AudioExportDialog.tsx` | `@tauri-apps/plugin-dialog` | Create `FileDialogAdapter` |
| `src/components/dialogs/ExportDialog.tsx` | `@tauri-apps/plugin-dialog` | Use adapter |
| `src/components/Toolbar.tsx` | `@tauri-apps/plugin-dialog` | Use adapter |
| `src/hooks/useKeyboardShortcuts.ts` | `@tauri-apps/plugin-dialog` | Use adapter |

**Recommendation**: Create `src/adapters/tauri/file-dialog.adapter.ts` to wrap `@tauri-apps/plugin-dialog`.

### 1.4 UI Primitives Status

**Existing Components** (`src/ui/components/`):

| Component | Lines | Props | Token Usage |
|-----------|-------|-------|-------------|
| `Button` | 48 | `variant`, `size`, `fullWidth`, `loading` | Full |
| `IconButton` | 47 | `label`, `variant`, `size`, `active` | Full |
| `Panel` | 76 | `title`, `position`, `collapsed`, `onClose` | Full |
| `EmptyState` | 72 | `title`, `description`, `icon`, `action` | Full |
| `ListRow` | 93 | `primary`, `secondary`, `leading`, `trailing` | Full |
| `Toast` | 96 | `message`, `variant`, `duration`, `onClose` | Full |

**Missing Primitives** (candidates for extraction):

| Primitive | Source | Effort |
|-----------|--------|--------|
| `Dialog`/`Modal` | Export dialogs | Medium |
| `ProgressBar` | `CacheProgressBar` | Low |
| `Slider` | Speed sliders | Low |
| `Dropdown`/`Select` | Voice selectors | Medium |
| `Tooltip` | Various | Low |
| `Tabs` | Settings panel | Medium |

### 1.5 Design Token Adoption

**Token Categories** (`src/ui/tokens/`):

| File | Tokens Defined | Adoption |
|------|---------------|----------|
| `colors.css` | 19 color tokens + dark mode | 90%+ |
| `spacing.css` | 10 spacing tokens (0-12) | 85% |
| `typography.css` | 6 sizes, 4 weights, 3 line-heights | 95% |
| `z-index.css` | 10 z-index layers | 75% (13 hardcoded values) |
| `layout.css` | 8 layout dimensions | 90% |
| `motion.css` | 3 durations, 3 easings | 80% |
| `radii.css` | 6 border-radius values | 95% |
| `shadows.css` | 6 shadow values | Missing `--shadow-focus` |

**Issues Found**:

```css
/* Hardcoded z-index (should use tokens) */
src/components/common/LoadingState.css:  z-index: 1000;  /* var(--z-modal) */
src/components/pdf-viewer/TtsWordHighlight.css:  z-index: 99999;  /* needs new token */
```

---

## 2. PDF Reader UI Patterns

### 2.1 Layout Conventions

**Industry Standard Three-Column Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (40-56px height)                                    │
├──────────┬──────────────────────────────────┬───────────────┤
│ Left     │                                  │ Right         │
│ Sidebar  │       Document Viewer            │ Panel         │
│ (nav)    │       (flex: 1)                  │ (context)     │
│ 200-280px│                                  │ 280-320px     │
├──────────┴──────────────────────────────────┴───────────────┤
│ Footer/Status Bar (24-32px height)                          │
└─────────────────────────────────────────────────────────────┘
```

**Reference Widths** (from Adobe Acrobat, Foxit, Apple Preview):

| Element | Default | Min | Max |
|---------|---------|-----|-----|
| Left Sidebar | 280px | 200px | 400px |
| Right Panel | 320px | 240px | 480px |
| Toolbar | 48px | - | - |
| Status Bar | 28px | - | - |

### 2.2 Toolbar Organization

**Standard Layout (left to right)**:

```
[Sidebar Toggle] [File Actions] | [Nav: ← Page → ] | [Zoom Controls] | [Tools] | [Settings ⚙]
```

**Left Group**: Sidebar toggle, Open file
**Center**: Page navigation (prev/input/next), page count
**Right**: Zoom dropdown, tools, settings menu

### 2.3 Zoom Presets

From PDF.js and industry standards:

- Auto (fit document)
- Page Fit (entire page visible)
- **Page Width** (default for reading)
- Actual Size (100%)
- 50%, 75%, 100%, 125%, 150%, 200%, 300%, 400%

### 2.4 TTS/Audio Player UI

**Standard Playback Layout**:

```
┌───────────────────────────────────────────────────────────┐
│  [⏮] [▶/⏸] [⏭]  |  1.0x  |  Voice ▼  |  ···             │
│  ══════════════════●══════════════════════════════════════│
│  00:05:32                                       01:23:45   │
└───────────────────────────────────────────────────────────┘
```

**Key Components**:
- Play/Pause toggle (prominent, center)
- Skip forward/backward (±sentence or ±paragraph)
- Speed control (0.5x - 2.0x)
- Voice selector dropdown
- Progress bar with time indicators

**Reading Position Indication**:
- Sentence highlighting with background color (accent-alpha)
- Auto-scroll to keep highlighted text visible
- Subtle animation when moving between sentences

---

## 3. Accessibility & Keyboard Patterns

### 3.1 WCAG 2.2 Level A Requirements

| Criterion | Requirement | Current State |
|-----------|-------------|---------------|
| 2.1.1 Keyboard | All functionality via keyboard | Partial |
| 2.1.2 No Keyboard Trap | Tab/Escape always work | Missing focus traps in modals |
| 2.4.3 Focus Order | Logical tab sequence | Good |
| 2.4.7 Focus Visible | Visible focus indicator | Missing `--shadow-focus` token |

### 3.2 Recommended Keyboard Shortcuts

**Navigation** (P0 - Essential):

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Next page | `PageDown`, `→` | `PageDown`, `→` |
| Previous page | `PageUp`, `←` | `PageUp`, `←` |
| Go to page | `Ctrl+G` | `Cmd+G` |
| Zoom in | `Ctrl++` | `Cmd++` |
| Zoom out | `Ctrl+-` | `Cmd+-` |
| Fit width | `Ctrl+2` | `Cmd+2` |
| Find | `Ctrl+F` | `Cmd+F` |
| Open file | `Ctrl+O` | `Cmd+O` |

**TTS Controls** (P1):

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Play/Pause | `Space` | `Space` |
| Stop | `Escape` | `Escape` |
| Skip forward | `Ctrl+→` | `Cmd+→` |
| Skip backward | `Ctrl+←` | `Cmd+←` |

**Panels** (P2):

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Toggle sidebar | `F4` | `Cmd+Shift+S` |
| Toggle highlights | `Ctrl+Shift+H` | `Cmd+Shift+H` |

### 3.3 Focus Management Patterns

**Modal Focus Trap**:
```typescript
// 1. Store trigger element
const previousFocus = document.activeElement;

// 2. Focus first interactive element in modal
modalElement.querySelector('button, input')?.focus();

// 3. Trap Tab within modal boundaries
// 4. Escape closes and restores focus
```

**Panel Toggle**:
```typescript
// On open: optionally focus panel header
// On close: return focus to toggle button
```

**Toolbar Navigation**:
- Single Tab stop for entire toolbar
- Arrow keys move between buttons (roving tabindex)
- Enter/Space activates button

### 3.4 ARIA Implementation

**Required Patterns**:

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| `role="toolbar"` | Main toolbar | Roving tabindex |
| `role="dialog"` + `aria-modal` | Settings, exports | Focus trap |
| `aria-live="polite"` | Page changes, zoom | Status announcements |
| `aria-pressed` | Toggle buttons | Sidebar, tool toggles |
| `aria-expanded` | Collapsible panels | Sidebar sections |

---

## 4. Desktop App UX Conventions

### 4.1 Platform Patterns

| Platform | Menu Bar | Title Bar | Shortcuts |
|----------|----------|-----------|-----------|
| macOS | Global (top of screen) | Traffic lights (top-left) | `Cmd+*` |
| Windows | In-window | System buttons (top-right) | `Ctrl+*` |
| Linux | In-window (GTK) | System buttons | `Ctrl+*` |

**Tauri Integration**:
- Use `CommandOrControl` modifier for cross-platform
- Native menu integration available via Tauri menu plugin
- Window state persistence via `@tauri-apps/plugin-window-state`

### 4.2 Command Palette Pattern

```
┌─────────────────────────────────────────┐
│ > Search commands, files...             │
├─────────────────────────────────────────┤
│ Recent                                   │
│   📄 document.pdf                        │
├─────────────────────────────────────────┤
│ Commands                                 │
│   🔍 Find in Document          Ctrl+F   │
│   📤 Export Highlights                   │
│   ⚙️ Open Settings             Ctrl+,   │
└─────────────────────────────────────────┘
```

**Trigger**: `Ctrl+K` / `Cmd+K`

### 4.3 Information Density

**CSS Variable Approach**:

```css
[data-density="compact"] {
  --space-unit: 4px;
  --text-size: 12px;
  --row-height: 28px;
}

[data-density="comfortable"] {
  --space-unit: 8px;
  --text-size: 14px;
  --row-height: 40px;
}
```

### 4.4 Empty States

**Components** (Carbon Design System pattern):
1. **Illustration** (optional): Non-interactive icon
2. **Title**: Positive framing - "Open a document to get started"
3. **Body**: Clear next action
4. **Primary Action**: Button to trigger action
5. **Secondary Action**: Alternative path (e.g., recent docs)

### 4.5 Loading States

**Skeleton Pattern for PDF Loading**:
- Show document structure with placeholder shapes
- Subtle pulse/shimmer animation
- Avoid spinners for content areas

---

## 5. React Component System Patterns

### 5.1 Accessible Primitives

**Recommended Libraries** (for reference):

| Library | Use Case | Notes |
|---------|----------|-------|
| Radix UI | Tooltips, dialogs, dropdowns | Unstyled, accessible |
| Headless UI | Menus, tabs, switches | Tailwind-oriented but works with any CSS |
| React Spectrum | Full design system | Adobe, heavy but comprehensive |

**Current approach**: Custom primitives with design tokens (good, continue this).

### 5.2 Component Composition Pattern

```tsx
// Panel with slots
<Panel
  title="Highlights"
  position="right"
  headerActions={<IconButton icon="close" />}
>
  <HighlightsList />
</Panel>
```

### 5.3 Atomic Design Mapping

| Level | Current Location | Examples |
|-------|-----------------|----------|
| **Atoms** | `src/ui/components/` | Button, IconButton |
| **Molecules** | `src/components/` | PageNavigation, ZoomControls |
| **Organisms** | `src/components/` | Toolbar, HighlightsPanel |
| **Templates** | `src/components/layout/` | AppLayout |
| **Pages** | `src/components/` | PdfViewer, LibraryView |

---

## 6. Tradeoffs & Decisions

### 6.1 Styling Approach

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| CSS Custom Properties (current) | Native, no build, runtime theming | Verbose, no type safety | **Keep** |
| Tailwind CSS | Utility-first, consistent | Learning curve, verbose markup | Not needed |
| CSS-in-JS | Type-safe, scoped | Runtime overhead | Overkill |

**Decision**: Continue with CSS custom properties. Already 92% adopted, works well.

### 6.2 Component Library

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Build custom (current) | Full control, matches tokens | Maintenance burden | **Expand** |
| Adopt Radix | Accessible primitives | Integration effort | Use for complex patterns |
| Full design system | Comprehensive | Heavy, opinion lock-in | Avoid |

**Decision**: Expand custom primitives. Consider Radix for Dialog, Tooltip, Dropdown.

### 6.3 Refactoring Strategy

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Big rewrite | Clean slate | High risk, long time | **Avoid** |
| Incremental slices | Ship value fast | Some inconsistency | **Chosen** |
| Feature flags | Safe rollout | Complexity | For risky changes |

**Decision**: Incremental refactors shipped in slices. Start with token migration and primitive extraction.

---

## 7. Quick Wins vs Larger Efforts

### Quick Wins (1-2 hours each)

| Task | Effort | Impact |
|------|--------|--------|
| Replace hardcoded z-index with tokens | 1h | Consistency |
| Add `--shadow-focus` token | 30m | Accessibility |
| Add `aria-live` region for page announcements | 1h | Screen reader support |
| Document keyboard shortcuts in settings | 1h | Discoverability |

### Medium Refactors (4-8 hours each)

| Task | Effort | Impact |
|------|--------|--------|
| Create `FileDialogAdapter` | 4h | Architecture compliance |
| Extract `Dialog` primitive from export dialogs | 6h | Reusability |
| Add roving tabindex to toolbar | 6h | Keyboard navigation |
| Implement focus traps in modals | 4h | Accessibility |

### Larger Redesign (16+ hours each)

| Task | Effort | Impact |
|------|--------|--------|
| Split `PdfViewer.tsx` (620 lines) | 16h | Maintainability |
| Command palette implementation | 20h | Power user feature |
| Full keyboard shortcut system | 16h | Desktop UX |
| Sidebar redesign (collapsible, resizable) | 24h | Layout polish |

---

## 8. Sources & References

### Official Documentation
- [Tauri v2 Documentation](https://tauri.app/)
- [PDF.js Viewer](https://mozilla.github.io/pdf.js/web/viewer.html)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/)
- [W3C ARIA APG Patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)

### Design Systems
- [Carbon Design System - Empty States](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Microsoft Windows App Design](https://learn.microsoft.com/en-us/windows/apps/design/)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)

### Accessibility
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [W3C ARIA APG Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [W3C ARIA APG Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

### UX Patterns
- [Laws of UX - Fitts's Law](https://lawsofux.com/fittss-law/)
- [Nielsen Norman Group - Icon Usability](https://www.nngroup.com/articles/icon-usability/)
- [Nielsen Norman Group - Progress Indicators](https://www.nngroup.com/articles/progress-indicators/)

---

## 9. Appendix: Current CSS Token Reference

### Colors (`src/ui/tokens/colors.css`)

```css
/* Background */
--color-bg, --color-bg-surface, --color-bg-toolbar, --color-bg-viewer, --color-bg-overlay

/* Text */
--color-text-primary, --color-text-secondary, --color-text-inverse

/* Interactive */
--color-accent, --color-accent-hover, --color-accent-alpha

/* Semantic */
--color-error, --color-warning, --color-success, --color-info

/* UI Elements */
--color-border, --color-border-focus, --color-button-bg, --color-button-bg-hover
```

### Z-Index Layers (`src/ui/tokens/z-index.css`)

```css
--z-base: 0          /* base layer */
--z-canvas: 1        /* PDF canvas */
--z-text-layer: 2    /* text overlay */
--z-highlight: 10    /* user highlights */
--z-dropdown: 50     /* dropdowns */
--z-sticky: 75       /* sticky elements */
--z-floating: 100    /* floating UI */
--z-sidebar: 900     /* sidebars */
--z-modal: 1000      /* modals */
--z-context-menu: 1001
--z-toast: 2000      /* notifications */
```

### Spacing Scale (`src/ui/tokens/spacing.css`)

```css
--space-0: 0
--space-1: 4px       /* Tight spacing */
--space-2: 8px       /* Default gap */
--space-3: 12px      /* Medium spacing */
--space-4: 16px      /* Section spacing */
--space-6: 24px      /* Large spacing */
--space-8: 32px      /* Panel padding */
--space-10: 40px     /* Section breaks */
--space-12: 48px     /* Page margins */
```
