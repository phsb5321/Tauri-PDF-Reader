# Research: UI/UX Patterns for Document Readers

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete

---

## 1. Document Reader Layout Patterns

### 1.1 Sidebar Layouts

**Industry Standards from Major PDF Readers:**

| Application | Left Sidebar Width | Right Panel Width | Collapsible | Resizable |
|-------------|-------------------|-------------------|-------------|-----------|
| Adobe Acrobat | 200-300px | 280-320px | Yes | Yes |
| Apple Preview | 180-240px | N/A | Yes | Yes |
| Foxit Reader | 200-280px | 300px | Yes | Yes |
| Calibre | 200-250px | 280-350px | Yes | Yes |
| Kindle Desktop | 240px | N/A | Yes | No |
| PDF.js (web) | 200px | N/A | Yes | No |

**Decision**: Use 280px for left sidebar (library/navigation), 320px for right panel (highlights/TOC). These match the spec's target layout.

**Rationale**:
- 280px accommodates document titles without excessive truncation
- 320px provides room for annotation content and TOC entries
- Both are within the 200-350px range used by industry leaders

### 1.2 Three-Column Layout Pattern

Most professional document readers follow a three-column layout:

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (40-56px height)                                    │
├──────────┬──────────────────────────────────┬───────────────┤
│ Left     │                                  │ Right         │
│ Sidebar  │       Document Viewer            │ Panel         │
│ (nav)    │       (flex: 1)                  │ (context)     │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│ Footer/Status Bar (24-32px height)                          │
└─────────────────────────────────────────────────────────────┘
```

**Left Sidebar**: Navigation-focused
- Page thumbnails
- Table of contents / bookmarks
- Library / document list
- Search results

**Right Panel**: Context-focused
- Annotations / highlights
- Comments
- Properties
- Attachments

### 1.3 Panel Collapse/Expand Behavior

**Standard Patterns:**
- Toggle buttons in toolbar (icons for left/right panels)
- Keyboard shortcuts: `Ctrl+B` (bookmarks/sidebar), `Ctrl+H` (highlights)
- Animation: 200-300ms ease-out transition
- Collapsed state: Panels shrink to 0 width with border remaining
- State persistence: Remember open/closed state across sessions

### 1.4 Toolbar Placement

**Common Toolbar Layout (left to right):**

```
[File Actions] | [Navigation] | [Title/Document Info] | [View Controls] | [Tools] | [Settings]
```

Standard toolbar height: 40-56px (48px is most common)

**Left Group**: Open, Save, Print, Recent
**Center**: Document title, page navigation (prev/input/next, page count)
**Right**: Zoom controls, view mode, search, settings menu

---

## 2. TTS / Audio Player UI Patterns

### 2.1 Playback Controls

**Industry Standard from Audible, Spotify, Apple Books:**

```
┌───────────────────────────────────────────────────────────┐
│  [Skip Back] [Play/Pause] [Skip Forward]  |  Speed  |  ···│
│  ══════════════════●══════════════════════════════════════│
│  00:05:32                              01:23:45           │
└───────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Play/Pause**: Large, prominent center button (32-48px)
- **Skip controls**: ±10s or ±30s skip buttons
- **Speed control**: Dropdown or popover (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x)
- **Progress bar**: Full-width slider with time indicators
- **Voice selector**: Dropdown when multiple voices available

### 2.2 Reading Position Indication

**Patterns for Text Highlighting:**

1. **Sentence Highlighting** (Kindle, Apple Books)
   - Current sentence highlighted with background color
   - Auto-scroll follows highlighted text
   - Subtle animation when moving between sentences

2. **Word-by-word Karaoke** (some TTS apps)
   - Individual words highlighted as spoken
   - More distracting, use sparingly

3. **Paragraph Indicator** (simpler approach)
   - Current paragraph has left border indicator
   - Less visual noise, easier to implement

**Decision**: Use sentence highlighting with subtle background color (accent-color-alpha), auto-scroll to keep highlighted text visible.

### 2.3 Mini Player vs Full Controls

**Pattern:**
- **Default**: Compact bar at bottom with play/pause, progress, speed
- **Expanded**: Full controls with voice selection, more options
- **Trigger**: Click expand button or settings icon

