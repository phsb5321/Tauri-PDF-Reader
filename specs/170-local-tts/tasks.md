# Tasks: Account-Free Local Narration

## Phase 1 — Fail-first contracts

- [ ] T001 Add config round-trip and invalid-destination tests for local provider selection.
- [ ] T002 Add Rust adapter contract tests covering readiness, voices, exact idempotency/body, connect/total timeout, cancellation, replay, strict PCM-WAV validation, media/size bounds, over-bound text, and no-cloud fallback; prove same-key/changed-body 409 separately at the direct service-contract fixture level.
- [ ] T003 Add frontend tests proving local mode needs no API key, names the destination, disables word-progress claims when marks are unavailable, and distinguishes natural finish/auto-page from explicit Stop.
- [ ] T004 Add packaged fixture/zero-cloud trap contract and make the local Play journey fail before implementation.

## Phase 2 — Provider seam

- [ ] T005 Introduce provider-neutral synthesis types and `SynthesizerPort`; adapt ElevenLabs without behavior change.
- [ ] T006 Implement the loopback-only Proso-contract adapter with deterministic idempotency and bounded WAV responses.
- [ ] T007 Make playback/cache media-aware while preserving byte-compatible legacy MP3 lookup, strict `.wav` isolation, WAV-inclusive size/count/clear retention, and natural-finish completion semantics.

## Phase 3 — Configuration and UI

- [ ] T008 Extend native config and generated bindings for provider, destination, and local initialization/capability state.
- [ ] T009 Seed and auto-initialize local mode without an API key; preserve the existing ElevenLabs initialization path.
- [ ] T010 Update settings/playback surfaces with destination disclosure, published voices, and honest no-mark playback.

## Phase 4 — Verification and delivery

- [ ] T011 Run targeted Rust and frontend gates, lint, typecheck, bindings ratchet, and config tests.
- [ ] T012 Run packaged public-control local Play with one WAV request and zero cloud requests.
- [ ] T013 Run full verification and alignment, then obtain a different-family exact-head review and resolve every finding.
- [ ] T014 Configure a key-only, health-checked launchd Mac SSH loopback forward with retained unload command; prove one Mac-origin PT-BR WAV request without credentials.
- [ ] T015 Stage a Mac candidate only if T001–T014 are green. Keep installation BLOCKED and retain the restored bundle until a safe Mac app actor can prove the staged candidate.
