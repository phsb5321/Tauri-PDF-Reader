# Quickstart: UI/UX Overhaul Implementation

**Feature**: 007-ui-ux-overhaul  
**Date**: 2026-02-01  
**Estimated Time**: ~50 hours (P0 + P1)

---

## Prerequisites

```bash
# Ensure you're on the feature branch
git checkout 007-ui-ux-overhaul

# Install dependencies
pnpm install

# Verify current state (lightweight checks first)
pnpm lint
pnpm typecheck
```

---

## Resource-Conscious Development (IMPORTANT)

**This machine runs multiple projects concurrently. Minimize resource usage:**

1. **Run targeted tests, not full suites** - Test only the files you change
2. **Run tests sequentially** - Avoid parallel execution
3. **Use lightweight checks first** - lint → typecheck → targeted tests
4. **Close dev servers before testing** - Stop `pnpm tauri dev` first

```bash
# PREFERRED: Test only what you changed
pnpm test -- src/hooks/useAnnounce.test.ts

# AVOID: Full test suite (use only before final commit)
pnpm test:run
```

---

## Phase 0: Foundation (Sprint 1)

### P0-5: Fix ESLint Accessibility Errors (~3 hours)

**Goal**: Clean lint output, no accessibility warnings

**Files to modify**:

- `src/components/session-menu/SessionMenu.tsx`
- `src/components/session-menu/SessionItem.tsx`
- `src/components/session-menu/CreateSessionDialog.tsx`
- `src/components/export-dialog/AudioExportDialog.tsx`
- `src/__tests__/ui/Panel.test.tsx`

**Fixes needed**:

1. **Empty title attributes** → Add meaningful titles or remove

   ```tsx
   // Before
   <span title="">

   // After
   <span title="Session name"> or <span>
   ```

2. **Button type** → Add `type="button"` explicitly

   ```tsx
   // Before
   <button onClick={...}>

   // After
   <button type="button" onClick={...}>
   ```

3. **Label association** → Use `htmlFor` or wrap input

   ```tsx
   // Before
   <label>Name</label>
   <input id="name" />

   // After
   <label htmlFor="name">Name</label>
   <input id="name" />
   ```

4. **Keyboard handlers** → Add `onKeyDown` alongside `onClick`

   ```tsx
   // Before
   <div onClick={handleClick}>

   // After
   <div onClick={handleClick} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
   ```

5. **Array keys** → Use stable identifiers

   ```tsx
   // Before
   items.map((item, index) => <Item key={index} />);

   // After
   items.map((item) => <Item key={item.id} />);
   ```

**Verification**: `pnpm lint` passes with no errors

---

### P0-1: Complete Design Token Migration (~4 hours)

**Goal**: 100% design token adoption

**Step 1**: Add missing tokens

```css
/* src/ui/tokens/shadows.css - add focus token */
:root {
  --shadow-focus: 0 0 0 2px var(--color-accent);
}

/* src/ui/tokens/z-index.css - add extreme token for TTS highlight */
:root {
  --z-extreme: 99999;
}
```

**Step 2**: Find hardcoded values

```bash
# Find hardcoded z-index
grep -r "z-index:" --include="*.css" src/ | grep -v "var(--z-"

# Find hardcoded colors (hex)
grep -rE "#[0-9a-fA-F]{3,6}" --include="*.css" src/ | grep -v "/\*"
```

**Step 3**: Replace in each file

```css
/* Before */
z-index: 1000;

/* After */
z-index: var(--z-modal);
```

**Verification**: `grep` commands return no results

---

### P0-3: Implement Focus Visible Styles (~2 hours)

**Goal**: Consistent focus indicators

**Step 1**: Add global focus styles

```css
/* src/styles/globals.css */
:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

/* Ensure buttons use it */
button:focus-visible,
[role="button"]:focus-visible {
  box-shadow: var(--shadow-focus);
}
```

**Step 2**: Update Button and IconButton primitives

```css
/* src/ui/components/Button/Button.css */
.button:focus-visible {
  box-shadow: var(--shadow-focus);
  outline: none;
}
```

**Verification**: Tab through the app, focus ring is visible on all interactive elements

---

### P0-4: Add ARIA Live Region (~2 hours)

**Goal**: Screen reader announcements for dynamic changes

**Step 1**: Create the hook

```typescript
// src/hooks/useAnnounce.ts
import { useState, useCallback, useEffect } from 'react';

export function useAnnounce() {
  const [message, setMessage] = useState('');

  const announce = useCallback((text: string) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(text));
  }, []);

  const AnnouncementRegion = () => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );

  return { announce, AnnouncementRegion };
}
```

**Step 2**: Add visually hidden class

```css
/* src/styles/globals.css */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Step 3**: Integrate into AppLayout

```tsx
// src/components/layout/AppLayout.tsx
import { useAnnounce } from "@/hooks/useAnnounce";

