# Codex Adversarial Review — 026-audio-duration (TTS completion guard)

- **Date:** 2026-05-31
- **Commit:** `3ab99a1` (branch `026-audio-duration`, base `origin/main` 8c366d7)
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src/lib/tts-tracking.ts` (+`isPlaybackComplete`), `src/hooks/useTtsWordHighlight.ts` (use it), `src/__tests__/unit/tts-playback-complete.test.ts`.

## Verdict: PASS

**BLOCKER / MAJOR / MINOR:** none.

Codex confirmed:
- **The fix is correct + addresses a real bug.** With `totalDuration 0` (missing ElevenLabs alignment) the old `elapsed >= state.totalDuration` was true on the first frame; `onComplete` → `handlePlaybackComplete` advances the page when auto-page is on (`AiPlaybackBar.tsx:118`). The new predicate requires `totalDurationSeconds > 0`, so missing alignment no longer fires completion on frame 1.
- **Positive-duration path preserved** — still `elapsed >= totalDuration`, exact-end inclusive; the hook rewire is a direct substitution with no other control-flow change.
- **The trade-off is the lesser evil** (the question I posed): with `totalDuration === 0` the rAF loop now won't timer-complete and runs until stop/unmount — but *"refusing to infer completion from an unknown duration is the safer behavior"* than auto-advancing while audio just started. The proper fix is a real audio-finished signal, which the backend admittedly cannot emit today (`commands/ai_tts.rs:88`).
- No new deps, no package/lockfile, no Rust/Tauri scope change, no new `invoke`; pure util stays in `src/lib`.

**TEST GAPS:** Codex couldn't run the tests (no `pnpm`/network in sandbox); confirmed by static review the cases cover zero/negative duration + before/exact/after-end. Verified here: `pnpm lint` 0 errors, `pnpm typecheck` exit 0, `pnpm exec vitest run …tts-playback-complete.test.ts` → 3/3 pass.

Full log: `/tmp/lectrice-026-codex.log`.

## Note: the real pt.3b unblock

This iteration set out to "expose audio duration" to unblock pt.3b but found that is **not a clean unit-slice**: rodio's MP3 `total_duration()` is typically `None`, and the codebase itself states it "can't detect when audio actually finishes" (`commands/ai_tts.rs:88`). The correct unblock is a backend **audio-finished detection** (poll `sink.empty()` on a thread → emit an `ai-tts:finished` event → frontend drives completion/auto-advance off that, not the timer). That is an architecture change requiring GUI verification — Pedro/GUI-gated, not a loop slice. This completion-guard is a safe step in that direction (it stops the timer from lying when there is no duration).
