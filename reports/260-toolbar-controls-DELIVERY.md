# DELIVERY — 260 toolbar controls — 15/09/2026

**Route receipt (first tool 16:31:38 -03):** `PI_PROVIDER=zai PI_MODEL=glm-5.3-flash PI_REASONING_LEVEL=max`. Root: `/home/notroot/Documents/Code/personal/tauri-pdf-reader-260-toolbar-controls`, branch `260-toolbar-controls`, HEAD `35801daa8657` (+ this candidate). Active authoring ≈16:31–17:00 BRT (~25 wall; overlap includes the mid-flight structure repair after my own bad edit — real clocks, not a guessed active budget). **FROZEN — authoring is not acceptance.**

## Changed files (exact; SHA-256 in `evidence` manifest below)

1. `src/components/Toolbar.tsx` — decorative group divider (reader mode only, `aria-hidden`, never a roving stop; roving indices unchanged) + focus recovery across the library↔reader remount: blur-capture tracks focus leaving the bar; the mode flip returns focus to the first enabled `button.toolbar-roving-item` **only** when focus lived in the toolbar (no first-mount steal, no timers).
2. `src/components/Toolbar.css` — `.toolbar-divider` styles (hidden ≤700px); `[aria-pressed="true"]` pressed-state styling (accent border + hover bg + inset ring — clear current toggle state for Chapters/Sessions); `prefers-reduced-motion: reduce` disables transitions/press-scale; transition list scoped to color/box-shadow/transform (no accidental layout transitions). NO new `overflow: hidden`; no global token edits; no child-component changes.
3. `src/components/Toolbar.controls-260.test.tsx` — NEW, 7 authored cases (UNEXECUTED here — live 225 owns the lock; details in spec.md).

Existing tests (`toolbar-settings-keyboard`, `reading-home`, `useRovingTabindex`) untouched; divider/toggle styles are additive and must not affect them.

## Authored-unrun check commands (coordinator slot)

```
pnpm vitest run src/components/Toolbar.controls-260.test.tsx src/__tests__/ui/toolbar-settings-keyboard.test.tsx src/__tests__/ui/reading-home.test.tsx
pnpm typecheck
```
(Plus `src/hooks/__tests__/useRovingTabindex.test.tsx` for roving regression.)

## Invariants preserved

Accessible names and keyboard routes unchanged; reading-home vs reader behavior unchanged (library mode keeps Sessions/Open/Settings, hides Back/Chapters); no clipping introduced (no new overflow rules); essential controls present at every width — narrow-width layout already wrapped at 900px/icon-tier at 700px, kept as baseline (not re-claimed as a fix); divider hidden ≤700px; joint geometry with 256 (zoom) / 257 (page) at 640×600/767/900/901/1200 with long synthetic title + non-preset fit label is the coordinator's acceptance pass (my CSS keeps all toolbar controls nowrap/grid-wrapped/unclipped to make that joint pass possible).

## Explicitly not claimed

No in-session speed work (out of this wave), no acoustic/performance/native/coverage claims, no acceptance/done/review verdicts. CSS-only aspects (reduced motion, layout) are not unit-asserted in jsdom — verified in the coordinator's geometry pass.

## Artifact hashes

`/home/notroot/.local/state/fleet-coordination/lectrice-reader-experience-20260914/evidence/wave-impl-260/worker-260-sha256.txt` — wait: corrected durable location for THIS run: `~/.local/state/fleet-coordination/lectrice-all-seats-20260915/evidence/260/worker-260-sha256.txt` (written there; 8 files incl. report).

## Remaining caps/gates

Coordinator stopped-slot test/typecheck run; joint 256/257/260 geometry acceptance at 640/767/900/1200; exact-head Codex Sol review (Flash-authored → Sol gate, healthy-account admission); integration/push/release by coordinator. Corrections consumed: 1 self-caught structural repair (my own mangled edit, fixed same-session, no coordinator failure packet). **READY for 251/lead.**

## Correction 1/2 — measured (15/09/2026 16:4x BRT)

1. **Duplicate block removed**: the accidental repeated Sessions/Open PDF/title JSX (lines 157/210, 178/231 region) is excised; exactly one of each remains; roving indices reused only once.
2. **Focus recovery rewritten to owned-lost-focus semantics**: `onFocusCapture` remembers the last toolbar-owned focused item; the mode flip recovers ONLY when focus was actually lost by the remount (activeElement fell back to body/html) — refocusing the same item if it survived, else the first enabled roving item. Deliberately moved outside focus (any live element) is left untouched. The blur-based `focusWasInToolbarRef` steal path is removed. New regression: outside-input focus survives a later mode change; lost-owned recovery case kept; first-mount no-steal case kept.
3. **Geometry acceptance acknowledged**: layout styles alone cannot establish the 640px composition — joint 640×600/767/900/901/1200 verification with 256/257 remains the coordinator's pass; no compositional claim is made from these styles.

Frozen again. Same unrun commands as above. Corrections consumed: 1/2.

## p16 readback fixes queued into final bytes (15/09/2026 16:5x BRT)

1. Toolbar.controls-260.test.tsx: `documentStub` is now actually used — reader-mode tests seed `pdfDocument`/`currentDocument` through the real store (`seedReaderDocument()`), so the Chapters render condition (`pdfDocument && !isLibraryShowing`) is satisfied.
2. Chapters pressed-state no longer claims an impossible flip from a `vi.fn()` controlled prop: a stateful `ContentsHarness` owns `isContentsOpen` and flips it via `onContents`, asserting pressed false→true→false through the real controlled contract; Sessions keeps its internal-state flip test.
3. Outside-focus-steal path: current bytes use the correction-1 owned-lost-focus semantics (`onFocusCapture` + body-fallback recovery; `onBlurCapture`/`focusWasInToolbarRef` removed) — the outside-input non-steal regression asserts `activeElement` stays on the alive outside target across the mode flip. (The 16:50 readback inspected pre-16:51 bytes.)
No source logic changed in this pass beyond what correction 1 already froze; these are exact-final-byte fixes to the authored tests + manifest. No third round; coordinator replay owns the verdicts.
