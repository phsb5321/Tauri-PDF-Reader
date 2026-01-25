# Data Model: Design System Tokens

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Draft

---

## 1. Overview

This document defines the design token schema for the UI/UX polish feature. Unlike typical data models with database entities, this feature's "data" consists of CSS custom properties (design tokens) that define the visual language of the application.

---

## 2. Token Schema

### 2.1 Color Tokens

```typescript
interface ColorTokens {
  // Background colors
  bg: string;           // Main background
  bgSurface: string;    // Cards, panels
  bgToolbar: string;    // Toolbar background
  bgViewer: string;     // Document viewer area
  bgOverlay: string;    // Modal overlays

  // Text colors
  textPrimary: string;  // Primary text
  textSecondary: string; // Muted text
  textInverse: string;  // Text on dark backgrounds

  // Interactive colors
  accent: string;       // Primary actions
  accentHover: string;  // Accent hover state
  accentAlpha: string;  // Transparent accent (highlights)

  // Semantic colors
  error: string;        // Error states
  warning: string;      // Warning states
  success: string;      // Success states
  info: string;         // Info states

  // UI element colors
  border: string;       // Borders, dividers
  borderFocus: string;  // Focus ring color
  buttonBg: string;     // Button background
  buttonBgHover: string; // Button hover
  inputBg: string;      // Input fields
}
```

**CSS Implementation:**

```css
:root {
  /* Background */
  --color-bg: #ffffff;
  --color-bg-surface: #f8f9fa;
  --color-bg-toolbar: #f8f9fa;
  --color-bg-viewer: #e8e8e8;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  /* Text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-inverse: #ffffff;

  /* Interactive */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-accent-alpha: rgba(59, 130, 246, 0.2);

  /* Semantic */
  --color-error: #dc2626;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-info: #3b82f6;

  /* UI Elements */
  --color-border: #e0e0e0;
  --color-border-focus: #3b82f6;
  --color-button-bg: #ffffff;
  --color-button-bg-hover: #f0f0f0;
  --color-input-bg: #ffffff;
}
```

### 2.2 Spacing Tokens

```typescript
interface SpacingTokens {
  space0: string;   // 0
  space1: string;   // 4px - tight
  space2: string;   // 8px - default
  space3: string;   // 12px - medium
  space4: string;   // 16px - section
  space5: string;   // 20px
  space6: string;   // 24px - large
  space8: string;   // 32px - panel
  space10: string;  // 40px
  space12: string;  // 48px - page
}
```

**CSS Implementation:**

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

### 2.3 Typography Tokens

```typescript
interface TypographyTokens {
  // Font family
  fontFamily: string;
  fontFamilyMono: string;

  // Font sizes
  textXs: string;    // 12px
  textSm: string;    // 14px (body)
  textBase: string;  // 16px
  textLg: string;    // 18px
  textXl: string;    // 20px (heading)
  text2xl: string;   // 24px

  // Line heights
  leadingTight: number;   // 1.25
  leadingNormal: number;  // 1.5
  leadingRelaxed: number; // 1.75

  // Font weights
  fontNormal: number;   // 400
  fontMedium: number;   // 500
  fontSemibold: number; // 600
  fontBold: number;     // 700
}
```

**CSS Implementation:**

```css
:root {
  /* Font families */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, Consolas, monospace;

  /* Font sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
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

### 2.4 Border Radius Tokens

```typescript
interface RadiusTokens {
  radiusNone: string;  // 0
  radiusSm: string;    // 4px
  radiusMd: string;    // 8px (default)
  radiusLg: string;    // 12px
  radiusXl: string;    // 16px
  radiusFull: string;  // 9999px (circular)
}
```

**CSS Implementation:**

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 2.5 Shadow Tokens

```typescript
interface ShadowTokens {
  shadowNone: string;
  shadowSm: string;     // Subtle elevation
  shadowMd: string;     // Default elevation
  shadowLg: string;     // High elevation
  shadowFocus: string;  // Focus ring
}
```

**CSS Implementation:**

```css
:root {
  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
  --shadow-focus: 0 0 0 2px var(--color-accent-alpha);
}
```

### 2.6 Z-Index Tokens

```typescript
interface ZIndexTokens {
  zBase: number;      // 0
  zDropdown: number;  // 10
  zSticky: number;    // 50
  zModal: number;     // 100
  zToast: number;     // 200
}
```

**CSS Implementation:**

```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 50;
  --z-modal: 100;
  --z-toast: 200;
}
```

### 2.7 Motion Tokens

```typescript
interface MotionTokens {
  durationFast: string;    // 150ms
  durationNormal: string;  // 250ms
  durationSlow: string;    // 400ms

