# Keyboard control discoverability (262)

## User Scenarios & Testing

### US1 — Find the control you already have (P1)
A reader opening Settings → Shortcuts sees every binding the app actually
has, grouped by real purpose — Files & library, Navigation, Playback,
Reading actions — instead of raw action ids under an unstyled bucket list.
Group titles are visually distinct; rows wrap at narrow desktop widths
instead of clipping.

### US2 — Keycaps tell the truth on every platform (P1)
Global chords (`COMMAND_CHORDS`, matched by `resolveChord` against
`ctrlKey || metaKey`) render ⌘ on macOS and Ctrl elsewhere. Component-owned
bindings (`COMPONENT_CHORDS`) stay LITERAL in every context: their handlers
bind `ctrlKey` only (`AiPlaybackBar` play/pause), so Cmd+Space is never
advertised. Bare Space is next-page; unimplemented Find and zoom chords are
never shown. Changing keybinding execution is out of scope — this panel is
read-only truth.

### US3 — The panel cannot drift from the command map (P1)
The displayed set is derived from the two chord sources each render; the 262
test asserts the exact displayed keycap multiset against the sources in both
platform contexts (nothing invented, nothing missing), checks grouping
membership (playback row holds the literal Ctrl+Space; Navigation holds bare
Space/Page Up), and pins the absence of Find/zoom/Cmd+Space. The existing
slice-111 consistency test stays green (derivation + whole-label chips).

## Acceptance

`src/__tests__/ui/keyboard-discoverability-262.test.tsx` (4 cases) derives
every expectation from `COMMAND_CHORDS`/`COMPONENT_CHORDS` — no second
binding registry. Runnable check (251's serialized slot):
`pnpm test:run -- src/__tests__/ui/keyboard-discoverability-262.test.tsx
src/__tests__/ui/shortcut-consistency.test.tsx`, then `pnpm lint && pnpm
typecheck`. Visual/native acceptance unexecuted by this seat.

## Boundaries

Only `src/components/settings/KeyboardShortcuts.tsx` + its directly imported
scoped `KeyboardShortcuts.css` are authored, plus the one 262 test and
spec/report. No SettingsPanel/global CSS/Follow-hook edits; no keybinding
execution changes; no new dependency or primitive (base `.shortcut-*` styles
reused from SettingsPanel.css). Public source only; execution requires 251's
slot; 20 active-minute budget, freeze after one meaningful check.
