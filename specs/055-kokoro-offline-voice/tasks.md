# Tasks: Kokoro Offline Voice — Timestamp-Adoptability Spike

**Feature**: `055-kokoro-offline-voice` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Dependency-ordered. Single MVP slice (User Story 1, P1). `[X]` = done.

## Phase 1 — Get real Kokoro output (fixture capture)

- [X] **T001** — Stand up a throwaway `kokoro` 0.9.4 venv OUTSIDE the repo
  (`uv venv` + `uv pip install kokoro soundfile`), with `HF_HOME` pointed at
  scratch so no weight lands in the working tree. (FR-003)
- [X] **T002** — Break the espeak blocker. `espeakng-loader` ships a `.so` with
  its build machine's data path baked in, so phonemization died on
  `Error processing file '/home/runner/work/espeakng-loader/.../phontab': No
  such file or directory.` Root cause found by reading
  `phonemizer/backend/espeak/{wrapper,api}.py`: `misaki` sets
  `EspeakWrapper._ESPEAK_DATA_PATH` at import time and class attributes WIN over
  `PHONEMIZER_ESPEAK_DATA_PATH`. Fix: call `EspeakWrapper.set_library` /
  `set_data_path` with the nixpkgs espeak-ng paths AFTER importing kokoro.
  (Recorded in `capture-kokoro.py`.)
- [X] **T003** — Write `capture-kokoro.py`: emits `sample_rate`, `text`,
  `cache_key = sha256("kokoro|<lang>|<voice>|<text>")`, and per chunk
  `graphemes` / `audio_samples` / `tokens[{text, whitespace, start_ts, end_ts,
  phonemes}]`. (FR-001, FR-002)
- [X] **T004** — Capture `kokoro-af-heart-single-chunk.json` —
  `"alpha beta gamma delta epsilon"`, 1 chunk, 62 400 samples. (FR-001)
- [X] **T005** — Capture `kokoro-af-heart-multi-chunk.json` —
  `"alpha beta gamma\ndelta epsilon zeta"`, 2 chunks (45 600 + 51 000 samples).
  Required because a single-chunk fixture cannot expose the chunk-offset
  hazard, and that hazard turned out to be the finding. (FR-004)
- [X] **T006** — Commit both fixtures + the capture script into
  `specs/055-kokoro-offline-voice/` so provenance travels with the evidence.
  (FR-001)
- [X] **T006a** — Make provenance checkable rather than asserted: `sort_keys` +
  `ensure_ascii=False` so re-running the script reproduces each committed
  fixture **byte-for-byte** (`diff` is empty). Verified after the T002 import
  restructure, so the fix to the alignment gate's lint-suppression finding is
  proved not to have changed the captured data. (FR-001, FR-002)

## Phase 2 — Converter

- [X] **T007** — Add `src/lib/kokoro-word-timings.ts` exporting `KokoroToken`,
  `KokoroChunk`, `KokoroCapture`, `KokoroConversion` and `kokoroToWordTimings`,
  importing the repo's own `WordTiming` from `lib/api/ai-tts`. Placed in
  `src/lib/` because `domain → [domain, ports]` cannot reach `lib`.
  (FR-005, FR-006)
- [X] **T008** — Offset each chunk's marks by the summed audio duration of the
  preceding chunks (Kokoro restarts the clock per chunk). (FR-005)
- [X] **T009** — Re-anchor character offsets per chunk by locating `graphemes`
  in the source from a monotonic cursor — token `whitespace` does not contain
  the `\n+` split separator, so concatenation does not reconstruct the source.
  (FR-006)
- [X] **T010** — Throw when a chunk's text is absent from the source instead of
  emitting offsets that would highlight the wrong characters. (FR-005)
- [X] **T011** — Count `start_ts: null` tokens as `skippedTokens`, advancing the
  character cursor without emitting a highlight. (spec Edge Cases)
- [X] **T012** — Add `uniformApproximationError(capture)`: length-weighted
  proportional spread per chunk vs the real marks, worst |Δ| in seconds — the
  cost of a timestamp-less runtime as a number. (FR-008)

