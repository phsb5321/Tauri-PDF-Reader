# Design System Documentation

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete

---

## Overview

This document describes the design system for the Tauri PDF Reader, including design tokens, component library, and usage guidelines.

---

## 1. Design Tokens

Design tokens are CSS custom properties that define the visual language of the application.

### 1.1 Token Files

```
src/ui/tokens/
├── index.css      # Imports all token files
├── colors.css     # Color palette + dark mode
├── spacing.css    # Spacing scale (4px base)
├── typography.css # Font families, sizes, weights
├── radii.css      # Border radius scale
├── shadows.css    # Elevation shadows
├── z-index.css    # Layer management
├── motion.css     # Animation timing
└── layout.css     # Fixed dimensions
```

### 1.2 Color Tokens

| Token | Light Value | Dark Value | Usage |
|-------|------------|------------|-------|
| `--color-bg` | #ffffff | #1a1a1a | Main background |
| `--color-bg-surface` | #f8f9fa | #252525 | Cards, panels |
| `--color-bg-toolbar` | #f8f9fa | #252525 | Toolbar background |
| `--color-bg-viewer` | #e8e8e8 | #1a1a1a | Document viewer |
| `--color-text-primary` | #1a1a1a | #f6f6f6 | Primary text |
| `--color-text-secondary` | #666666 | #999999 | Muted text |
| `--color-text-inverse` | #ffffff | #1a1a1a | Text on accent |
| `--color-accent` | #3b82f6 | #60a5fa | Primary actions |
| `--color-accent-hover` | #2563eb | #93c5fd | Hover state |
| `--color-accent-alpha` | rgba(59,130,246,0.2) | rgba(96,165,250,0.2) | Highlights |
| `--color-border` | #e0e0e0 | #3a3a3a | Borders |
| `--color-error` | #dc2626 | #f87171 | Error states |
| `--color-success` | #10b981 | #34d399 | Success states |
| `--color-warning` | #f59e0b | #fbbf24 | Warning states |

### 1.3 Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Tight spacing |
| `--space-2` | 8px | Default gap |
| `--space-3` | 12px | Medium spacing |
| `--space-4` | 16px | Section spacing |
| `--space-6` | 24px | Large spacing |
| `--space-8` | 32px | Panel padding |
| `--space-12` | 48px | Page margins |

### 1.4 Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | System font stack | Body text |
| `--font-family-mono` | Monospace stack | Code |
| `--text-xs` | 12px | Captions |
| `--text-sm` | 14px | Body text (default) |
| `--text-base` | 16px | Base size |
| `--text-lg` | 18px | Subheadings |
| `--text-xl` | 20px | Headings |
| `--text-2xl` | 24px | Large headings |
| `--font-normal` | 400 | Regular weight |
| `--font-medium` | 500 | Medium weight |
| `--font-semibold` | 600 | Emphasis |
| `--font-bold` | 700 | Strong emphasis |

### 1.5 Layout Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--height-toolbar` | 48px | Toolbar height |
| `--height-footer` | 32px | Footer height |
| `--width-sidebar` | 280px | Left sidebar |
| `--width-panel` | 320px | Right panel |
| `--button-height` | 36px | Default buttons |
| `--button-height-sm` | 28px | Small buttons |
| `--button-height-lg` | 44px | Large buttons |

---

## 2. Components

### 2.1 Button

Primary interactive element for actions.

```tsx
import { Button } from '@/ui/components';

// Primary button
<Button variant="primary">Save</Button>

// Secondary button
<Button variant="secondary">Cancel</Button>

// Ghost button
<Button variant="ghost">Skip</Button>

// With loading state
<Button loading>Saving...</Button>

// Full width
<Button fullWidth>Submit</Button>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `fullWidth` | `boolean` | `false` | Full width |
| `loading` | `boolean` | `false` | Loading state |

### 2.2 IconButton

Square button for icon-only actions.

```tsx
import { IconButton } from '@/ui/components';

<IconButton label="Settings" onClick={openSettings}>
  <SettingsIcon />
</IconButton>

// Active state
<IconButton label="Toggle" active>
  <ToggleIcon />
</IconButton>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Accessible label |
| `variant` | `'default' \| 'primary' \| 'ghost'` | `'default'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `active` | `boolean` | `false` | Active state |

### 2.3 Panel

Collapsible side panel for sidebars.

```tsx
import { Panel } from '@/ui/components';

<Panel
  title="Highlights"
  position="right"
  onClose={() => setOpen(false)}
  headerActions={<ExportButton />}
>
  <HighlightsList />
</Panel>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Panel title |
| `position` | `'left' \| 'right'` | `'right'` | Position |
| `collapsed` | `boolean` | `false` | Collapsed state |
| `onClose` | `() => void` | - | Close handler |
| `headerActions` | `ReactNode` | - | Header actions |
| `width` | `number` | - | Custom width |

### 2.4 EmptyState

Displays when a list or view has no content.

```tsx
import { EmptyState } from '@/ui/components';

<EmptyState
  title="No highlights"
  description="Select text to create your first highlight"
  icon={<HighlightIcon />}
  action={{
    label: 'Learn how',
    onClick: openHelp
  }}
/>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Heading |
| `description` | `string` | - | Body text |
| `icon` | `ReactNode` | - | Icon element |
| `action` | `EmptyStateAction` | - | Primary action |
| `secondaryAction` | `EmptyStateAction` | - | Secondary action |
| `variant` | `'default' \| 'compact'` | `'default'` | Size variant |

### 2.5 ListRow

Flexible list item for highlight lists, document lists, etc.

```tsx
import { ListRow } from '@/ui/components';

<ListRow
  primary="Chapter 1: Introduction"
  secondary="Page 5"
  leading={<BookmarkIcon />}
  onClick={() => goToPage(5)}