export function AppLayout({ children }) {
  const { AnnouncementRegion } = useAnnounce();

  return (
    <div className="app-layout">
      {children}
      <AnnouncementRegion />
    </div>
  );
}
```

**Step 4**: Use in PageNavigation

```tsx
// src/components/PageNavigation.tsx
const { announce } = useAnnounce();

const handlePageChange = (newPage: number) => {
  setPage(newPage);
  announce(`Page ${newPage} of ${totalPages}`);
};
```

**Verification**: Open NVDA/VoiceOver, navigate pages, hear announcements

---

### P0-2: Create FileDialogAdapter (~4 hours)

**Goal**: Architecture compliance for dialog plugin

**Step 1**: Create port interface

```typescript
// src/ports/file-dialog.port.ts
export interface FileDialogPort {
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;
  save(options?: SaveDialogOptions): Promise<string | null>;
}
```

**Step 2**: Create adapter

```typescript
// src/adapters/tauri/file-dialog.adapter.ts
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  FileDialogPort,
  OpenDialogOptions,
  SaveDialogOptions,
} from "@/ports/file-dialog.port";

export class TauriFileDialogAdapter implements FileDialogPort {
  async open(options?: OpenDialogOptions) {
    return open(options);
  }

  async save(options?: SaveDialogOptions) {
    return save(options);
  }
}

// Singleton instance
export const fileDialog = new TauriFileDialogAdapter();
```

**Step 3**: Update components to use adapter

```typescript
// src/components/Toolbar.tsx
// Before
import { open } from '@tauri-apps/plugin-dialog';
const path = await open({ ... });

// After
import { fileDialog } from '@/adapters/tauri/file-dialog.adapter';
const path = await fileDialog.open({ ... });
```

**Files to update**:

- `src/components/export-dialog/AudioExportDialog.tsx`
- `src/components/dialogs/ExportDialog.tsx`
- `src/components/Toolbar.tsx`
- `src/hooks/useKeyboardShortcuts.ts`

**Verification**: `pnpm lint` passes (no direct plugin imports in components)

---

## Phase 1: Core Accessibility (Sprint 2-3)

### P1-2: Add Focus Trap to Modals (~4 hours)

See `contracts/focus-trap.hook.ts` for interface.

```typescript
// src/hooks/useFocusTrap.ts
export function useFocusTrap(options: FocusTrapOptions): UseFocusTrapReturn {
  // Implementation per contract
}
```

Apply to:

- `SettingsPanel`
- `AudioExportDialog`
- `ExportDialog`
- `CreateSessionDialog`

---

### P1-1: Implement Roving Tabindex (~6 hours)

See `contracts/roving-tabindex.hook.ts` for interface.

```typescript
// src/hooks/useRovingTabindex.ts
export function useRovingTabindex(
  options: RovingTabindexOptions,
): UseRovingTabindexReturn {
  // Implementation per contract
}
```

Apply to:

- `Toolbar` (horizontal orientation)

---

### P1-5: Add Toast Feedback (~3 hours)

```typescript
// src/stores/toast-store.ts
import { create } from "zustand";

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, createdAt: Date.now() }],
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
```

---

## Verification Checklist

After each phase, run lightweight checks first:

```bash
# Step 1: Lightweight checks (run these frequently)
pnpm lint          # No errors
pnpm typecheck     # No type errors

# Step 2: Targeted tests for changed files only
pnpm test -- src/hooks/useAnnounce.test.ts
pnpm test -- src/components/Toolbar.test.tsx

# Step 3: Full verification ONLY before commits (resource intensive)
pnpm verify        # All checks
pnpm test:run      # All tests pass
pnpm test:coverage # 80% threshold met
```

---

## Common Issues & Solutions

### Issue: ESLint boundary rule violation

```
Import from '@tauri-apps/plugin-dialog' is not allowed
```

**Solution**: Use the adapter instead of direct import

### Issue: Focus trap breaks scroll

**Solution**: Ensure `preventScroll: false` for modals that need scroll

### Issue: Announcement not read

**Solution**: Clear message before setting to trigger re-announcement

```typescript
setMessage("");
requestAnimationFrame(() => setMessage(newMessage));
```

### Issue: Roving tabindex loses focus on re-render

**Solution**: Store current index in ref, not just state

---

## Next Steps After Implementation

1. **Test with screen reader** (NVDA on Windows, VoiceOver on macOS)
2. **Keyboard-only walkthrough** of all core flows
3. **Visual regression check** for token migration
4. **Update AGENTS.md** with new patterns/hooks

---

## Resources

- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [W3C ARIA Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Testing](https://webaim.org/techniques/keyboard/)
- Project spec: `specs/007-ui-ux-overhaul/spec.md`
- Task backlog: `specs/007-ui-ux-overhaul/ui-tasks-seed.md`
