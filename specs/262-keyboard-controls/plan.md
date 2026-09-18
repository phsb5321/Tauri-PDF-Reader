# Plan

## Technical Context

`src/hooks/useCommandKeys.ts` is the single source of keyboard truth:
`COMMAND_CHORDS` (window-level, matched by pure `resolveChord` —
`event.ctrlKey || event.metaKey`, typing-target suppression) and
`COMPONENT_CHORDS` (component-owned: Ctrl+Space play/pause in AiPlaybackBar
[`" "` + `ctrlKey` only], Escape innermost dismiss, Ctrl+Shift+H highlight,
Home/End page edges). The panel mounts in SettingsPanel's `shortcuts`
section (no mounting change needed). Base `.shortcut-list/row/action/keys/key`
styles exist in SettingsPanel.css; `.shortcut-group-title` and separators were
referenced but never styled — the concrete readability gap. No platform util
exists, so a minimal `navigator.platform/userAgent` check lives in the owned
component. 35801daa baseline.

## Smallest integration sequence

1. `KeyboardShortcuts.tsx`: pure `buildShortcutGroups(mac)` derives rows from
   both sources (same-action global chords merge into one row); display-only
   taxonomy maps decide grouping with an "Other" fallback so no source entry
   can silently vanish; `displayChordLabel` relabels Ctrl→⌘ for GLOBAL chords
   only (p16 correction — component keys stay literal because their handlers
   never check metaKey); dedupe the slice-111 doc-comment duplication.
2. `KeyboardShortcuts.css` (scoped, directly imported): group-title styling,
   row/key wrap for narrow widths; tokens only, no animation.
3. One test `keyboard-discoverability-262.test.tsx`: exact displayed keycap
   multiset vs sources in both contexts, group membership, invented-chord
   absence, mac DOM render via navigator.platform stub. Existing slice-111
   test constraints honored (derivation, whole-label chips, no `{ action:`
   literals).

## Provenance / gates

Authored by GLM-5.3-Flash/max (zai, pane w1:p15) under the 20260915
delivery wave; p16's platform-accuracy correction applied as stated. No
execution by this seat (251 owns the serialized slot); one runnable check
listed, unexecuted. Flash never judges; Codex Sol exact-head review is the
next gate before any acceptance claim. 20 active minutes, frozen at delivery.
