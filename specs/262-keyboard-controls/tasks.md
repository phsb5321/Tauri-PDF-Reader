# Tasks

- [x] T001 Identity receipt + read COMMON/p15; verify locked root `tauri-pdf-reader-262-keyboard-controls` at 35801daa.
- [x] T002 Trace the command map: `COMMAND_CHORDS`/`COMPONENT_CHORDS`/`resolveChord`, component-owned handlers (AiPlaybackBar ctrlKey-only play/pause), existing slice-111 panel + consistency test, existing `.shortcut-*` styles.
- [x] T003 Rewrite `src/components/settings/KeyboardShortcuts.tsx`: derived grouped reference (Files & library / Navigation / Playback / Reading actions), platform keycaps honest per handler, literal component modifiers, human action labels, scoped description.
- [x] T004 Add scoped `KeyboardShortcuts.css` (group titles, narrow-width wrap; tokens only).
- [x] T005 One 262 test `src/__tests__/ui/keyboard-discoverability-262.test.tsx` (exact-set vs sources in both contexts, grouping, no Find/zoom/Cmd+Space, mac DOM stub).
- [x] T006 Spec trio + `reports/DELIVERY.md`.
- [x] T007 Measured repair 1/2 (p16, 15/09): comment promised same-action merge but code pushed duplicate rows (Previous page ×2, Next page ×3, duplicate React keys). Fixed: real merge — same action in a group appends its alternative keycaps to one row; row labels now unique/stable. New test asserts unique row identity + source-derived alternatives (Previous page = Page Up|←, Next page = Page Down|→|Space). Global-only ⌘ relabel + literal component Ctrl + no unimplemented bindings confirmed incorporated; not an acceptance/ALLOW claim.
- [ ] T008 Coordinator-frozen slot (251): `pnpm test:run -- src/__tests__/ui/keyboard-discoverability-262.test.tsx src/__tests__/ui/shortcut-consistency.test.tsx` then `pnpm lint && pnpm typecheck`. UNEXECUTED by this seat.
- [ ] T009 Codex Sol exact-head review gate; then READY consumption by 251. 1 of 2 measured repair rounds consumed.
