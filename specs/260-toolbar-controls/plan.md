# Plan 260 — toolbar controls

## Technical Context

Toolbar.tsx already ships roving tabindex, aria-pressed toggles, icon-first
reader compaction, a 900px two-row grid and a 700px icon-only tier — those
are baseline, not fixes to re-claim. The missing pieces are a visible group
boundary, visible pressed state, reduced-motion handling, scoped
transitions, and focus recovery across the remount transition. jsdom
cannot assert layout/reduced-motion; those are CSS-only and verified in the
coordinator's joint geometry pass (640/767/900/1200 with long title +
non-preset fit label from 256/257 siblings).

## Slices

1. Toolbar.tsx: decorative divider (reader mode only) + blur-capture/flip
   focus recovery via the existing toolbarRef and roving selector.
2. Toolbar.css: divider, `[aria-pressed="true"]` active style, scoped
   transition list, reduced-motion media, divider hidden ≤700px.
3. Toolbar.controls-260.test.tsx: 7 authored cases (UNEXECUTED here).
4. specs trio + reports/DELIVERY.md + artifact hashes.
