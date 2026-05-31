# Spec 022 — Karaoke Word-at-Time Selection: Extract + Test (P1 #7, part 1)

## Problem

P1 slice #7 ("karaoke highlight UI — word under the playback head"). A gap
analysis (Explore agent) found the consumer largely built — `useTtsWordHighlight`,
`TtsWordHighlight.tsx`, `tts-highlight-store` (tested in 011) — and "no per-tick
DOM thrash" already DONE (diffed updates). The core selection — *which word is
active at the current playback time* — was correct but **baked into the rAF
callback** (`useTtsWordHighlight.ts:80–104`), so it could not be unit-tested.
(`tts-tracking.ts` has a `getCurrentWordIndex` for estimated chunk timings, but
its semantics differ — returns `0` pre-start, no gap-fill — and it is unused by
the highlight path.)

## Decision

Extract the selection loop **verbatim** (behavior-preserving) into a pure,
exported `findWordIndexAtTime(elapsedSeconds, wordTimings)` in
`src/lib/tts-tracking.ts`; rewire the hook to call it; add unit tests pinning
the semantics. Structural `{ startTime, endTime }` param keeps it decoupled from
the full `WordTiming` binding.

Semantics (identical to the original): in-range `[startTime, endTime)` →
gap-fill (hold word `i` during a silent gap before `i+1`) → tail (hold last word
once `elapsed >= last.startTime`) → `-1` before the first word / empty list.

## Scope

- `src/lib/tts-tracking.ts` — add `findWordIndexAtTime`.
- `src/hooks/useTtsWordHighlight.ts` — import + replace the inline loop with one call (the no-thrash diff gate is unchanged).
- `src/__tests__/unit/tts-tracking.test.ts` — 7 tests.

No behavior change, no new deps, no Tauri/scope/boundary impact. Frontend only.

## Verification

- `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run
  src/__tests__/unit/tts-tracking.test.ts` → 7/7 pass.
- Codex review: VERDICT PASS, no findings; line-by-line confirmed the extraction
  is behavior-preserving (`.claude/reviews/022-karaoke-ui.md`).

## Rollback

Revert the commit — re-inlines the loop. Zero runtime impact (behavior identical).

## Checklist

- [x] Hexagonal boundaries: pure `src/lib` util consumed by a hook — within bounds.
- [x] No direct `invoke()`: none added.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none.
- [x] Offline behavior: unaffected.
- [x] Frontend tests: +7 unit tests; lint/typecheck green.
- [x] Backend tests: N/A.
- [x] Build/bundle smoke: N/A (no Rust/config change).
- [x] Accessibility impact: none in this part (reduced-motion is the next part).
- [x] Rollback: documented.
- [x] Codex review: PASS.

## Remaining #7 work (next parts)

Still MISSING per the gap analysis, in priority order:
1. **Reduced-motion** — `AiPlaybackBar` scroll-to-word uses `behavior: "smooth"`
   unconditionally; guard on `prefers-reduced-motion` (small a11y fix + test).
2. **Sentence-level fallback** — when `wordTimings` is empty/sparse, fall back to
   chunk/sentence highlighting instead of showing nothing.
3. **Page-boundary** — a word range crossing a PDF page container fails silently
   in `TtsWordHighlight.createWordRange`; detect + degrade gracefully.
