# Tasks: 261-narration-controls

- [x] T261-1 Isolate consumed tab keys (preventDefault + stopPropagation on
      Arrow/Home/End) in the cockpit's owned keydown handler; unconsumed keys
      keep propagating; Escape path preserved.
- [x] T261-2 Truthful lock note bound only to `controlsDisabled`
      (`role="note"`), styled with existing tokens.
- [x] T261-3 Author `narration-cockpit-keys-261.test.tsx`: real window
      keydown seam, consumed-keys isolation, unconsumed propagation with target
      intact, Escape close + isolation, lock-note toggle.
- [x] T261-4 Executed at landing (17/09/2026): authored test green (4/4),
      `pnpm typecheck` clean, committed through the repo hooks. The native
      combined focus/transport journey stays 251-owned (unchanged debt).
