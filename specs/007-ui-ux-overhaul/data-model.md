# Data Model: UI/UX Overhaul

**Feature**: 007-ui-ux-overhaul  
**Date**: 2026-02-01  
**Status**: Draft

---

## Overview

This feature introduces UI/UX improvements without adding new persistent data. The entities below are **runtime-only** TypeScript types that define contracts for hooks, adapters, and UI components.

---

## Entities

### 1. Design Token

A CSS custom property defining a design value.

```typescript
/**
 * Represents a design token from src/ui/tokens/
 * Used for documentation and tooling, not runtime.
 */
interface DesignToken {
  /** Token name without -- prefix (e.g., "space-4") */
  name: string;

  /** CSS value (e.g., "16px", "#1a1a1a") */
  value: string;

  /** Category for organization */
  category:
    | "color"
    | "spacing"
    | "typography"
    | "z-index"
    | "shadow"
    | "motion"
    | "radius"
    | "layout";

  /** Usage guidelines */
  description?: string;

  /** Token variants (e.g., dark mode) */
  variants?: Record<string, string>;
}
```

**Token Categories** (from `src/ui/tokens/`):

| Category   | File             | Count   | Examples                                               |
| ---------- | ---------------- | ------- | ------------------------------------------------------ |
| color      | `colors.css`     | 19+     | `--color-bg`, `--color-text-primary`, `--color-accent` |
| spacing    | `spacing.css`    | 10      | `--space-1` (4px) through `--space-12` (48px)          |
| typography | `typography.css` | 6 sizes | `--text-xs` through `--text-xl`                        |
| z-index    | `z-index.css`    | 11      | `--z-base` (0) through `--z-toast` (2000)              |
| shadow     | `shadows.css`    | 6       | `--shadow-sm`, `--shadow-focus` (NEW)                  |
| motion     | `motion.css`     | 3       | `--transition-fast`, `--transition-normal`             |
| radius     | `radii.css`      | 6       | `--radius-sm`, `--radius-md`                           |
| layout     | `layout.css`     | 8       | `--toolbar-height`, `--sidebar-width`                  |

---

### 2. Keyboard Shortcut

A key combination mapped to an application action.

```typescript
/**
 * Keyboard shortcut definition
 */
interface KeyboardShortcut {
  /** Unique identifier */
  id: string;

  /** Human-readable action name */
  action: string;

  /** Key combination (platform-agnostic) */
  keys: ShortcutKeys;

  /** When the shortcut is active */
  context: "global" | "viewer" | "dialog" | "input";

  /** Category for grouping in settings UI */
  category: "navigation" | "zoom" | "tts" | "panels" | "file";

  /** Handler function name or store action */
  handler: string;
}

interface ShortcutKeys {
  /** Primary key (e.g., "o", "PageDown", "ArrowRight") */
  key: string;

  /** Modifier keys */
  modifiers?: {
    /** Ctrl on Windows/Linux, Cmd on macOS */
    commandOrControl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };

  /** Platform-specific override */
  mac?: string;
  windows?: string;
}
```

**Predefined Shortcuts** (from research):

| ID             | Action           | Keys            | Context | Category   |
| -------------- | ---------------- | --------------- | ------- | ---------- |
| `open-file`    | Open file        | `Ctrl/Cmd+O`    | global  | file       |
| `find`         | Find in document | `Ctrl/Cmd+F`    | global  | navigation |
| `next-page`    | Next page        | `PageDown`, `→` | viewer  | navigation |
| `prev-page`    | Previous page    | `PageUp`, `←`   | viewer  | navigation |
| `zoom-in`      | Zoom in          | `Ctrl/Cmd++`    | viewer  | zoom       |
| `zoom-out`     | Zoom out         | `Ctrl/Cmd+-`    | viewer  | zoom       |
| `tts-toggle`   | Play/Pause TTS   | `Space`         | viewer  | tts        |
| `close-dialog` | Close dialog     | `Escape`        | dialog  | panels     |

---

### 3. Focus Management State

State for focus trap and roving tabindex hooks.

```typescript
/**
 * Focus trap configuration and state
 */
interface FocusTrapConfig {
  /** Root element containing the focus trap */
  containerRef: React.RefObject<HTMLElement>;

  /** Whether the trap is active */
  active: boolean;

  /** Element to focus on activation (default: first focusable) */
  initialFocus?: React.RefObject<HTMLElement>;

  /** Element to return focus to on deactivation */
  returnFocus?: React.RefObject<HTMLElement>;

  /** Callback when Escape is pressed */
  onEscape?: () => void;

  /** Allow click outside to close */
  clickOutsideDeactivates?: boolean;
}

/**
 * Roving tabindex configuration
 */
interface RovingTabindexConfig {
  /** Container element with role="toolbar" or similar */
  containerRef: React.RefObject<HTMLElement>;

  /** Selector for focusable items */
  itemSelector: string;

  /** Navigation orientation */
  orientation: "horizontal" | "vertical" | "both";

  /** Whether focus wraps at boundaries */
  loop: boolean;

  /** Currently focused item index */
  currentIndex: number;
}
```

---

### 4. Announcement

Screen reader announcement data.

```typescript
/**
 * Announcement for aria-live region
 */
interface Announcement {
  /** Message to announce */
  message: string;

  /** Announcement priority */
  priority: "polite" | "assertive";

  /** Optional timeout before clearing (ms) */
  clearAfter?: number;
}

/**
 * useAnnounce hook return type
 */
interface UseAnnounceReturn {
  /** Announce a message */
  announce: (message: string, priority?: "polite" | "assertive") => void;

  /** Current announcement (for rendering) */
  current: Announcement | null;

  /** Clear current announcement */
  clear: () => void;
}
```