### 2.4 TTS State Visibility

Users should always know:
1. Is TTS active? (visual indicator when ready)
2. Is it playing or paused? (button state)
3. Where am I in the document? (progress indicator)
4. What voice/speed? (visible in controls)

---

## 3. Keyboard Accessibility Patterns

### 3.1 Standard Document Reader Shortcuts

**Adobe Acrobat / Preview / Foxit Common Shortcuts:**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Open file | `Ctrl+O` | Universal |
| Close | `Ctrl+W` | Universal |
| Print | `Ctrl+P` | Universal |
| Next page | `→` or `Page Down` | In document focus |
| Previous page | `←` or `Page Up` | In document focus |
| Go to page | `Ctrl+G` or `Ctrl+Shift+N` | Opens dialog |
| Zoom in | `Ctrl++` or `Ctrl+=` | Both supported |
| Zoom out | `Ctrl+-` | |
| Actual size | `Ctrl+0` | 100% zoom |
| Fit page | `Ctrl+1` or `Ctrl+Shift+H` | |
| Fit width | `Ctrl+2` or `Ctrl+Shift+W` | |
| Find | `Ctrl+F` | Universal |
| Find next | `F3` or `Enter` | |
| Find previous | `Shift+F3` | |
| Toggle sidebar | `F4` or `Ctrl+B` | |
| Toggle bookmarks | `Ctrl+B` | |
| Settings | `Ctrl+,` | Modern apps |
| Full screen | `F11` | |

**Decision**: Adopt common shortcuts for document navigation. Add TTS-specific shortcuts:
- `Space`: Toggle play/pause (when not in text input)
- `Ctrl+Shift+S`: Start reading from current position

### 3.2 WCAG 2.2 Level A Requirements

**Critical Keyboard Requirements:**

1. **2.1.1 Keyboard**: All functionality operable through keyboard
   - Tab navigates between all interactive elements
   - Enter/Space activates buttons and links
   - Arrow keys work within components (sliders, menus)

2. **2.1.2 No Keyboard Trap**: Focus never gets stuck
   - Escape closes modals and returns focus
   - Tab wraps or exits current container

3. **2.4.1 Bypass Blocks**: Skip repetitive content
   - Skip link to main content (optional for single-page app)
   - Landmark regions (`<main>`, `<nav>`, `<header>`, `<footer>`)

4. **2.4.3 Focus Order**: Logical navigation sequence
   - Tab order follows visual layout (left to right, top to bottom)
   - Focus doesn't jump unexpectedly

5. **2.4.7 Focus Visible**: Keyboard focus indicator always visible
   - Use `:focus-visible` for keyboard-only focus styles
   - High contrast focus ring (2px solid with offset)

### 3.3 Focus Management Rules

**Modal/Dialog:**
```javascript
// On open: focus first interactive element or close button
// Focus trap: Tab cycles within modal
// On close: return focus to triggering element
```

**Panel Toggle:**
```javascript
// On open: focus panel header or first item (optional)
// On close: return focus to toggle button
```

**Page Navigation:**
```javascript
// Keep focus on navigation controls
// Announce page change to screen readers
```

### 3.4 Tab Order Convention

```
1. Skip link (if present)
2. Toolbar (left to right)
3. Left sidebar (if open)
4. Main document viewer
5. Right panel (if open)
6. Footer controls
```

---

## 4. CSS Design Token Best Practices

### 4.1 CSS Custom Properties vs Alternatives

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| CSS Custom Properties | Native, no build, runtime theming | Verbose, no type safety | **Chosen** |
| Tailwind CSS | Utility-first, consistent | Requires build, learning curve | Not needed |
| CSS-in-JS | Type-safe, scoped | Runtime overhead, complexity | Overkill |

**Decision**: CSS custom properties. Native browser support, simple runtime theming, aligns with existing codebase.

### 4.2 Token Naming Conventions

**Semantic over Scale-based:**

```css
/* Prefer semantic names */
--color-text-primary: #1a1a1a;
--color-text-secondary: #666666;
--color-background: #ffffff;
--color-surface: #f8f9fa;
--color-accent: #3b82f6;

/* Avoid pure scale names in component CSS */
--gray-900: #1a1a1a;  /* Bad: requires lookup */
```

