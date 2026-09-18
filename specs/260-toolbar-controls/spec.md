# Spec 260 — toolbar control grouping, state, focus recovery

## User Scenarios & Testing

**US1 — Grouping.** In reader mode a decorative vertical divider separates
document navigation (Back/Chapters) from session/file actions (Sessions/
Open). It is `aria-hidden` and carries no `toolbar-roving-item` class, so
the roving set is unchanged.

**US2 — Clear toggle state.** Chapters and Sessions are real toggles
(`aria-pressed`) and gain a visible pressed style (accent border + hover
background) so current state is readable, not guessed.

**US3 — Focus recovery across the library <-> reader remount.** When focus
lived inside the toolbar and the mode flip remounts the roving buttons,
focus returns to the first enabled roving item. First mount and outside
interactions never steal focus (blur-capture + flip detection, no timers).

**US4 — Reduced motion.** Press-scale and transitions are disabled under
`prefers-reduced-motion: reduce` (CSS-only; not unit-asserted in jsdom).

**US5 — Narrow-width operability.** The existing 900px two-row grid and
700px icon-only compaction are preserved; the divider hides at ≤700px; no
new `overflow: hidden` is introduced anywhere, long synthetic titles keep
ellipsis via the existing `min-width: 0` chain, and no essential control is
removed at 640/767/900/1200.

**Testing (authored, UNEXECUTED — live 225 owns the lock):**
`src/components/Toolbar.controls-260.test.tsx` — presence + accessible
names, divider decoration contract, aria-pressed flips, library/reader
visibility split, Open → `openPdf`/`onOpen` wiring, focus recovery across
the flip, no first-mount focus steal. Children (PageNavigation,
ZoomControls, SessionMenu) stubbed; open seam mocked at the hook boundary.
Existing Toolbar tests (toolbar-settings-keyboard, reading-home,
useRovingTabindex) must remain green unchanged — divider/toggle styles are
additive.

## Technical Context

Branch `260-toolbar-controls`, locked root
`tauri-pdf-reader-260-toolbar-controls`, base `35801daa`. Owned files:
`src/components/Toolbar.tsx`, `src/components/Toolbar.css`, the new scoped
test, this spec trio, `reports/DELIVERY.md`. ZoomControls/PageNavigation/
child props/global tokens/command map are NOT touched (256/257/243 own
them). Roving ownership preserved: the divider is not a roving item;
`getItemProps` indices unchanged. Geometry acceptance is joint with 256/
257 at 640×600/767/900/901/1200 with long synthetic title and non-preset
fit label — CSS keeps every control nowrap, grid-wrapped, and unclipped;
joint verification is the coordinator's slot. Reuses existing tokens
(--space/--button-height/--radius/--color-*) exclusively.
