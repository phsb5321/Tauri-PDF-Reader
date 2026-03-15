# UI/UX Design Specification

**Feature**: 007-ui-ux-overhaul  
**Version**: 1.0  
**Date**: 2026-02-01  
**Status**: Draft

---

## 1. Design Goals & Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Clarity** | Every element has a clear purpose | Labels on icons, obvious affordances |
| **Density Control** | Balance information with breathing room | Consistent spacing scale |
| **Discoverability** | Features are findable without documentation | Tooltips, command palette |
| **Keyboard-First** | Full functionality without mouse | Comprehensive shortcuts |
| **Consistency** | Same patterns everywhere | Shared primitives, token system |
| **Accessibility** | WCAG 2.2 Level A minimum | Focus visible, ARIA, screen reader support |

### 1.2 Design Constraints

- **No "big rewrite"**: Incremental improvements shipped in slices
- **Architecture preservation**: UI layer stays thin, no direct `invoke()` calls
- **Desktop-first**: Mouse + keyboard primary, touch secondary
- **Cross-platform**: Windows, macOS, Linux parity

### 1.3 Target User Profiles

| Profile | Needs | Priority |
|---------|-------|----------|
| **Keyboard Power User** | Fast navigation, shortcuts, command palette | P0 |
| **Screen Reader User** | ARIA landmarks, announcements, focus management | P1 |
| **Visual Reader** | Clear hierarchy, comfortable reading, highlight tools | P0 |
| **Audio Reader** | TTS controls, playback progress, voice selection | P0 |

---

## 2. Layout Blueprint

### 2.1 Application Shell

```
┌─────────────────────────────────────────────────────────────────────┐
│ Toolbar (48px)                                                       │
│ [☰] [Open] [Title ▼] │ [◀ Page 1/10 ▶] │ [🔍 100% ▼] │ [Tools] [⚙]│
├──────────┬──────────────────────────────────────────┬───────────────┤
│ Left     │                                          │ Right         │
│ Sidebar  │                                          │ Panel         │
│ (280px)  │         PDF Viewer                       │ (320px)       │
│          │         (flex: 1)                        │               │
│ Library  │                                          │ Highlights    │
│ TOC      │         Scrollable                       │ Notes         │
│ Thumbs   │         Paginated                        │ Bookmarks     │
│          │                                          │               │
├──────────┴──────────────────────────────────────────┴───────────────┤
│ Playback Bar (48px) - TTS Controls                                   │
│ [⏮] [▶/⏸] [⏭] ══════════●════════════════ 1.0x │ Voice ▼ │ [···]│
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layout Dimensions

| Element | Default | Min | Max | Collapsible |
|---------|---------|-----|-----|-------------|
| Toolbar | 48px | - | - | No |
| Left Sidebar | 280px | 200px | 400px | Yes (to 0px) |
| Right Panel | 320px | 240px | 480px | Yes (to 0px) |
| Playback Bar | 48px | - | - | Auto-hide when no doc |
| Status Bar (future) | 28px | - | - | Optional |

### 2.3 Responsive Behavior

| Window Width | Left Sidebar | Right Panel |
|--------------|--------------|-------------|
| < 800px | Hidden (overlay) | Hidden (overlay) |
| 800-1200px | Collapsed (icons) | Hidden |
| > 1200px | Expanded | Collapsible |

### 2.4 Panel States

```
┌─────────────────┐     ┌─────────────────┐     ┌───┐
│ Expanded        │     │ Collapsed       │     │ X │
│                 │     │ (icons only)    │     └───┘
│ Full content    │  →  │ 48px width      │  →  Hidden
│ Labels visible  │     │ Tooltips on     │     Overlay mode
│                 │     │ hover           │
└─────────────────┘     └─────────────────┘
```

---

## 3. Visual System

### 3.1 Spacing Scale (4px base)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | Flush alignment |
| `--space-1` | 4px | Tight grouping, icon padding |
| `--space-2` | 8px | Default gap, button padding |
| `--space-3` | 12px | Medium spacing |
| `--space-4` | 16px | Section spacing, panel padding |
| `--space-6` | 24px | Large spacing |
| `--space-8` | 32px | Major section breaks |
| `--space-10` | 40px | Page-level margins |
| `--space-12` | 48px | Extra large (toolbar height) |

### 3.2 Typography Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 12px | Captions, timestamps, badges |
| `--text-sm` | 14px | Body text (default), buttons |
| `--text-base` | 16px | Large body, input text |
| `--text-lg` | 18px | Section headers |
| `--text-xl` | 20px | Panel titles |
| `--text-2xl` | 24px | Page titles |

**Line Heights**:
| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.25 | Headings |
| `--leading-normal` | 1.5 | Body text |
| `--leading-relaxed` | 1.75 | Long-form reading |

**Font Weights**:
| Token | Value | Usage |
|-------|-------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Labels, buttons |
| `--font-semibold` | 600 | Section headers |
| `--font-bold` | 700 | Emphasis, headings |

### 3.3 Color Tokens

**Semantic Colors** (light/dark adaptive):

| Token | Usage |
|-------|-------|
| `--color-bg` | App background |
| `--color-bg-surface` | Cards, panels |
| `--color-bg-toolbar` | Toolbar background |
| `--color-bg-viewer` | PDF viewer area |
| `--color-bg-overlay` | Modal overlays |
| `--color-text-primary` | Main text |
| `--color-text-secondary` | Muted text |
| `--color-text-inverse` | Text on accent |
| `--color-accent` | Primary actions, links |
| `--color-accent-hover` | Hover state |
| `--color-accent-alpha` | Highlight overlays |
| `--color-border` | Subtle borders |
| `--color-border-focus` | Focus rings |
| `--color-error` | Error states |
| `--color-warning` | Warning states |
| `--color-success` | Success states |
| `--color-info` | Informational |

**Highlight Colors** (user-selectable):

| Color | Light Mode | Dark Mode |
|-------|------------|-----------|
| Yellow | `#fef08a` | `#fef08a` |
| Green | `#bbf7d0` | `#bbf7d0` |
| Blue | `#bfdbfe` | `#bfdbfe` |
| Pink | `#fbcfe8` | `#fbcfe8` |
| Orange | `#fed7aa` | `#fed7aa` |