---

### 5. Toast Notification

User feedback notification data.

```typescript
/**
 * Toast notification
 */
interface Toast {
  /** Unique identifier */
  id: string;

  /** Message content */
  message: string;

  /** Visual variant */
  variant: "info" | "success" | "warning" | "error";

  /** Auto-dismiss duration in ms (0 = persistent) */
  duration: number;

  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };

  /** Timestamp for ordering */
  createdAt: number;
}

/**
 * Toast store state
 */
interface ToastStore {
  /** Active toasts */
  toasts: Toast[];

  /** Add a toast */
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;

  /** Remove a toast by ID */
  removeToast: (id: string) => void;

  /** Clear all toasts */
  clearAll: () => void;
}
```

---

### 6. Dialog State

Modal dialog configuration.

```typescript
/**
 * Dialog component props
 */
interface DialogProps {
  /** Whether dialog is open */
  open: boolean;

  /** Close handler */
  onClose: () => void;

  /** Dialog title */
  title: string;

  /** Optional description */
  description?: string;

  /** Dialog size */
  size?: "sm" | "md" | "lg" | "xl";

  /** Dialog content */
  children: React.ReactNode;

  /** Footer actions */
  footer?: React.ReactNode;

  /** Close on Escape key */
  closeOnEscape?: boolean;

  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
}
```

---

### 7. Empty State

Empty state component configuration.

```typescript
/**
 * EmptyState component props (existing in src/ui/components/)
 */
interface EmptyStateProps {
  /** Main heading */
  title: string;

  /** Supporting text */
  description?: string;

  /** Icon component or name */
  icon?: React.ReactNode | string;

  /** Primary action */
  action?: {
    label: string;
    onClick: () => void;
  };

  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}
```

**Predefined Empty States**:

| Location          | Title                       | Action                     |
| ----------------- | --------------------------- | -------------------------- |
| No document       | "Open a PDF to get started" | "Open File"                |
| No highlights     | "No highlights yet"         | "Select text to highlight" |
| No search results | "No results found"          | "Try different keywords"   |
| No recent docs    | "No recent documents"       | "Open File"                |

---

### 8. File Dialog Options

File dialog adapter configuration.

```typescript
/**
 * File dialog open options
 */
interface OpenDialogOptions {
  /** Dialog title */
  title?: string;

  /** Allowed file types */
  filters?: FileFilter[];

  /** Starting directory */
  defaultPath?: string;

  /** Allow multiple selection */
  multiple?: boolean;

  /** Allow directory selection */
  directory?: boolean;
}

interface FileFilter {
  /** Filter name (e.g., "PDF Documents") */
  name: string;

  /** Extensions without dot (e.g., ["pdf"]) */
  extensions: string[];
}

/**
 * File dialog save options
 */
interface SaveDialogOptions {
  /** Dialog title */
  title?: string;

  /** Allowed file types */
  filters?: FileFilter[];

  /** Default file name */
  defaultPath?: string;
}

/**
 * FileDialogPort interface
 */
interface FileDialogPort {
  /** Open file(s) */
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;

  /** Save file */
  save(options?: SaveDialogOptions): Promise<string | null>;
}
```

---

## Entity Relationships

```
┌─────────────────┐     uses      ┌─────────────────┐
│  ToastStore     │──────────────▶│     Toast       │
└─────────────────┘               └─────────────────┘
        │
        │ announces via
        ▼
┌─────────────────┐     uses      ┌─────────────────┐
│  useAnnounce    │──────────────▶│  Announcement   │
└─────────────────┘               └─────────────────┘

┌─────────────────┐     uses      ┌─────────────────┐
│  useFocusTrap   │──────────────▶│ FocusTrapConfig │
└─────────────────┘               └─────────────────┘
        │
        │ used by
        ▼
┌─────────────────┐     uses      ┌─────────────────┐
│    Dialog       │──────────────▶│   DialogProps   │
└─────────────────┘               └─────────────────┘

┌─────────────────┐     uses      ┌─────────────────────┐
│useRovingTabindex│──────────────▶│RovingTabindexConfig │
└─────────────────┘               └─────────────────────┘
        │
        │ used by
        ▼
┌─────────────────┐
│    Toolbar      │
└─────────────────┘

┌─────────────────┐     impl      ┌─────────────────┐
│FileDialogAdapter│──────────────▶│  FileDialogPort │
└─────────────────┘               └─────────────────┘
```

---

## Storage

**No persistent storage changes**. All entities are runtime-only:

| Entity            | Storage            | Lifecycle                |
| ----------------- | ------------------ | ------------------------ |
| Design Token      | CSS files          | Build-time               |
| Keyboard Shortcut | In-memory registry | App session              |
| Focus Management  | React state        | Component mount          |
| Announcement      | React state        | Transient                |
| Toast             | Zustand store      | Transient (auto-dismiss) |
| Dialog            | React props        | Component mount          |
| Empty State       | React props        | Component mount          |
| File Dialog       | N/A                | Function call            |

---

## Validation Rules

| Entity            | Rule                                        |
| ----------------- | ------------------------------------------- |
| Toast             | `duration >= 0`, `message.length > 0`       |
| Announcement      | `message.length > 0`                        |
| Keyboard Shortcut | `key` must be valid KeyboardEvent.key value |
| Dialog            | `title.length > 0`                          |
| File Filter       | `extensions.length > 0`                     |
