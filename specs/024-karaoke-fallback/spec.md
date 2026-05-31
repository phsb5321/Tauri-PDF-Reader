# Spec 024 — Sentence-Level Karaoke Fallback Timings (P1 #7 pt.3, foundation)

## Problem

P1 #7 gap (from spec 022 analysis): when ElevenLabs returns no per-word
alignment, `useTtsWordHighlight` gets empty `wordTimings` and the karaoke
highlight shows **nothing** — no progress indication during playback.

## Decision

Add the pure, deterministic building blocks for a sentence-level fallback to
`src/lib/tts-tracking.ts`:

- `segmentSentencesWithOffsets(text): SentenceSpan[]` — split into sentences,
  tracking each sentence's `[charStart, charEnd)` as ORIGINAL-text JS/UTF-16
  indices, so a highlight overlay can build DOM ranges over the rendered text
  layer. (text-chunking's `splitIntoSentences` normalizes whitespace first and
  loses offsets, so it can't be reused here.)
- `buildSentenceFallbackTimings(text, totalDurationSeconds): WordTiming[]` — one
  `WordTiming` per sentence; spread duration proportional to char length; the
  last span ends exactly at duration; estimate duration at ~150 wpm when
  `totalDurationSeconds <= 0`.

**Not wired into the hook this slice (deliberate, evidenced).** The highlight
loop completes on `elapsed >= state.totalDuration → onComplete`, and the backend
reports `total_duration = 0` when alignment is absent. Feeding fallback timings
with only an *estimated* duration could mark playback complete before the real
audio ends (cutting it off) or keep highlighting after it ends. Safe wiring
needs a real positive audio duration / playback-ended signal → pt.3b.

## Scope

- `src/lib/tts-tracking.ts` (+2 pure fns, +1 type, +1 const, type-only
  `WordTiming` import), `src/__tests__/unit/tts-fallback.test.ts` (12 tests).

No new deps, no Tauri scope/capability change, no boundary impact, hook behavior
unchanged. Frontend only.

## Verification

- `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run
  …tts-fallback.test.ts` → 12/12 pass.
- Codex: VERDICT PASS, no findings; confirmed offsets correct + the deferral
  legitimate (`.claude/reviews/024-karaoke-fallback.md`).

## Rollback

Revert the commit — removes two unused pure functions + their tests. Zero
runtime impact (nothing imports them yet).

## Checklist

- [x] Hexagonal boundaries: pure `src/lib` utils; type-only cross-import.
- [x] No direct `invoke()`.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none.
- [x] Offline behavior: unaffected.
- [x] Frontend tests: +12 unit tests; lint/typecheck green.
- [x] Backend tests: N/A.
- [x] Build/bundle smoke: N/A (frontend only).
- [x] Accessibility impact: none yet (pt.3b adds the visible fallback).
- [x] Rollback: documented.
- [x] Codex review: PASS.

## Remaining #7 work

- **pt.3b** — wire `buildSentenceFallbackTimings` into the hook's empty-timings
  branch, BUT only after a real audio duration / playback-ended signal exists
  (else the completion check can cut off audio). Needs a small backend change to
  surface the player's duration, then GUI verification.
- **pt.4** — page-boundary range handling in `TtsWordHighlight.createWordRange`
  (a word/sentence range crossing a PDF page container fails silently).
- Then **P2** — pdf.js 5.x upgrade.
