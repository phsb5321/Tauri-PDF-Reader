# Plan — 257 page controls

## Technical Context

Baseline `35801daa`, root `tauri-pdf-reader-257-page-controls`.
React 18 + zustand; the frozen `usePageNavigation` hook and store clamp
semantics are reused unchanged. Only `PageNavigation.tsx` and its scoped CSS
plus one test file are touched; no hook, store, IPC or dependency change.

1. Trace `usePageNavigation.ts` (frozen semantics: stop-then-read-then-write,
   store clamp) and the existing `PageNavigation` draft flow; identify the
   double-dispatch window and the parseInt acceptance bugs.
2. Component only: full-string safe-integer parse; single funnel
   `commitDraft` for Enter/blur with a dispatch marker cleared on store
   landing; clamped-target no-op guard; Escape cancel; store+document-identity
   sync as stale-intent invalidation; exact "Current page" name restored,
   context via `aria-describedby` + group; `inputMode`/`enterKeyHint`.
3. CSS only within existing tokens: focus-visible ring parity, reduced-motion
   guard, input width for 4-digit totals, narrow-width `min-width: 0`.
4. One scoped test file (11 tests) as the runnable check, real store as oracle,
   counted progress/TTS mocks.
5. Freeze, hash, READY to 251/p17 via `herdr-prompt`; execution only in 251's
   serialized slot; different-family (Sol) review before any merge claim.
