# Spec 025 — Page-Boundary-Safe Word Range (P1 #7 pt.4)

## Problem

`TtsWordHighlight.createWordRange` mapped a word's `[charStart, charEnd)` over
the page's text-layer nodes inline. Two defects at page boundaries:
1. When a word spanned multiple text nodes and the end overran the available
   text, it clamped to the **start** node's end (`range.setEnd(textNode,
   nodeLength)`), highlighting too little.
2. When a word started beyond this page's text (it belongs to another page), it
   returned `null` with only a console warning.

## Decision

Extract the offset→node arithmetic into a pure, unit-tested
`resolveCharRange(nodeLengths, charOffset, charLength): ResolvedCharRange | null`
in `src/lib/tts-tracking.ts`:
- Returns `null` when `charOffset >= total` (word off this page).
- Clamps an overrun to the **last** node's end and sets `clamped: true` — so a
  word straddling a page boundary highlights its on-page portion.
- Exact-end (`target === total`) is not marked clamped.

`createWordRange` now collects the text nodes once and delegates, then
`setStart`/`setEnd` by resolved index/offset.

## Scope

- `src/lib/tts-tracking.ts` (+pure fn + type), `TtsWordHighlight.tsx` (rewire),
  `src/__tests__/unit/tts-range.test.ts` (7 tests).

No new deps, no Tauri scope/capability change, no boundary impact. Frontend only.

## Verification

- `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run
  …tts-range.test.ts` → 7/7 pass.
- Codex: VERDICT PASS, no findings; ran `tsc` itself. Its two TEST-GAP notes
  (a vacuous clamp test; missing `>total` off-page case) addressed via amend
  (`.claude/reviews/025-page-boundary.md`).
- REMAINING (manual GUI): the actual highlight render (CSS Highlight API is
  absent in jsdom) — the pure arithmetic is fully tested; the DOM mapping is not.

## Rollback

Revert the commit — `createWordRange` returns to its inline form. Behavior
returns to the prior (buggy) clamp; no data impact.

## Checklist

- [x] Hexagonal boundaries: pure `src/lib` util used by a component.
- [x] No direct `invoke()`.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none.
- [x] Offline behavior: unaffected.
- [x] Frontend tests: +7 unit tests; lint/typecheck green.
- [x] Backend tests: N/A.
- [x] Build/bundle smoke: N/A (frontend only).
- [x] Accessibility impact: positive (more reliable highlight at page edges).
- [x] Rollback: documented.
- [x] Codex review: PASS.

## #7 status + what's next

#7 karaoke is now logic-complete at the unit level: pt.1 word-at-time selection
(022), pt.2 reduced-motion (023), pt.3 sentence-fallback foundation (024), pt.4
page-boundary (025). NOT yet done: **end-to-end GUI verification** of the karaoke
highlight during real playback (needs Pedro / a running app), and **pt.3b** —
wiring the sentence fallback, which is parked on exposing the real audio
duration from the backend player (else the highlight completion check can cut
off audio). A small backend "expose audio duration / playback-ended" slice
unblocks pt.3b; after that, **P2 #8 pdf.js 5.x**.
