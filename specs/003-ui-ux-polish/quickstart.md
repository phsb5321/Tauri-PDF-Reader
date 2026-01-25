# Quickstart: UI/UX Polish Design System

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13

---

## Overview

This quickstart guide helps developers understand and use the design system tokens for the Tauri PDF Reader. The design system provides consistent visual language through CSS custom properties.

---

## 1. Setup

### Import Tokens

Add to your main CSS file (e.g., `src/styles/index.css`):

```css
@import '../ui/tokens/index.css';
```

The token index file imports all token categories in the correct order.

---

## 2. Using Tokens

### Colors

```css
/* Background */
.panel {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

/* Text */
.heading {
  color: var(--color-text-primary);
}

.caption {
  color: var(--color-text-secondary);
}

/* Interactive */
.button {
  background: var(--color-accent);
  color: var(--color-text-inverse);
}

.button:hover {
  background: var(--color-accent-hover);
}

/* Semantic */
.error {
  color: var(--color-error);
}
```

### Spacing

```css
/* Padding and margins */
.card {
  padding: var(--space-4);        /* 16px */
  margin-bottom: var(--space-2);  /* 8px */
}

/* Gap */
.button-group {
  display: flex;
  gap: var(--space-2);  /* 8px */
}

/* Common patterns */
.tight { gap: var(--space-1); }    /* 4px */
.default { gap: var(--space-2); }  /* 8px */
.relaxed { gap: var(--space-4); }  /* 16px */
```

### Typography

```css
.body {
  font-size: var(--text-sm);        /* 14px */
  line-height: var(--leading-normal); /* 1.5 */
  font-weight: var(--font-normal);  /* 400 */
}

.heading {
  font-size: var(--text-xl);        /* 20px */
  font-weight: var(--font-semibold); /* 600 */
}

.caption {
  font-size: var(--text-xs);        /* 12px */
}
```

### Border Radius

```css
.button {
  border-radius: var(--radius-md);  /* 8px */
}

.avatar {
  border-radius: var(--radius-full);  /* circular */
}

.card {
  border-radius: var(--radius-lg);  /* 12px */
}
```

### Shadows

```css
.dropdown {
  box-shadow: var(--shadow-md);
}

.modal {
  box-shadow: var(--shadow-lg);
}

/* Focus state */
.button:focus-visible {
  box-shadow: var(--shadow-focus);
}
```

### Z-Index

```css
.toolbar {
  z-index: var(--z-sticky);
}

.dropdown {
  z-index: var(--z-dropdown);
}

.modal {
  z-index: var(--z-modal);
}

.toast {
  z-index: var(--z-toast);
}
```

### Motion / Animation

```css
.panel {
  transition: width var(--duration-normal) var(--easing-default);
}

.button {
  transition: background var(--duration-fast) var(--easing-default);
}
```

### Layout

```css
.sidebar {
  width: var(--width-sidebar);  /* 280px */
  min-width: var(--width-sidebar-min);  /* 200px */
  max-width: var(--width-sidebar-max);  /* 400px */
}

.panel {
  width: var(--width-panel);  /* 320px */
}

.toolbar {
  height: var(--height-toolbar);  /* 48px */
}

.footer {
  height: var(--height-footer);  /* 32px */
}
```

---

## 3. Dark Mode

Tokens automatically switch in dark mode. No code changes needed!

The system respects:
1. System preference (`prefers-color-scheme`)
2. User override (`data-theme="dark"` or `data-theme="light"`)

```css
/* This works in both light and dark mode */
.panel {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}
```

---

## 4. Common Patterns

### Card Component

```css
.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

### Button

```css
.button {
  height: var(--button-height);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast) var(--easing-default);
}

.button-primary {
  background: var(--color-accent);
  color: var(--color-text-inverse);
}

.button-primary:hover {
  background: var(--color-accent-hover);
}

.button:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

### Input Field

```css
.input {
  height: var(--input-height);
  padding: 0 var(--space-3);
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.input:focus {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-focus);
}
```

### Collapsible Panel

```css
.sidebar {
  width: var(--width-sidebar);
  transition: width var(--duration-normal) var(--easing-default);
}

.sidebar.collapsed {
  width: 0;
  overflow: hidden;
}
```

---

## 5. Accessibility Focus Styles

Always provide visible focus indicators:

```css
/* Use :focus-visible for keyboard-only focus */
.interactive:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Or use shadow approach */
.button:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

---

## 6. Don'ts

### Don't use magic numbers

```css
/* Bad */
.panel {
  padding: 13px;
  margin: 7px;
}

/* Good */
.panel {
  padding: var(--space-3);  /* 12px */
  margin: var(--space-2);   /* 8px */
}
```

### Don't hardcode colors

```css
/* Bad */
.text {
  color: #666666;
}

/* Good */
.text {
  color: var(--color-text-secondary);
}
```

### Don't mix old and new tokens

```css
/* Bad - mixing token systems */
.panel {
  background: var(--bg-color);        /* Old */
  color: var(--color-text-primary);   /* New */
}

/* Good - use new tokens consistently */
.panel {
  background: var(--color-bg);
  color: var(--color-text-primary);
}
```

---

## 7. Quick Reference

| Category | Common Tokens |
|----------|---------------|
| **Background** | `--color-bg`, `--color-bg-surface`, `--color-bg-toolbar` |
| **Text** | `--color-text-primary`, `--color-text-secondary` |
| **Interactive** | `--color-accent`, `--color-accent-hover` |
| **Spacing** | `--space-1` (4px) through `--space-12` (48px) |
| **Typography** | `--text-sm` (14px), `--text-base` (16px), `--text-xl` (20px) |
| **Radius** | `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px) |
| **Shadow** | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-focus` |
| **Animation** | `--duration-fast` (150ms), `--duration-normal` (250ms) |
| **Layout** | `--width-sidebar` (280px), `--width-panel` (320px) |

---

## 8. File Locations

- **Token definitions**: `src/ui/tokens/`
- **Component styles**: `src/ui/components/[ComponentName]/`
- **Global styles**: `src/styles/`

---

## Next Steps

1. Review existing components for token adoption
2. Create new components using the design system
3. Run accessibility checks on updated components
4. Document any component-specific tokens needed
