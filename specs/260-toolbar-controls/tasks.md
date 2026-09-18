# Tasks 260 — toolbar controls

Status: candidate authored 15/09/2026 16:31–17:00 BRT (GLM Flash/max);
FROZEN; coordinator owns execution/integration/done.

- [x] T001 Divider between document-nav and session/file groups (decorative,
  reader-mode only, not a roving stop).
- [x] T002 Pressed-state styling for aria-pressed toolbar toggles.
- [x] T003 Reduced-motion media (no transitions/scale) + scoped transition
  properties.
- [x] T004 Focus recovery across library <-> reader remount (blur-capture +
  flip effect; no first-mount focus steal).
- [x] T105 Authored test `Toolbar.controls-260.test.tsx` (7 cases) —
  UNEXECUTED; coordinator slot runs
  `pnpm vitest run src/components/Toolbar.controls-260.test.tsx src/__tests__/ui/toolbar-settings-keyboard.test.tsx src/__tests__/ui/reading-home.test.tsx src/hooks/__tests__/useRovingTabindex.test.tsx`
  then `pnpm typecheck`.
- [ ] T110 Coordinator: joint geometry acceptance with 256/257 at
  640x600/767/900/901/1200 (long title + non-preset fit label), then
  exact-head Codex Sol review, integration, release.
