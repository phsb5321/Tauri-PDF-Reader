# Tasks: Account-Free Local Narration

## Phase 1 — Fail-first contracts

- [x] T001 Add config round-trip and invalid-destination tests for local provider selection.
- [x] T002 Add Rust adapter contract tests covering readiness, voices, exact idempotency/body, connect/total timeout, cancellation, replay, strict PCM-WAV validation, media/size bounds, over-bound text, and no-cloud fallback; prove same-key/changed-body 409 separately at the direct service-contract fixture level.
- [x] T003 Add frontend tests proving local mode needs no API key, names the destination, disables word-progress claims when marks are unavailable, and distinguishes natural finish/auto-page from explicit Stop.
- [x] T004 Add packaged fixture/zero-cloud trap contract and prove the local Play journey RED with a planted key requirement before its exact-head GREEN run.

## Phase 2 — Provider seam

- [x] T005 Introduce provider-neutral synthesis types and `SynthesizerPort`; adapt ElevenLabs without behavior change.
- [x] T006 Implement the loopback-only Proso-contract adapter with deterministic idempotency and bounded WAV responses.
- [x] T007 Make playback/cache media-aware while preserving byte-compatible legacy MP3 lookup, strict `.wav` isolation, WAV-inclusive size/count/clear retention, and natural-finish completion semantics.

## Phase 3 — Configuration and UI

- [x] T008 Extend native config and generated bindings for provider, destination, and local initialization/capability state.
- [x] T009 Seed and auto-initialize local mode without an API key; preserve the existing ElevenLabs initialization path.
- [x] T010 Update settings/playback surfaces with destination disclosure, published voices, and honest no-mark playback.

## Phase 4 — Verification and delivery

- [x] T011 Run targeted Rust and frontend gates, lint, typecheck, bindings ratchet, and config tests — `CI=true nix develop -c pnpm verify` PASS (1,139 frontend tests plus Rust/contracts), alignment and harness PASS.
- [x] T012 Run packaged public-control local Play with one WAV request and zero cloud requests — vm103 exact head `60a9c82`, receipt SHA-256 `f5416432f27f97c098a8969b383972ad9ee8194ada55dbac599f0ad227c7ba10`.
- [x] T013 Run full verification and alignment, then obtain a different-family exact-head review and resolve every finding — full verify/alignment PASS, DeepSeek Pro ALLOW with no BLOCKER/MAJOR, and PR #170 required CI green after the fail-closed tauri-driver prerequisite rerun.
- [x] T014 Configure a key-only, health-checked launchd Mac SSH loopback forward with retained unload command; prove one Mac-origin PT-BR WAV request without credentials — bridge `.3`, 5.782 s WAV SHA-256 `00c37c3305c12f3c2ad6d44731d5fcc369175ac8f293260b1a4091c926252463`.
- [ ] T015 Stage a Mac candidate only if T001–T014 are green. Keep installation BLOCKED and retain the restored bundle until a safe Mac app actor can prove the staged candidate.
