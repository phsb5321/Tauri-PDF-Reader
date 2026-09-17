# Spec 256 — Plan

## Technical Context

- Theme cascade: `useTheme` sets `data-theme` on `<html>` (system mode
  resolves to explicit dark/light), colors.css carries
  `prefers-color-scheme` fallbacks. WebKitGTK paints native select popups
  from `color-scheme` — undeclared = light chrome.
- Containment: document-level handlers ignore `defaultPrevented`, so the
  select uses `stopPropagation` on a key-scoped set (Home/End/Escape/
  arrows/PageUp/PageDown). Native option movement preserved (no
  preventDefault). No role/aria-label changes.

## Files

| File                                          | Change                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/ZoomControls.tsx`             | chord text removed; key-scoped select `onKeyDown` containment           |
| `src/components/ZoomControls.css`             | leaf-scoped `color-scheme` (light default, dark via data-theme + media) |
| `src/__tests__/ui/zoom-controls-256.test.tsx` | 11 gates (authored, unexecuted)                                         |

## Verification (deferred — live 225 lock)

`pnpm test:run src/__tests__/ui/zoom-controls-256.test.tsx` →
`pnpm lint && pnpm typecheck` → native WebKitGTK popup painting check owned
by 251 (jsdom cannot prove popup chrome).
