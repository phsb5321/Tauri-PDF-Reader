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

## Landing execution (delivery seat, 18/09/2026)

- [x] T008 executed at the landing head (rebased onto `746601f`):
      `CI=true ./node_modules/.bin/vitest run src/__tests__/ui/keyboard-discoverability-262.test.tsx src/__tests__/ui/shortcut-consistency.test.tsx --pool=forks --poolOptions.forks.singleFork`
      → **8 passed** (5 + 3). `pnpm lint` → 0 errors (108 pre-existing warnings);
      `pnpm typecheck` → exit 0; `pnpm test:fuzz` → 8 passed, seed `20260801`;
      `make harness-status` → PASS (`specs/262-keyboard-controls` complete).
- [x] T008-negative-controls — the authored oracle is shown able to FAIL, not
      merely to pass (each mutation applied to the committed file, run, then
      restored byte-identical; baseline re-run green afterwards):
      (a) same-action merge reverted → **1 failed / 4 passed**
      (b) component row claims ⌘ on mac (the p16 lie) → **1 failed / 4 passed**
      (c) a real chord dropped (`next-page`) → **4 failed**
      (d) an invented "Find in document" row added → **3 failed**
      A first control attempt (prefix-relabelling the separate `["Ctrl","Space"]`
      keycaps) was a no-op mutation and proved nothing — the honest reading is
      that it moved no behaviour, not that the suite missed it; the replacement
      control (b) changes behaviour and fails.
- [ ] T009 independent different-family gate on the exact pushed head (GPT lane;
      GLM authored this slice, so GLM may not gate it).
- [ ] T010 packaged journey for THIS panel — **BLOCKED, reported not waived**:
      no black-box spec reaches Settings → Shortcuts (`e2e/critical-loop.e2e.mjs`
      never opens Settings; the native TTS lane is local-only and not
      CI-wired). The mounted-panel native journey is therefore unproven and no
      packaged pass is claimed for it. The CI `Packaged PR-fast lane
    (critical-loop)` covers the app's critical loop only.
