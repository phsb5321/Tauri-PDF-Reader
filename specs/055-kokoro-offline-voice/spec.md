# Feature Specification: Kokoro Offline Voice — Timestamp-Adoptability Spike

**Feature Branch**: `055-kokoro-offline-voice`
**Created**: 2026-07-31
**Status**: Complete — verdict in [decision.md](./decision.md)
**Input**: Tier-3 backlog remainder, "Kokoro offline-voice spike". Dispatch
constraint: the verdict must be *mechanical* — cache-key a fixture, assert
grouped-word spans are monotonic and cover the text, assert the highlight index
derives from `start_time` boundaries. "Looks promising" is not a verdict.

## Context (non-normative)

Lectrice's karaoke highlight is driven by `WordTiming[]` — `{ word, startTime,
endTime, charStart, charEnd }` — produced today by `chars_to_words` in
`src-tauri/src/ai_tts/elevenlabs.rs`, which groups ElevenLabs' per-CHARACTER
alignment into words. Every downstream consumer (`tts-highlight-store`,
`useTtsWordHighlight`, `findWordIndexAtTime`, `TtsWordHighlight.tsx`) is
written against that shape.

Kokoro is a candidate offline replacement. It is small (82M), permissively
licensed, and runs locally — which would remove the cloud dependency and the
per-character billing. The open question is not audio quality; it is whether
Kokoro's timing output can feed the existing highlight contract, because a
voice that cannot drive the highlight is a different product.

**Scope**: a spike. Captured fixtures, a pure converter, and runnable
assertions. No provider is added, no Rust adapter is written, no setting is
exposed, and `src-tauri/` is not touched.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Decide whether Kokoro can drive the highlight (Priority: P1)

As the engineer choosing Lectrice's next TTS provider, I need to know whether
Kokoro's timing output satisfies the karaoke contract *before* anyone builds an
adapter, so that a week of adapter work is not spent discovering the timestamps
are unusable.

**Why this priority**: This is the entire spike. It is the MVP and the only
story.

**Independent Test**: Run `pnpm exec vitest run
src/__tests__/integration/kokoro-word-timings.test.ts` on a machine with no
network, no model weights, and no audio device. It passes or it fails; either
outcome is the verdict.

**Acceptance Scenarios**:

1. **Given** a captured Kokoro synthesis of a single-line text, **When** it is
   converted to `WordTiming[]`, **Then** every span is monotonic
   (`endTime > startTime`, and each `startTime` is at or after the previous
   `endTime`) and every `charStart`/`charEnd` pair slices the source text back
   to exactly the spoken word.
2. **Given** a captured synthesis of a text that Kokoro splits into **two**
   chunks, **When** it is converted, **Then** the second chunk's words are
   placed after the first chunk's audio, not at their raw chunk-relative marks.
3. **Given** the converted timings, **When** they are fed through the real
   `useTtsWordHighlight` loop on a controlled clock, **Then**
   `currentWordIndex` becomes `i` on the first animation frame at or after
   `wordTimings[i].startTime`, for every `i`.
4. **Given** a capture whose chunk text does not occur in the source, **When**
   it is converted, **Then** the converter throws rather than emitting offsets
   that would highlight the wrong characters.
5. **Given** either capture, **When** the timestamp-less (ONNX/WASM) path is
   modelled, **Then** the resulting error is reported as a measured number of
   seconds, not an adjective.

### Edge Cases

- **Tokens with no mark.** Kokoro may return `start_ts: null` for a token. The
  converter counts these (`skippedTokens`) and advances the character cursor
  without emitting a highlight, so offsets after them stay correct. Both
  captures happen to have zero, which the fixture-integrity test asserts — so
  if a future capture does contain one, the assertion changes deliberately
  rather than silently.
- **Leading and trailing silence.** Kokoro's first mark starts at 0.275 s / 0.35 s,
  and audio continues past the last mark's end. The highlight loop must clamp
  to word 0 before the first mark and hold the last word through the tail.
- **The split separator is in no token.** The last token of a chunk has
  `whitespace: ""`, so token text alone does not reconstruct the source across
  a chunk boundary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** — Fixtures MUST be real captured Kokoro output, committed to the
  repo, with the capture script alongside them for provenance.
- **FR-002** — Each fixture MUST carry a `cache_key` = SHA-256 of
  `kokoro|<lang>|<voice>|<text>`, so a re-capture that changes any input is a
  different key rather than a silent overwrite.
- **FR-003** — The test suite MUST NOT call a model, download a weight, open a
  network socket, or play audio.
- **FR-004** — At least one fixture MUST contain ≥ 2 chunks, or the
  chunk-offset hazard is untested.
- **FR-005** — The converter MUST emit the repo's existing `WordTiming` type,
  imported — not a parallel type declared for the spike.
- **FR-006** — Character offsets MUST be UTF-16 code units, matching what
  `chars_to_words` emits, so a highlight indexes page text identically
  regardless of provider.
- **FR-007** — The index-derivation claim MUST be asserted through the real
  `useTtsWordHighlight` production loop, not a re-implementation.
- **FR-008** — The cost of a timestamp-less runtime MUST be a measured number
  in seconds, asserted by a test and quoted in the decision.
- **FR-009** — Every assertion MUST be shown able to fail: at least one
  negative control per hazard, with the failure count recorded.

### Key Entities

- **`KokoroCapture`** — `{ sample_rate, text, chunks[] }` as written by the
  capture script.
- **`KokoroChunk`** — `{ index, graphemes, audio_samples, tokens[] }`. The unit
  on which Kokoro's clock restarts.
- **`KokoroToken`** — `{ text, whitespace, start_ts, end_ts, phonemes }`.
  Timestamps are seconds relative to the chunk, not the utterance.
- **`WordTiming`** — the existing highlight contract, unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** — `pnpm exec vitest run
  src/__tests__/integration/kokoro-word-timings.test.ts` passes offline.
- **SC-002** — Both fixtures convert with `skippedTokens === 0` and full
  character coverage: every non-whitespace character of the source is claimed
  by exactly one word.
- **SC-003** — The multi-chunk fixture's second chunk starts after the first
  chunk's full audio duration, asserted to 6 decimal places.
- **SC-004** — The production highlight loop reaches index `i` at
  `startTime[i]` for all `i` in the multi-chunk capture, and completes exactly
  once at `totalDuration`.
- **SC-005** — The timestamp-less approximation error is a pinned number, and
  is shown to be bounded by one chunk's duration.
- **SC-006** — Each hazard has a negative control that reproduces failures.
- **SC-007** — The diff touches no `src-tauri/`, no `.github/workflows/`, and
  adds no dependency.