**Exception for spacing (scale works well):**
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

### 4.3 Token Organization

**Recommended File Structure:**

```
src/ui/tokens/
├── index.css          # Imports all token files
├── colors.css         # Color tokens (semantic)
├── spacing.css        # Spacing scale
├── typography.css     # Font sizes, weights, line heights
├── radii.css          # Border radius scale
├── shadows.css        # Box shadow scale
├── z-index.css        # Z-index scale
└── motion.css         # Transition durations, easings
```

**Alternative (simpler for small projects):**
Single `tokens.css` file with sections.

**Decision**: Multiple files for maintainability. Easy to find and update specific token types.

### 4.4 Spacing Scale (4px base)

```css
:root {
  --space-0: 0;
  --space-1: 4px;    /* Tight spacing */
  --space-2: 8px;    /* Default gap */
  --space-3: 12px;   /* Medium spacing */
  --space-4: 16px;   /* Section spacing */
  --space-5: 20px;   /* Rarely used */
  --space-6: 24px;   /* Large spacing */
  --space-8: 32px;   /* Panel padding */
  --space-10: 40px;  /* Section breaks */
  --space-12: 48px;  /* Page margins */
}
```

### 4.5 Typography Scale

```css
:root {
  /* Font sizes */
  --text-xs: 12px;
  --text-sm: 14px;    /* Body text default */
  --text-base: 16px;  /* Base size */
  --text-lg: 18px;
  --text-xl: 20px;    /* Headings */
  --text-2xl: 24px;

  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 4.6 Color Token Layers

**Three-layer approach:**

1. **Primitives** (optional, for reference)
   ```css
   --blue-500: #3b82f6;
   --gray-900: #1a1a1a;
   ```

2. **Semantic tokens** (use in components)
   ```css
   --color-text-primary: var(--gray-900);
   --color-accent: var(--blue-500);
   ```

3. **Component tokens** (when needed)
   ```css
   --button-bg: var(--color-surface);
   ```

**Decision**: Use semantic tokens directly. Skip primitives layer for simplicity (project is small). Add component tokens only for complex components.

### 4.7 Light/Dark Theme Pattern

```css
:root {
  /* Light mode (default) */
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #1a1a1a;
    --color-text: #f6f6f6;
    /* ... */
  }
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #f6f6f6;
  /* ... */
}

[data-theme="light"] {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  /* ... */
}
```

**Note**: Current codebase already uses this pattern in App.css.

---

## 5. Collapsible Panel Patterns

### 5.1 Standard Widths

| State | Left Sidebar | Right Panel |
|-------|--------------|-------------|
| Expanded | 280px | 320px |
| Collapsed | 0px | 0px |
| Min resize | 200px | 240px |
| Max resize | 400px | 480px |

### 5.2 Animation Timing

```css
--transition-panel: 200ms ease-out;
```

**Pattern:**
- Use CSS transitions on `width` property
- Optionally use `transform` for smoother animation
- Content should not jump during animation

### 5.3 Toggle Behavior

**Toggle Button States:**
- Default: Outline icon indicating panel can open
- Active: Filled icon indicating panel is open
- Hover: Background highlight

**Keyboard:**
- `Ctrl+B`: Toggle left sidebar
- `Ctrl+H`: Toggle right panel (highlights)
- Focus moves to panel when opened (optional)

---

## 6. Summary of Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Left sidebar width | 280px | Industry standard, accommodates titles |
| Right panel width | 320px | Room for annotations |
| Toolbar height | 48px | Common standard |
| Footer height | 32px | Compact status bar |
| Design tokens | CSS custom properties | Native, simple, existing pattern |
| Token organization | Multiple files | Maintainability |
| Spacing base | 4px | Common scale |
| TTS highlight | Sentence background | Clear but not distracting |
| Panel animation | 200ms ease-out | Smooth but quick |
| Focus style | 2px solid ring | WCAG compliant |

---

## 7. References

- Material Design 3: Navigation Components
- WCAG 2.2 Guidelines
- Adobe Acrobat Keyboard Shortcuts
- Calibre E-book Viewer Manual
- CSS Custom Properties Best Practices (MDN)