## Phase 3 — Runnable assertions

- [X] **T013** — `src/__tests__/integration/kokoro-word-timings.test.ts`:
  fixture-integrity group — both captures are 24 kHz, every token has numeric
  `start_ts`/`end_ts`, and MULTI really has ≥ 2 chunks. (FR-001, FR-004)
- [X] **T014** — Monotonicity, for both fixtures: `endTime > startTime`,
  `endTime ≤ totalDuration`, and no span starts before the previous one ends.
  (SC-002)
- [X] **T015** — Coverage, for both fixtures: `text.slice(charStart, charEnd)
  === word`, plus a per-character claim array asserting every non-whitespace
  character is claimed by exactly one word (catches a dropped or
  double-counted token, which the slice check alone would not). (SC-002)
- [X] **T016** — Chunk offset: chunk 1's raw mark is < chunk 0's duration, the
  converted `startTime` equals `firstChunkSeconds + start_ts` to 6 dp, and
  `totalDuration` equals Σ samples / rate. (SC-003)
- [X] **T017** — The converter throws `/does not occur in the source text/` on a
  corrupted capture. (spec Acceptance 4)
- [X] **T018** — Pin the approximation error: `0.4433 s` (single) and `0.4778 s`
  (multi) to 3 dp, and assert `multi < longestChunkDuration` so the bound is
  shown to be per-chunk rather than cumulative. (SC-005, FR-008)
- [X] **T019** — Drive the REAL `useTtsWordHighlight` loop on a controlled clock
  (`performance.now` spied, `requestAnimationFrame` stubbed into a manual frame
  queue, as in `karaoke-sync.test.ts`): leading silence clamps to index 0, each
  word becomes current on the first frame at/after its own `startTime`, the last
  word holds through trailing silence, then the duration guard completes once.
  (SC-004, FR-007)

## Phase 4 — Prove the assertions can fail

- [X] **T020** — NC1: delete the `timeOffset` accumulation → chunk-2 words land
  at raw marks. Recorded failure count. (SC-006, FR-009)
- [X] **T021** — NC2: use one running char cursor instead of re-anchoring per
  chunk → offsets skew by the `\n`; 2 failed / 7 passed. (SC-006, FR-009)
- [X] **T022** — Restore and re-run baseline → 9 passed, proving the restore
  rather than assuming it. Note: the shell's `cp` is aliased to `cp -i`, which
  silently no-ops a restore; use `command cp -f`. (SC-006)

## Phase 5 — Verify gate

- [X] **T023** — `pnpm lint:boundaries` (cheapest oracle; the converter's
  placement depends on it). (SC-007)
- [X] **T024** — `pnpm test:arch`. (SC-007)
- [X] **T025** — `pnpm typecheck`.
- [X] **T026** — `pnpm exec vitest run
  src/__tests__/integration/kokoro-word-timings.test.ts` → 9 passed. Note:
  `pnpm test` is vitest **watch** — never use it here. (SC-001)
- [X] **T027** — `git diff --stat` confirms no `src-tauri/`, no
  `.github/workflows/`, no `package.json` dependency change. (SC-007)

## Phase 6 — Verdict, review, ship

- [X] **T028** — Write `decision.md`: the verdict, the chunk-relative-timestamp
  finding, the measured approximation floor, and what an adapter would owe.
  (FR-008)
- [X] **T029** — Different-family adversarial review of the diff (Groq
  `openai/gpt-oss-120b`; codex is usage-capped until 01/08 17:16), including the
  explicit blocker class "did this slice mechanize its acceptance claim, or
  defer a verifiable property to a human?". Line citations verified against the
  real files before acting.
- [X] **T030** — Update `docs/agent-backlog-state.md` in the same PR as the
  slice.
- [X] **T031** — Open the PR, poll the shared `vm103` runner to green without
  queueing parallel runs, then merge and confirm `state == MERGED`.
