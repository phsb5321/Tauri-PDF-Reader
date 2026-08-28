# Tasks: Source-aligned narration prosody

## Phase 1 — Correct provider model

- [x] T001 Replace every runtime ElevenLabs v1 default with one current model constant in `src-tauri/src/ai_tts/{elevenlabs.rs,mod.rs}`.
- [x] T002 Add exact outbound/default/cache-revision tests in `src-tauri/tests/eleven_current_model.rs` and backend unit tests.

## Phase 2 — Source/spoken planning

- [x] T003 Extend `src/lib/pdf-text.ts` to retain optional structure evidence without changing normalized text or span offsets.
- [x] T004 Implement sparse UTF-16 source/spoken alignment, conservative insertion policy, bounded runs, and range projection in `src/lib/prosody-plan.ts`.
- [x] T005 Add EN/PT-BR, surrogate-pair, false-positive, and exact `serving Since` tests in `src/lib/prosody-plan.test.ts`.

## Phase 3 — Playback integration

- [x] T006 Let `ReaderView` and `AiPlaybackBar` carry structured narration source while preserving plain-string selection narration.
- [x] T007 Synthesize planned spoken runs and project fallback/native timing ranges back to unchanged PDF coordinates in `useTtsWordHighlight`.
- [x] T008 Extend sentence queue tests for insertion mapping, exact order, prefetch, stop, and provider switch invalidation.

## Phase 4 — Boundary equalizer

- [x] T009 Implement strict mono/stereo PCM16 activity detection and edge normalization in `src-tauri/src/adapters/wav.rs`.
- [x] T010 Apply normalization before Local/Groq cache/playback and version their cache identities in `src-tauri/src/ai_tts/mod.rs`.
- [x] T011 Add deterministic onset, tail, silence-only, malformed, stereo, and exact-boundary Rust tests.

## Phase 5 — Executable gates

- [x] T012 Add executable `scripts/e2e-prosody.sh` covering planner, current model, WAV equalizer, architecture, and secret canaries.
- [x] T013 Run targeted lint/typecheck/tests, seeded fuzz, and harness checks.
- [x] T014 Run the packaged agent-operated TTS journey through public controls and retain its exact-head receipt under `docs/evidence/`.
- [ ] T015 Obtain a different-family exact-diff adversarial ALLOW and resolve every BLOCKER/MAJOR.
- [ ] T016 Score the retained blind EN/PT-BR pack before claiming naturalness or promoting an unmeasured target/step/context change.

## Phase 6 — Reported heading and continuity defect

- [x] T017 Measure the reported PDF heading geometry and record primary-source continuity research in `research-heading-continuity.md`.
- [x] T018 Recognize strong heading typography without `hasEOL` and emit an unmapped spoken terminal mark.
- [x] T019 Keep the first unit short, then merge later same-paragraph sentences within the 300-byte Supertonic context ceiling.
- [x] T020 Extend the packaged public-control journey to prove the heading request is standalone and the following body request carries connected sentence context.
- [x] T021 Carry clause/sentence/paragraph/section metadata through typed IPC, cache identity, and deterministic native 200/350/650/800ms targets.