### 3.4 Elevation & Shadows

| Token | Usage | CSS Value |
|-------|-------|-----------|
| `--shadow-sm` | Cards, subtle lift | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-md` | Dropdowns, panels | `0 4px 6px rgba(0,0,0,0.1)` |
| `--shadow-lg` | Modals, dialogs | `0 10px 15px rgba(0,0,0,0.1)` |
| `--shadow-xl` | Popovers | `0 20px 25px rgba(0,0,0,0.15)` |
| `--shadow-focus` | Focus ring | `0 0 0 2px var(--color-accent-alpha)` |
| `--shadow-inset` | Pressed states | `inset 0 2px 4px rgba(0,0,0,0.06)` |

### 3.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0 | Sharp corners |
| `--radius-sm` | 4px | Buttons, inputs |
| `--radius-md` | 8px | Cards, panels |
| `--radius-lg` | 12px | Modals |
| `--radius-xl` | 16px | Large containers |
| `--radius-full` | 9999px | Pills, avatars |

### 3.6 Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default layer |
| `--z-canvas` | 1 | PDF canvas |
| `--z-text-layer` | 2 | Text overlay |
| `--z-highlight` | 10 | User highlights |
| `--z-dropdown` | 50 | Dropdown menus |
| `--z-sticky` | 75 | Sticky headers |
| `--z-floating` | 100 | Floating toolbar |
| `--z-sidebar` | 900 | Sidebars |
| `--z-modal` | 1000 | Modal dialogs |
| `--z-context-menu` | 1001 | Context menus |
| `--z-toast` | 2000 | Toast notifications |
| `--z-extreme` | 99999 | TTS word highlight |

### 3.7 Motion & Transitions

| Token | Duration | Usage |
|-------|----------|-------|
| `--transition-fast` | 150ms | Hover states, toggles |
| `--transition-normal` | 250ms | Panel expand/collapse |
| `--transition-slow` | 400ms | Page transitions |

**Easing Functions**:
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter animations |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations |

---

## 4. Component Specifications

### 4.1 Primitives (Atoms)

#### Button

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children: ReactNode;
  onClick?: () => void;
}
```

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 28px | 8px 12px | 12px |
| md | 36px | 8px 16px | 14px |
| lg | 44px | 12px 20px | 16px |

**States**: default, hover, active, disabled, loading

#### IconButton

```typescript
interface IconButtonProps {
  icon: ReactNode;
  label: string; // Required for a11y
  variant: 'default' | 'primary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}
```

| Size | Dimensions | Icon Size |
|------|------------|-----------|
| sm | 28x28px | 16px |
| md | 36x36px | 20px |
| lg | 44x44px | 24px |

#### Panel

