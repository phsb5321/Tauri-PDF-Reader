# Implementation Plan: Kokoro Offline Voice — Timestamp-Adoptability Spike

**Branch**: `055-kokoro-offline-voice` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/055-kokoro-offline-voice/spec.md`

## Summary

Capture Kokoro's native per-token timestamps ONCE into two committed JSON
fixtures, add a pure converter (`src/lib/kokoro-word-timings.ts`) that turns a
capture into the repo's existing `WordTiming[]`, and assert the adoptability
question through the REAL production highlight loop on a controlled clock.
Deliverable is a verdict backed by a runnable test, not a recommendation:
`pnpm exec vitest run src/__tests__/integration/kokoro-word-timings.test.ts`.

No provider is wired, no Rust is touched, no dependency is added. The spike's
output is evidence plus [decision.md](./decision.md).

## Technical Context

**Language/Version**: TypeScript 5.6 (converter + tests). Python 3.12 for the
one-shot capture script, which is NOT part of the build or CI.
**Primary Dependencies**: none added. Tests use the repo's existing vitest 2.1 +
`@testing-library/react`. The capture used `kokoro` 0.9.4 / `misaki` /
`phonemizer` 3.3.2 / `espeak-ng` 1.52.0.1 in a throwaway venv outside the repo.
**Storage**: two JSON fixtures under `src/__tests__/fixtures/` (1.3 KB + 1.6 KB).
**Testing**: `pnpm exec vitest run
src/__tests__/integration/kokoro-word-timings.test.ts` (9 tests), plus
`pnpm lint:boundaries`, `pnpm test:arch`, `pnpm typecheck`.
**Target Platform**: N/A — the spike is analysis; the fixtures are platform-free
JSON.
**Project Type**: single desktop app (Tauri); this feature is frontend-only
evidence.
**Performance Goals**: N/A. The measured quantity is timing ACCURACY (seconds of
highlight error), not throughput.
**Constraints**: tests must run offline with no model weights; `src-tauri/` and
`.github/workflows/` untouched; no new dependency; hexagonal boundaries hold.
**Scale/Scope**: 1 converter module, 1 test file, 2 fixtures, 1 capture script.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Verification Discipline**: the claim under test ("Kokoro's timestamps can
  drive Lectrice's karaoke highlight") is mechanized at the highest rung the
  ladder allows without a device — the **state machine on a controlled clock**,
  driving the shipping `useTtsWordHighlight` loop, with `performance.now` and
  `requestAnimationFrame` stubbed. Pixels and speakers are never the oracle.
  The one thing a spike could legitimately have deferred to ears — "does the
  JS/ONNX path drift noticeably" — is instead a measured number of seconds.
  **PASS.**
- **Falsifiability**: every hazard gets a negative control that is run and whose
  failure count is recorded, so no assertion can be a silent no-op. **PASS.**
- **Merge Ownership**: the diff is `specs/**`, `docs/**`, `src/lib/**`,
  `src/__tests__/**` — code/docs, ≤ 1 service, revertible by one PR. Self-merge
  class once green + review-clean. **PASS.**
- **must_not_touch**: no `.github/workflows/*`; no
  `src-tauri/src/ai_tts/player.rs`; no test weakened, skipped, or deleted (the
  suite is purely additive). **PASS.**
- **Ponytail / minimum diff**: reuses `WordTiming`, `useTtsWordHighlight`,
  `useTtsHighlightStore` and the `karaoke-sync.test.ts` clock harness rather
  than introducing a parallel type or a second test scaffold. **PASS.**

No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```
specs/055-kokoro-offline-voice/
├── spec.md            # what must hold
├── plan.md            # this file
├── tasks.md           # the ordered work, with FR/SC citations
├── decision.md        # the verdict + the measured bound
└── capture-kokoro.py  # fixture provenance; run manually, never by CI
```

### Source (repository root)

```
src/
├── lib/
│   └── kokoro-word-timings.ts          # NEW — capture → WordTiming[]
└── __tests__/
    ├── fixtures/
    │   ├── kokoro-af-heart-single-chunk.json   # NEW — 1 chunk, 5 tokens
    │   └── kokoro-af-heart-multi-chunk.json    # NEW — 2 chunks, 6 tokens
    └── integration/
        └── kokoro-word-timings.test.ts          # NEW — 9 tests
```

**Structure Decision**: the converter lives in `src/lib/`, not `src/domain/`,
because it emits `WordTiming` and that type is declared in
`src/lib/api/ai-tts.ts` — the boundary matrix in `eslint.config.js` allows
`domain → [domain, ports]` only, so a domain module cannot import it.
`src/lib/tts-tracking.ts` is the existing precedent for timing helpers in
`lib`. Placing it anywhere else fails `pnpm lint:boundaries`, which is why that
gate runs first.

## Phase 0 — Research

Three questions had to be answered before any code:

1. **Does Kokoro expose per-token timestamps at all?** Yes, on the Python
   `KPipeline` path: each token carries `start_ts` / `end_ts`. The `kokoro-js`
   ONNX/WASM port does not.
2. **What unit are the timestamps in?** Not documented. Determined empirically
   from the multi-chunk capture: **seconds relative to the chunk**, not the
   utterance — chunk 1's first token reports `0.3` even though 1.9 s of audio
   precedes it. This is the single load-bearing finding of the spike.
3. **What is a chunk?** `KPipeline`'s default split pattern is `\n+`, so a
   chunk is a newline-delimited segment — NOT a sentence. A paragraph of prose
   with no newlines is one chunk regardless of length.

Blocker resolved during research: `espeakng-loader` bakes its build machine's
path into the shipped `.so`, so espeak died on `phontab`. `misaki` sets
`EspeakWrapper`'s class attributes at import time and those WIN over
`PHONEMIZER_ESPEAK_DATA_PATH`, so the nix espeak path has to be installed
**after** importing kokoro. Recorded in `capture-kokoro.py`'s header comment so
a re-capture does not rediscover it.

## Phase 1 — Design

- **Converter contract**: `kokoroToWordTimings(capture) → { wordTimings,
  totalDuration, skippedTokens }`. Per chunk: locate `graphemes` in the source
  text from a monotonically advancing cursor (re-anchoring character offsets,
  which is required because the `\n` separator appears in no token's
  `whitespace`), walk tokens adding `timeOffset`, then advance `timeOffset` by
  `audio_samples / sample_rate`.
- **Failure mode**: a chunk whose text is not found throws. Silently emitting
  offsets that point at the wrong characters would highlight the wrong words
  for the rest of the document — worse than a visible error.
- **`uniformApproximationError(capture)`**: models the best a timestamp-less
  runtime can do (length-weighted proportional spread within each chunk) and
  returns the worst |guess − real `start_ts`| in seconds. Length-weighting is
  the generous model, so the number is a FLOOR on the JS path's error.
- **Test harness**: mirrors `karaoke-sync.test.ts` — hoisted `vi.mock` for
  `lib/api/ai-tts` and `lib/tauri-invoke`, `performance.now` spied,
  `requestAnimationFrame` stubbed into a manual frame queue, `tick(atMs)`
  driving frames inside `act()`.

## Phase 2 — Verification strategy

Cheapest oracle first: `lint:boundaries` → `test:arch` → `typecheck` → the
focused vitest file. No backend gate: the diff contains no Rust.

Each hazard carries a negative control, run and recorded:

| NC | Mutation | Expected |
|----|----------|----------|
| NC1 | drop the `timeOffset` accumulation | chunk-2 words land at raw marks |
| NC2 | reuse one running char cursor instead of re-anchoring per chunk | offsets skew by the `\n` |

A baseline run brackets each control so the restore is proved, not assumed.

## Complexity Tracking

*No constitution violations. Table intentionally empty.*
