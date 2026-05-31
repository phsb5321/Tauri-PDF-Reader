# Spec 026 — Guard TTS Completion Against Zero Duration

## Problem

This iteration's planned slice was "expose audio duration to unblock pt.3b."
Investigation showed that is **not a clean unit-slice**: rodio's MP3
`total_duration()` is typically `None`, and the backend "can't detect when audio
actually finishes" (`commands/ai_tts.rs:88`) — completion is frontend
timer-driven. Tracing that path surfaced a **real bug**:

When ElevenLabs returns no per-word alignment, the timestamps response reports
`totalDuration = 0`. The highlight loop's completion check,
`elapsed >= state.totalDuration`, is then true on the very first animation frame,
firing `onComplete` → `handlePlaybackComplete`, which (with auto-page enabled)
advances to the next page **while the current page's audio has only just
started**.

## Decision

Extract a pure `isPlaybackComplete(elapsedSeconds, totalDurationSeconds) =
totalDurationSeconds > 0 && elapsedSeconds >= totalDurationSeconds` into
`tts-tracking.ts` and use it in the hook. The `> 0` guard means a missing-
alignment (duration-0) response no longer times-out to completion; with no real
duration there is nothing to time against, so the timer must not declare
completion. Positive-duration playback is unchanged (exact-end inclusive).

Trade-off (Codex-validated as the lesser evil): with `totalDuration === 0` the
rAF loop won't timer-complete and runs until stop/unmount — preferable to
auto-advancing mid-audio. The proper completer for that case is a real
audio-finished signal (see "Next").

## Scope

- `src/lib/tts-tracking.ts` (+pure fn), `src/hooks/useTtsWordHighlight.ts`
  (use it), `src/__tests__/unit/tts-playback-complete.test.ts` (3 tests).

No new deps, no Tauri scope/capability change, no boundary impact. Frontend only.

## Verification

- `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run
  …tts-playback-complete.test.ts` → 3/3 pass.
- Codex: VERDICT PASS, no findings; confirmed the fix + the trade-off
  (`.claude/reviews/026-completion-guard.md`).

## Rollback

Revert the commit — completion returns to the bare `elapsed >= totalDuration`
(re-introducing the duration-0 first-frame completion). No data impact.

## Checklist

- [x] Hexagonal boundaries: pure `src/lib` util used by a hook.
- [x] No direct `invoke()`.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none.
- [x] Offline behavior: unaffected.
- [x] Frontend tests: +3 unit tests; lint/typecheck green.
- [x] Backend tests: N/A.
- [x] Build/bundle smoke: N/A (frontend only).
- [x] Accessibility impact: positive (no spurious page-skip during playback).
- [x] Rollback: documented.
- [x] Codex review: PASS.

## Next — the real audio-finished signal (GUI/architecture-gated)

Completes BOTH pt.3b (safe fallback wiring) AND this completion path properly:
poll `sink.empty()` on a background thread in the player → emit `ai-tts:finished`
→ frontend drives completion/auto-advance off that event instead of the timer.
This is a backend+frontend architecture change that needs GUI verification (rodio
playback isn't unit-testable), so it is **Pedro/GUI-gated**, not a clean loop
slice. After it: P2 #8 pdf.js 5.x.