/>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `primary` | `string` | required | Main text |
| `secondary` | `string` | - | Secondary text |
| `leading` | `ReactNode` | - | Leading element |
| `trailing` | `ReactNode` | - | Trailing element |
| `metadata` | `ReactNode` | - | Metadata slot |
| `onClick` | `() => void` | - | Click handler |
| `selected` | `boolean` | `false` | Selected state |
| `disabled` | `boolean` | `false` | Disabled state |

### 2.6 Toast

Notification toast for feedback messages.

```tsx
import { Toast } from '@/ui/components';

<Toast
  message="Highlight saved"
  variant="success"
  onClose={() => setToast(null)}
  action={{
    label: 'Undo',
    onClick: undoHighlight
  }}
/>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | required | Toast message |
| `variant` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Visual variant |
| `duration` | `number` | `5000` | Auto-dismiss (ms) |
| `onClose` | `() => void` | - | Close handler |
| `action` | `ToastAction` | - | Action button |

---

## 3. Layout Rules

### 3.1 Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│ TOOLBAR (48px)                                               │
├──────────┬──────────────────────────────────┬───────────────┤
│ LEFT     │                                  │ RIGHT         │
│ SIDEBAR  │       MAIN CONTENT               │ PANEL         │
│ (280px)  │       (flex: 1)                  │ (320px)       │
├──────────┴──────────────────────────────────┴───────────────┤
│ FOOTER (32px)                                                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Spacing Guidelines

- **Tight** (`--space-1`): Between related elements
- **Default** (`--space-2`): Between list items
- **Medium** (`--space-4`): Section spacing
- **Large** (`--space-6`): Major sections
- **Page** (`--space-8`): Panel padding

### 3.3 Focus States

All interactive elements must have visible focus:

```css
.interactive:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

---

## 4. Migration Guide

### 4.1 Old to New Token Mapping

| Old Token | New Token |
|-----------|-----------|
| `--bg-color` | `--color-bg` |
| `--toolbar-bg` | `--color-bg-toolbar` |
| `--viewer-bg` | `--color-bg-viewer` |
| `--border-color` | `--color-border` |
| `--text-color` | `--color-text-primary` |
| `--text-muted` | `--color-text-secondary` |
| `--accent-color` | `--color-accent` |
| `--accent-color-alpha` | `--color-accent-alpha` |
| `--error-color` | `--color-error` |
| `--button-bg` | `--color-button-bg` |
| `--button-hover-bg` | `--color-button-bg-hover` |
| `--input-bg` | `--color-input-bg` |

### 4.2 Migration Steps

1. Import new tokens: `@import '../ui/tokens/index.css';`
2. Update CSS to use new token names
3. Replace hardcoded values with tokens
4. Test in both light and dark modes

---

## 5. Keyboard Shortcuts

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+O` | Open file | File |
| `Ctrl+,` | Open settings | Navigation |
| `Ctrl+H` | Toggle highlights | Navigation |
| `Ctrl+B` | Toggle sidebar | Navigation |
| `Escape` | Close modal/panel | Navigation |
| `Space` | Play/Pause TTS | Playback |
| `←/→` | Navigate pages | Document |
| `Ctrl++/-` | Zoom in/out | View |

---

## 6. Validation

### Validated Component: Toolbar

The Toolbar component (`src/components/Toolbar.tsx`) was refactored as a validation slice to demonstrate the design system in practice.

#### Changes Made

**Before (Legacy Tokens)**:
```css
/* Old approach */
background: var(--toolbar-bg);
border-bottom: 1px solid var(--border-color);
color: var(--text-color);
font-size: 0.875rem;
gap: 0.5rem;
```

**After (Design System Tokens)**:
```css
/* New approach */
background: var(--color-bg-toolbar);
border-bottom: 1px solid var(--color-border);
color: var(--color-text-primary);
font-size: var(--text-sm);
gap: var(--space-2);
```

#### Key Improvements

1. **Consistent spacing**: All gaps and padding use spacing tokens
2. **Focus states**: Added `:focus-visible` with `--shadow-focus`
3. **Typography**: Font sizes use typography tokens
4. **Transitions**: Use `--transition-fast` instead of hardcoded values

#### Backward Compatibility

The `App.css` file now maps legacy tokens to new tokens:
```css
/* Legacy aliases */
--toolbar-bg: var(--color-bg-toolbar);
--border-color: var(--color-border);
```

This allows gradual migration without breaking existing components.

### Screenshots

> Note: Screenshots require running the application (`pnpm tauri dev`).

| Screen | Before | After |
|--------|--------|-------|
| Toolbar (Light) | `docs/ui/screenshots/validation-before.png` | `docs/ui/screenshots/validation-after.png` |
| Toolbar (Dark) | - | - |

### Lessons Learned

1. **Token aliases help migration**: Mapping old tokens to new ones reduces refactoring scope
2. **Focus states are essential**: Every interactive element needs `:focus-visible`
3. **Spacing tokens improve consistency**: Using `--space-*` prevents magic numbers
4. **Transitions should use tokens**: `--transition-fast` is more maintainable than `0.15s ease`

### Checklist

- [X] All colors use tokens
- [X] All spacing uses tokens
- [X] Focus states are visible
- [X] Dark mode works correctly (via token system)
- [X] Components render properly

---

## 7. Quick Reference

```css
/* Common patterns */

/* Button with token styling */
.my-button {
  height: var(--button-height);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-text-inverse);
  transition: all var(--transition-fast);
}

/* Panel with token styling */
.my-panel {
  width: var(--width-panel);
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  padding: var(--space-4);
}

/* Focus state */
.my-interactive:focus-visible {
  box-shadow: var(--shadow-focus);
}
```