```typescript
interface PanelProps {
  title?: string;
  position: 'left' | 'right';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsed?: boolean;
  collapsible?: boolean;
  resizable?: boolean;
  headerActions?: ReactNode;
  onClose?: () => void;
  onCollapse?: () => void;
  onResize?: (width: number) => void;
  children: ReactNode;
}
```

**Behavior**:
- Collapse animation: 250ms ease-out
- Keyboard: `Escape` closes panel
- Focus: Return to toggle button on close

#### Dialog / Modal

```typescript
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}
```

| Size | Width |
|------|-------|
| sm | 400px |
| md | 500px |
| lg | 600px |
| xl | 800px |

**Accessibility**:
- `role="dialog"` + `aria-modal="true"`
- `aria-labelledby` pointing to title
- Focus trap inside dialog
- Return focus on close

#### Toast

```typescript
interface ToastProps {
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // ms, 0 for persistent
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}
```

**Behavior**:
- Position: bottom-right
- Stack: newest on top
- Animation: slide in from right
- Auto-dismiss: 5000ms default

#### EmptyState

```typescript
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  variant: 'default' | 'compact';
}
```

#### ListRow

```typescript
interface ListRowProps {
  primary: string;
  secondary?: string;
  leading?: ReactNode; // icon or thumbnail
  trailing?: ReactNode; // actions or metadata
  metadata?: string; // e.g., "Page 5"
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}
```

### 4.2 Composites (Molecules/Organisms)

#### Toolbar

**Structure**:
```
┌─[Left Group]──────────┬─[Center Group]────────────┬─[Right Group]─────────┐
│ [☰] [Open] [Recent ▼] │ [◀] [Page 1/10] [▶]       │ [🔍 100%▼] [⚙] [···] │
└───────────────────────┴───────────────────────────┴───────────────────────┘
```

**Behavior**:
- Single Tab stop (roving tabindex within)
- Arrow keys navigate between buttons
- `role="toolbar"` + `aria-label`

#### PageNavigation

```typescript
interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}
```

**Elements**: Previous button, page input, "of X" label, Next button

#### ZoomControls

```typescript
interface ZoomControlsProps {
  zoom: number; // percentage
  presets: number[];
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
}
```

**Presets**: Auto, Fit Page, Fit Width, 50%, 75%, 100%, 125%, 150%, 200%

#### PlaybackBar

**Structure**:
```
┌─[Controls]──────────────────────────────────────────────────────────────────┐
│ [⏮] [▶/⏸] [⏭]  [0:00 / 5:32]  ════════●══════════════  [1.0x] [Voice ▼] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Play/Pause: `Space` key
- Skip: `Ctrl+Arrow` keys
- Speed: Dropdown with 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x

#### HighlightsPanel

```typescript
interface HighlightsPanelProps {
  highlights: Highlight[];
  groupBy: 'page' | 'color' | 'date';
  onHighlightClick: (id: string) => void;
  onHighlightDelete: (id: string) => void;
  onExport: () => void;
}
```

**Features**:
- Group by page, color, or date
- Search/filter highlights
- Bulk export (Markdown, JSON)
- Click to navigate to highlight

#### CommandPalette (Future)

**Structure**:
```
┌─────────────────────────────────────────────────┐
│ > Type to search...                        [×]  │
├─────────────────────────────────────────────────┤
│ Recent                                          │
│   📄 Document.pdf                               │
├─────────────────────────────────────────────────┤
│ Commands                                        │
│   🔍 Find in Document              Ctrl+F      │
│   📤 Export Highlights                         │
│   ⚙️ Open Settings                 Ctrl+,      │
└─────────────────────────────────────────────────┘
```

**Trigger**: `Ctrl+K` / `Cmd+K`

---

## 5. Interaction Rules

### 5.1 Loading States

| Context | Pattern | Duration Threshold |
|---------|---------|-------------------|
| Document opening | Skeleton + progress | Show after 500ms |
| Page rendering | Placeholder shimmer | Show immediately |
| TTS generation | Inline spinner | Show after 200ms |
| Export | Progress bar + percent | Show immediately |
| Button action | Loading spinner in button | Show after 150ms |

**Skeleton Structure**:
```
┌─────────────────────────────────────────┐
│ ████████████████████████████            │  <- Heading
│ ██████████████████████████████████████  │  <- Paragraph
│ ████████████████████████████████████    │
│ ██████████████████                      │
│                                         │
│ ████████████████████████████            │
│ ██████████████████████████████████████  │
└─────────────────────────────────────────┘
```

### 5.2 Error States

| Error Type | UI Treatment | Actions |
|------------|--------------|---------|
| File not found | EmptyState with icon | "Browse for file", "Remove from recent" |
| Permission denied | Dialog with explanation | "Grant access", "Choose different file" |
| Corrupt PDF | EmptyState with warning | "Try different file", "Report issue" |
| TTS unavailable | Inline banner | "Retry", "Check settings" |
| Network error | Toast with retry | "Retry" action |

**Error Message Format**:
```
[Icon] Brief Description