  easingDefault: string;   // ease-out
  easingSmooth: string;    // cubic-bezier
}
```

**CSS Implementation:**

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  --easing-default: ease-out;
  --easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 3. Layout Tokens

### 3.1 Fixed Dimensions

```typescript
interface LayoutTokens {
  toolbarHeight: string;   // 48px
  footerHeight: string;    // 32px
  sidebarWidth: string;    // 280px
  panelWidth: string;      // 320px

  sidebarMinWidth: string; // 200px
  sidebarMaxWidth: string; // 400px
  panelMinWidth: string;   // 240px
  panelMaxWidth: string;   // 480px
}
```

**CSS Implementation:**

```css
:root {
  --height-toolbar: 48px;
  --height-footer: 32px;
  --width-sidebar: 280px;
  --width-panel: 320px;

  --width-sidebar-min: 200px;
  --width-sidebar-max: 400px;
  --width-panel-min: 240px;
  --width-panel-max: 480px;
}
```

---

## 4. Component-Specific Tokens (Optional)

When a component needs many related tokens, define them as a group:

### 4.1 Button Tokens

```css
:root {
  --button-height: 36px;
  --button-height-sm: 28px;
  --button-height-lg: 44px;
  --button-padding-x: var(--space-4);
  --button-border-radius: var(--radius-md);
}
```

### 4.2 Input Tokens

```css
:root {
  --input-height: 36px;
  --input-padding-x: var(--space-3);
  --input-border-radius: var(--radius-md);
  --input-border-width: 1px;
}
```

---

## 5. Dark Mode Overrides

All color tokens have dark mode variants:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #1a1a1a;
    --color-bg-surface: #252525;
    --color-bg-toolbar: #252525;
    --color-bg-viewer: #1a1a1a;
    --color-text-primary: #f6f6f6;
    --color-text-secondary: #999999;
    --color-border: #3a3a3a;
    --color-button-bg: #2a2a2a;
    --color-button-bg-hover: #3a3a3a;
    --color-input-bg: #2a2a2a;
    --color-accent: #60a5fa;
    --color-accent-hover: #93c5fd;
    --color-accent-alpha: rgba(96, 165, 250, 0.2);
    --color-error: #f87171;
    --color-warning: #fbbf24;
    --color-success: #34d399;
  }
}

[data-theme="dark"] {
  /* Same overrides as above */
}
```

---

## 6. Token Migration Plan

### 6.1 Current Tokens (App.css)

The existing codebase has these CSS variables that will be migrated:

| Current Token | New Token |
|---------------|-----------|
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

### 6.2 Migration Strategy

1. Create new token files in `src/ui/tokens/`
2. Import tokens at top of `index.css`
3. Update existing CSS to use new token names
4. Deprecated old tokens with fallbacks:
   ```css
   --bg-color: var(--color-bg); /* deprecated */
   ```
5. Remove deprecated tokens after migration complete

---

## 7. Validation Rules

### 7.1 Color Contrast

- Text on backgrounds MUST meet WCAG AA (4.5:1 for normal text)
- Interactive elements MUST meet WCAG AA (3:1 for UI components)

### 7.2 Spacing Consistency

- All spacing values MUST use token variables
- No magic numbers (e.g., `margin: 13px`)

### 7.3 Typography

- Body text minimum 14px
- Line height minimum 1.5 for readability

---

## 8. File Structure

```
src/ui/tokens/
├── index.css      # Imports all token files
├── colors.css     # Color tokens + dark mode
├── spacing.css    # Spacing scale
├── typography.css # Font definitions
├── radii.css      # Border radius
├── shadows.css    # Elevation shadows
├── z-index.css    # Z-index scale
├── motion.css     # Transitions
└── layout.css     # Fixed dimensions
```
