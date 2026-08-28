# Feature Specification: Source-aligned narration prosody

**Issue**: #188 (with correctness prerequisite #189)
**Base dependency**: PR #178

## Problem

Narration currently sends flattened PDF text as independently synthesized sentence clips. Providers can return substantial leading and trailing padding, so adjacent clips produce robotic gaps. Missing source punctuation can also create run-on speech. Any spoken-text repair must not alter displayed PDF text or move highlights away from the original UTF-16 source range.

## User Scenarios & Testing

### US1 — Natural sentence boundaries (P0)

As a reader using a provider without native word marks, I hear one bounded sentence transition rather than the provider's leading/trailing padding plus an additional pause.

**Independent acceptance**

- A clean PCM fixture with long edge padding is normalized to the selected sentence target within ±50 ms.
- At least 50 ms before the first detected activity and 100 ms after the last activity are retained.
- Silence-only, malformed, unsupported, or ambiguous audio fails closed without clipping or inventing a pass.
- Queue completion remains driven exactly once by native sink drain after the rendered boundary.

### US2 — Source-aligned spoken repair (P0)

As a reader of a PDF with a high-confidence missing boundary such as `serving Since`, I hear a sentence boundary while selection and read-along still address the unchanged source words.

**Independent acceptance**

- Display/source text remains byte-for-byte unchanged.
- Inserted spoken punctuation has no source range.
- Every spoken source word maps to its original UTF-16 range; no source word is skipped or duplicated.
- Oversized input remains bounded at a grapheme-safe UTF-8 boundary.
- Broad capitalization-based rewriting is forbidden; only structured block boundaries and pinned discourse starters are eligible.

### US3 — Current ElevenLabs reading model (P0)

As an ElevenLabs reader, connecting and pressing Play uses a supported explicit model rather than the removed v1 default.

**Independent acceptance**

- No runtime source contains `eleven_monolingual_v1`.
- The default outbound model is `eleven_multilingual_v2`.
- Exact model and prosody compiler revision participate in cache identity.
- Failure does not silently select another model or provider.
- Credentials remain process-memory-only and absent from logs, storage, and evidence.

### US4 — Heading delivery and connected body speech (P0)

As a reader, I hear a typographic heading as a complete standalone thought, then hear the body with continuity across related sentences rather than a fresh vocal reset after every sentence.

**Independent acceptance**

- The measured `What This Book Is About` geometry is recognized as a section even though PDF.js reports `hasEOL=false`.
- Display text remains `What This Book Is About`; spoken text is `What This Book Is About.` with an unmapped terminal mark.
- The heading remains one short first-audio request and carries an 800ms native section boundary.
- Later complete sentences from the same paragraph share one model request up to 300 UTF-8 bytes.
- No request crosses a paragraph/section or provider bound.
- No fixed pause is inserted between words; within-unit timing remains model-owned.

### US5 — Honest quality gate (P1)

As a reader, I receive no claim that a pacing target is more natural until the retained blind EN/PT-BR listening protocol is scored.

**Independent acceptance**

- Deterministic waveform checks are reported as diagnostics, not a naturalness verdict.
- A packaged public-control journey proves the spoken repair and source highlight remain aligned.
- First audio remains below 3 seconds and sustained local RTF remains at or below 1.0 on the retained corpus.

## Functional requirements

- **FR-001**: The system MUST maintain separate source/display and spoken representations.
- **FR-002**: Spoken insertions MUST carry a null source range.
- **FR-003**: Highlight ranges MUST resolve through the spoken-to-source map before the page offset is applied.
- **FR-004**: PDF extraction MUST retain line/block evidence without treating every line ending as a sentence.
- **FR-005**: PCM edge normalization MUST use a relative activity threshold with onset/tail safety pads.
- **FR-006**: Cache coordinates MUST include the audio-normalizer/planner revision.
- **FR-007**: Stop, provider switch, and stale synthesis MUST preserve the existing generation guards.
- **FR-008**: Text MUST leave Lectrice only after the existing explicit Play/Read-from-here boundary.
- **FR-009**: The ElevenLabs default MUST be a current explicit model and MUST NOT silently fall back.
- **FR-010**: Objective audio/ASR measurements MUST NOT be described as human preference.
- **FR-011**: Strong typographic heading evidence MUST remain usable when PDF.js omits `hasEOL`.
- **FR-012**: The first unit MUST remain short; subsequent same-paragraph sentences SHOULD share a bounded model context.
- **FR-013**: Context grouping MUST NOT cross paragraph/section boundaries or exceed 300 UTF-8 bytes.
- **FR-014**: Boundary class MUST reach native PCM normalization and cache identity; initial total targets are clause 200ms, sentence 350ms, paragraph 650ms, section 800ms.

## Success criteria

- **SC-001**: The retained `serving Since` fixture speaks two units while both words map to their exact original UTF-16 ranges.
- **SC-002**: The sentence boundary fixture measures 350 ms ±50 ms with no clipped activity in its deterministic onset/tail controls.
- **SC-003**: Existing stop/switch/cache/highlight tests remain green.
- **SC-004**: `src/lib/prosody-plan.test.ts`, the current-Eleven model test, and `scripts/e2e-prosody.sh` pass from a clean checkout.
- **SC-005**: The packaged agent-operated journey reaches Play through public controls and observes the exact source highlight.
- **SC-006**: The real heading fixture dispatches `What This Book Is About.` separately, then dispatches a multi-sentence body context no larger than 300 UTF-8 bytes.

## Out of scope

- Cloud-LLM rewriting of book text.
- Automatic expression or breath tags.
- Claiming 8 diffusion steps, 350 ms, or larger model context as human-preferred before blind listening.
- Apple notarization or release-channel work.