More details about what happened and why.

[Primary Action]  [Secondary Action]
```

### 5.3 Empty States

| Context | Title | Description | Action |
|---------|-------|-------------|--------|
| No document | "Open a PDF to get started" | "Drag and drop a file here, or click the button below." | "Open PDF" |
| No highlights | "No highlights yet" | "Select text and click Highlight to mark important passages." | "Learn more" |
| No search results | "No results found" | "Try different keywords or clear filters." | "Clear search" |
| No recent files | "No recent documents" | "Files you open will appear here for quick access." | "Open PDF" |

### 5.4 Toast Notifications

| Event | Variant | Message |
|-------|---------|---------|
| Highlight created | success | "Highlight added" |
| Highlight deleted | info | "Highlight removed" |
| Export complete | success | "Export saved to Downloads" |
| TTS error | error | "Could not play audio" + Retry action |
| Settings saved | success | "Settings updated" |

### 5.5 Confirmations

**Destructive Actions** (require confirmation):
- Delete all highlights
- Remove document from library
- Clear recent files

**Pattern**:
```
┌─────────────────────────────────────────┐
│ Delete all highlights?                  │
│                                         │
│ This will permanently remove 15         │
│ highlights from "Document.pdf".         │
│ This action cannot be undone.           │
│                                         │
│              [Cancel]  [Delete]         │
└─────────────────────────────────────────┘
```

### 5.6 Focus Management

| Event | Focus Action |
|-------|--------------|
| App load | Focus "Open" button in toolbar |
| Modal open | Focus first interactive element (or close button) |
| Modal close | Return focus to trigger element |
| Panel open | Optionally focus panel header |
| Panel close | Return focus to toggle button |
| Page change | Keep focus on navigation controls |
| Toast appears | Announce via `aria-live` (no focus change) |

---

## 6. Accessibility Requirements

### 6.1 WCAG 2.2 Level A Compliance

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| 2.1.1 | Keyboard operability | All actions via keyboard |
| 2.1.2 | No keyboard trap | Tab/Escape always work |
| 2.4.3 | Focus order | Logical left-to-right, top-to-bottom |
| 2.4.7 | Focus visible | 2px focus ring, `--shadow-focus` |
| 4.1.2 | Name, role, value | ARIA labels on all controls |

### 6.2 Keyboard Shortcuts

**Essential (P0)**:

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open file | `Ctrl+O` | `Cmd+O` |
| Find | `Ctrl+F` | `Cmd+F` |
| Next page | `→`, `PageDown` | `→`, `PageDown` |
| Previous page | `←`, `PageUp` | `←`, `PageUp` |
| Zoom in | `Ctrl++` | `Cmd++` |
| Zoom out | `Ctrl+-` | `Cmd+-` |
| Play/Pause TTS | `Space` | `Space` |
| Close dialog | `Escape` | `Escape` |

**Important (P1)**:

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Go to page | `Ctrl+G` | `Cmd+G` |
| Fit width | `Ctrl+2` | `Cmd+2` |
| Toggle sidebar | `F4` | `Cmd+Shift+S` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Skip TTS forward | `Ctrl+→` | `Cmd+→` |
| Skip TTS backward | `Ctrl+←` | `Cmd+←` |

**Nice-to-have (P2)**:

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Command palette | `Ctrl+K` | `Cmd+K` |
| Highlight selection | `Ctrl+H` | `Cmd+H` |
| Toggle highlights panel | `Ctrl+Shift+H` | `Cmd+Shift+H` |
| Fullscreen | `F11` | `Cmd+Ctrl+F` |

### 6.3 ARIA Implementation

**Landmarks**:
```html
<header role="banner">Toolbar</header>
<nav role="navigation">Left Sidebar</nav>
<main role="main">PDF Viewer</main>
<aside role="complementary">Right Panel</aside>
<footer role="contentinfo">Playback Bar</footer>
```

**Live Regions**:
```html
<div role="status" aria-live="polite" class="sr-only">
  <!-- Page changes, zoom level announced here -->
