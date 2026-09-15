# Implementation Plan: Source-aligned narration prosody

## Technical Context

- Frontend: TypeScript/React, PDF.js UTF-16 text coordinates, Vitest/fast-check.
- Backend: Rust 2021, Tauri 2, provider registry, strict PCM16 WAV validation, rodio sink completion.
- Base: PR #178 at `951c342a80c11af68784e88e0fb83e8c67e70b42`.
- Research receipt: `/home/notroot/tts-bench-20260822-desktop/prosody-audit-20260826/REPORT.md` (`verify.py` PASS).

## Design

### 1. Spoken-text plan

Add a pure `prosody-plan` module. It consumes normalized source text plus optional PDF block boundaries and emits bounded `SpokenRun` values:

- unchanged `displayText` and source range;
- synthesized `spokenText`;
- sparse `copy|replace|insert|delete` alignment segments in UTF-16 coordinates;
- a provider-neutral boundary class.

The initial repair policy is deliberately narrow: an unterminated structured paragraph/section boundary, or a pinned EN/PT-BR discourse starter following a lowercase source word. Inserted punctuation maps to no source range. Existing grapheme-safe provider splitting remains authoritative.

### 2. PDF extraction evidence

Extend the shared PDF text model with optional segment geometry and line/block boundaries derived from `hasEOL`, transforms, item height, and vertical/indent changes. Text and existing span offsets remain unchanged. A line ending is evidence only; paragraph/section classification requires stronger gap/style evidence.

### 3. Playback integration

Allow the playback bar's page-text supplier to return the structured source model while retaining string compatibility for selection narration and tests. No-mark queues synthesize `spokenText`; highlight timings are projected through each run's alignment before the existing page base offset is added. Prefetch and queue generation guards remain unchanged.

### 4. Heading and paragraph continuity

A size ratio of at least 1.25 plus font change and a baseline gap of at least 1.5× the smaller line height is sufficient section evidence even when `hasEOL=false`. This is the exact shape measured on page 7 of the reported PDF (21.2475pt heading → 15pt body, 27pt gap).

The source/spoken planner inserts an unmapped terminal period after that heading. It preserves the first unit for latency, then merges later complete sentences from the same paragraph while the combined spoken text remains within `min(provider bound, 300 UTF-8 bytes)`. Paragraph and section boundaries stop merging. The boundary class crosses the typed IPC and enters WAV cache identity; native total targets are clause 200ms, sentence 350ms, paragraph 650ms, and section 800ms. This uses Supertonic's documented model context instead of adding word-level pauses; the outer PCM equalizer remains responsible only for boundaries between independent requests.

Primary-source and exact-PDF evidence: `research-heading-continuity.md`.

### 5. PCM boundary equalizer

Extend the existing strict PCM16 WAV adapter with a pure transformation:

- parse mono/stereo PCM16 without a new dependency;
- estimate 10 ms frame activity from a relative floor and signal peak;
- retain 50 ms before first activity and at least 100 ms after last activity;
- make the combined sentence transition 350 ms by rendering the remaining tail once;
- preserve frame/channel alignment and rewrite RIFF/data sizes;
- return unchanged audio for silence-only input and errors for malformed audio.

Apply the transform to no-mark WAV synthesis before cache write and playback. Include a prosody revision in Local/Groq cache coordinates so old raw-padding entries cannot bypass it. MP3/Eleven audio is not decoded/re-encoded in this slice.

### 6. ElevenLabs model correctness

Use one constant `eleven_multilingual_v2` default across request construction, engine configuration, provider revision, and cache fallback. Add a prosody compiler revision to cache settings. No model fallback is introduced.

## Verification strategy

1. Targeted frontend planner/PDF/queue/highlight tests.
2. Targeted Rust WAV/current-model/cache tests with `--features test-mocks -j 1`.
3. `scripts/e2e-prosody.sh` as the fleet executable oracle.
4. Existing seeded fuzz model.
5. Packaged native public-control journey for exact source highlight.
6. Different-family adversarial review of the exact diff.
7. Blind listening remains a separate subjective gate; deterministic audio measurements do not decide it.

## Security and privacy

- No new network destination, dependency, credential storage, or logging.
- Spoken repair runs locally before existing explicit Play dispatch.
- Cloud keys remain native process-memory-only.
- Source text and mapping are ephemeral playback state; no rewritten PDF is persisted.

## Rollback

One revert PR removes the planner/equalizer/model-default changes. Prosody-versioned cache entries are derived data and can remain harmlessly unused.
