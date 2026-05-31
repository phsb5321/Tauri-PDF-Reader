# GUI Validation Checklist — Merge Train 019→026

**Why this exists:** the merge train's unit/integration checks pass in the sandbox, but several behaviors can only be proven by running the real app (rodio audio, ElevenLabs streaming, niri window, `prefers-reduced-motion`, restart persistence). Per project rules, **none of these may be marked passed until Pedro actually runs Lectrice.** This file is the script.

- **Branch under test:** `integrate/019-026-merge-train` (worktree `../tauri-pdf-reader-merge-train`).
- **Build:** `export PATH="$HOME/.local/share/pnpm:$PATH"` then, inside the project nix-shell, `pnpm tauri dev` (or a release build). Record the app version + `git rev-parse --short HEAD`.
- **Record per step:** PASS/FAIL + a screenshot or log line. Capture `~/.local/share/<app>/logs` or stderr for the `[TTS]` / `[TtsWordHighlight]` debug lines.

## Steps

| #   | Slice                              | What to do                                                                                                                        | Expected (PASS)                                                                                                                               | Fail signal                                |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | baseline                           | Launch app, open a known multi-page PDF                                                                                           | App opens, page renders, text layer selectable                                                                                                | crash / blank canvas                       |
| 2   | 020 persisted-scope                | Open a PDF from an **arbitrary path** (not app data dir), quit fully, relaunch, reopen it from the library                        | Reopens via `readFile(originalPath)` with **no re-grant / no file-picker re-prompt**                                                          | "permission denied" / re-prompt            |
| 3   | baseline TTS                       | Start normal sentence playback (native or AI TTS)                                                                                 | Audio plays; sentence highlight advances                                                                                                      | no audio / no highlight                    |
| 4   | 021 + 022 karaoke                  | Use the timestamp-backed AI path (ElevenLabs with-timestamps, or fixture); play a chunk                                           | **Word-level** highlight tracks the spoken word in time (not just sentence)                                                                   | highlight stuck / wrong word / off-by-one  |
| 5   | 025 page-boundary                  | Play a chunk whose text **straddles a page boundary**                                                                             | Word highlight maps correctly across the page break; no highlight on the wrong page                                                           | highlight on wrong page / missing rects    |
| 6   | 024 + 026 fallback / zero-duration | Play a chunk where alignment is **missing** (force sentence-fallback / a zero-duration/empty alignment response)                  | Playback does **not** instantly "complete"; with auto-page ON it does **not** skip the page on the first frame; falls back to sentence timing | immediate completion / premature page skip |
| 7   | 023 reduced-motion                 | Enable `prefers-reduced-motion` (niri/GTK or OS setting), play with follow-along                                                  | Scroll-to-word **jumps instantly** (no smooth animated scroll); motion-respecting                                                             | smooth animated auto-scroll still occurs   |
| 8   | 018 (if applied separately)        | (Only if 018-render-perf is layered) GPU compositing on, niri-managed frame (no JS titlebar), AT-SPI menu visible in noctalia bar | Native niri decorations; app menu actions appear in noctalia bar                                                                              | JS titlebar present / menu missing         |

## Notes / known gaps

- **Audio-finished detection is still GUI-gated and not yet wired** (proposal: backend polls `sink.empty()` → emits `ai-tts:finished` → event-driven completion). 026's `isPlaybackComplete` guard is the _interim_ protection against the zero-duration premature-skip; step 6 exercises it.
- **Speed 2×–4.5×** is out of scope here (rodio `set_speed` shifts pitch; needs pitch-preserving DSP).
- rodio playback is not unit-testable → steps 3–6 are the only proof.