</div>
```

**Toolbar Pattern**:
```html
<div role="toolbar" aria-label="Document tools" aria-orientation="horizontal">
  <button tabindex="0">Open</button>
  <button tabindex="-1">Save</button>
  <button tabindex="-1">Print</button>
</div>
```

---

## 7. Do/Don't Guidelines

### Do

| Category | Guideline |
|----------|-----------|
| **Tokens** | Always use design tokens for spacing, colors, z-index |
| **Icons** | Pair icons with visible text labels (or aria-label) |
| **Focus** | Ensure all interactive elements have visible focus states |
| **Feedback** | Show immediate feedback for user actions (toast, state change) |
| **Loading** | Show loading state after 200ms, never leave UI frozen |
| **Errors** | Provide clear error messages with recovery actions |
| **Keyboard** | Support keyboard alternatives for all mouse interactions |
| **Consistency** | Use primitives from `src/ui/components/` |

### Don't

| Category | Guideline |
|----------|-----------|
| **Tokens** | Don't hardcode colors, spacing, or z-index values |
| **Icons** | Don't use icon-only buttons without accessible labels |
| **Focus** | Don't remove focus outlines without replacement |
| **Feedback** | Don't leave users guessing about action results |
| **Loading** | Don't show spinners for actions under 200ms |
| **Errors** | Don't show cryptic error codes without explanation |
| **Keyboard** | Don't create keyboard traps in modals/panels |
| **Consistency** | Don't create one-off button or panel styles |

### Component Conventions

| Convention | Rule |
|------------|------|
| **File names** | PascalCase for components: `Button.tsx`, `IconButton.tsx` |
| **CSS files** | Co-located: `Button.css` next to `Button.tsx` |
| **Props** | Export interface: `export type ButtonProps = {...}` |
| **Default props** | Use default parameters, not `defaultProps` |
| **Ref forwarding** | Use `forwardRef` for all primitives |
| **Testing** | Co-located test file: `Button.test.tsx` |

### Styling Conventions

| Convention | Rule |
|------------|------|
| **Selectors** | BEM-like: `.button`, `.button--primary`, `.button__icon` |
| **Token usage** | Always: `var(--space-4)` not `16px` |
| **Fallbacks** | Optional but defensive: `var(--space-4, 16px)` |
| **Dark mode** | Use color tokens, not media queries in components |
| **Transitions** | Use motion tokens: `var(--transition-fast)` |

---

## 8. Migration Path

### Phase 1: Foundation (Week 1-2)
- [ ] Complete token migration (replace hardcoded values)
- [ ] Add `--shadow-focus` token
- [ ] Add `--z-extreme` token
- [ ] Create `FileDialogAdapter`

### Phase 2: Primitives (Week 3-4)
- [ ] Extract `Dialog` primitive
- [ ] Extract `Tooltip` primitive
- [ ] Extract `ProgressBar` primitive
- [ ] Add Storybook for UI primitives

### Phase 3: Accessibility (Week 5-6)
- [ ] Implement roving tabindex in Toolbar
- [ ] Add focus traps to modals
- [ ] Add `aria-live` regions
- [ ] Implement keyboard shortcuts

### Phase 4: Polish (Week 7-8)
- [ ] Refactor `PdfViewer.tsx` (split responsibilities)
- [ ] Implement empty states consistently
- [ ] Add loading skeletons
- [ ] Command palette (if time permits)

---

## 9. Appendix: Token Reference

### Quick Reference Card

```css
/* Spacing */
--space-1: 4px    /* tight */
--space-2: 8px    /* default gap */
--space-4: 16px   /* section */
--space-8: 32px   /* panel */

/* Typography */
--text-sm: 14px   /* body */
--text-lg: 18px   /* section header */
--text-xl: 20px   /* panel title */

/* Radius */
--radius-sm: 4px  /* buttons */
--radius-md: 8px  /* cards */
--radius-lg: 12px /* modals */

/* Transitions */
--transition-fast: 150ms   /* hover */
--transition-normal: 250ms /* expand */

/* Z-Index */
--z-dropdown: 50
--z-modal: 1000
--z-toast: 2000
```

### Component Size Reference

| Component | Small | Medium | Large |
|-----------|-------|--------|-------|
| Button | 28px | 36px | 44px |
| IconButton | 28×28 | 36×36 | 44×44 |
| Input | 28px | 36px | 44px |
| Select | 28px | 36px | 44px |
