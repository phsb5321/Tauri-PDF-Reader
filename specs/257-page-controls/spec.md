# Spec 257 — Page controls (PageNavigation deliberate draft)

## Why

The page entry/prev/next cluster works but not deliberately: `parseInt`
committed "12junk" as 12 and "1.5" as 1, Enter followed by blur dispatched the
same page twice (two TTS stops, two progress writes, two announcements), page 1
plus draft "0" re-fired navigation for the page already shown, a dirty draft
survived a document swap landing on the same page number, and the accessible
name had drifted. Direct Pedro delivery request (lectrice-all-seats, 15/09/2026).

## Ownership

Only `src/components/PageNavigation.tsx` + `PageNavigation.css`, one scoped
test, this spec set. Baseline `35801daa`. No hook/store/IPC rewrite: the frozen
`usePageNavigation` hook and store clamp semantics are reused, not modified.

## Scenarios (tested)

1. Enter commits once; a blur arriving before the stop-audio await lands
   dispatches nothing more (1 TTS stop, 1 progress write).
2. Blur alone commits once.
3. Escape then blur: zero navigation, zero progress, zero TTS calls; input
   restored.
4. Invalid drafts ("12junk", "1.5", "9007199254740993", 300 nines) reset with
   zero calls — full-string safe-integer policy on trimmed input.
4b. MARKED POLICY DIVERGENCE (p16 readback 16:50): the parseInt era accepted
   "-1" and clamped it. N1's out-of-range clamping is preserved for unsigned
   integers only; signed input ("-1", "+2") is deliberately invalid under the
   digits-only contract. Pinned by a dedicated test so the divergence cannot
   regress silently in either direction.
5. Draft "0" on page 1 clamps to the current page: treated as no-op, zero
   calls (clamped-target guard, not pre-clamp comparison).
6. Valid out-of-range ("9999" of 40) clamps exactly once at commit.
7. External page change while dirty rewrites the draft; blur replays nothing.
8. Document swap landing on the same page number still invalidates the draft.
9. Boundaries: prev disabled at page 1, next disabled at last; both otherwise
   enabled and functional.
10. Accessible name stays exactly "Current page"; total context arrives via
    `aria-describedby` to the visible total and the "Page position" group.

## Technical context

React 18 + zustand (real document store as oracle), vitest/jsdom,
@testing-library/react. Mocks: `tauri-invoke.aiTtsStop`, `bindings.commands`,
`useAutoSave.enqueueProgressWrite` (counted), `useAnnounce` (no-op). The
dispatch-once guarantee is a `dispatchedTargetRef` cleared by the store-landing
effect. CSS: existing token system only; adds focus-visible parity, reduced-
motion guard, 4-digit-safe input width.

## Known integration gap (reported, NOT accepted)

`PageNavigation.goToPage` and the frozen `usePageNavigation` both stop audio on
navigation — conflicting with the LECT-130 independent-view/narration
requirement. Unchanged here on purpose; narration semantics belong to their
owners. 257 does not accept stop-on-browse as correct.

## Out of scope

Hook/store/IPC changes, zoom menus, other toolbar controls, new UI primitives
or dependencies, private fixtures, any execution outside 251's slot.
