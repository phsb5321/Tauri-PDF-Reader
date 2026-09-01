# Implementation Plan: GPU Narration Performance

## Technical Context

- Frontend: React, TypeScript, Zustand, PDF.js, Vitest, fast-check.
- Native: Tauri 2, Rust, reqwest, rodio, tauri-specta.
- Local engine: loopback HTTP contract returning PCM16 WAV; Magpie Q6 uses Vulkan/RADV on the audited RX 5700 XT.
- Verification: deterministic bridge tests, targeted frontend/Rust tests, seeded fuzz, held-out real PDF, and packaged WebdriverIO public-control journey.

## Architecture

Keep three independent authorities:

1. **Document planner (WebView):** source-aligned semantic units, profile context ceiling, ordered look-ahead, and generation invalidation.
2. **Native TTS engine:** provider identity, cache coordinates, cancellation, measured uncached synthesis timing, and typed runtime-status IPC.
3. **Loopback bridge:** pinned Magpie artifact verification, hard request ceiling, defensive full-page splitting, valid WAV concatenation, and exact runtime metadata.

The Performance tab consumes typed native state. It never calls the bridge directly and never infers a backend from a revision string.

## Frontend

- Extend the existing source-aligned planner with an explicit context ceiling while retaining the provider's hard maximum and short first unit.
- Persist one `NarrationPerformanceProfile` preference in `ai-tts-store`; no runtime measurements are persisted.
- Replace the single prefetch slot with a generation-bound map and sequential look-ahead pump. Responsive/Balanced queue one unit; Continuous queues two. A stale pump may finish compute but cannot play or mutate the active queue.
- Add `PerformanceSettings` under the existing Settings dialog. Poll the typed native snapshot only while the section is visible.
- Show model/backend/device only when supplied by native runtime metadata. Show uncached RTF and request geometry separately from cache state.

## Native

- Add provider runtime metadata and optional latest uncached synthesis measurement to the synthesizer port/engine.
- Parse optional `runtime` and `queueCapacity` fields from local capabilities; older Supertonic remains compatible and reports unavailable metadata honestly.
- Time provider synthesis around the actual adapter call and store per-provider request bytes, wall time, audio duration, and standard RTF. Cache hits bypass provider synthesis and therefore do not overwrite the measurement.
- Expose `ai_tts_get_performance` through tauri-specta and regenerate checked-in bindings.
- Keep the local request deadline bounded per semantic unit. Do not inflate it to the full-page defensive bridge timeout.

## Magpie bridge

- Track the bridge in `tools/magpie/` with CLI/model paths supplied by environment and the audited Q6 digest pinned.
- Publish exact runtime metadata and a 300-byte preferred chunk ceiling while accepting at most one bounded full-page request for defensive compatibility.
- Split losslessly at sentence punctuation, then whitespace, then Unicode scalar boundaries. Every chunk must be non-empty and at most 300 UTF-8 bytes.
- Invoke the pinned CLI sequentially under one synthesis lock, validate homogeneous PCM16 geometry, concatenate frames in order, and apply playback speed once to the final WAV.
- Retain idempotency identity across the original full request; a replay returns the byte-identical response and a changed body under the same key returns 409.
- Unit tests use synthetic WAV fixtures and a fake CLI; the real-model oracle remains separate.

## User gate

A hermetic packaged journey must use only public controls:

1. launch with the deterministic local fixture publishing Magpie-like runtime metadata;
2. open Settings → Performance;
3. assert model/backend/device and Balanced profile;
4. select Continuous and observe its selected state and 300-byte/two-unit policy;
5. close/reopen Settings and assert persistence;
6. open the PDF, press public Play, observe bounded request trace and exact highlight;
7. press public Stop and assert idle/no stale continuation.

The real-model lane separately records Vulkan device handles/VRAM, bridge chunk trace, full-page WAV geometry, first-unit latency, RTF, and one natural page advance.

## Verification order

1. Pure bridge chunk/WAV/idempotency tests.
2. Planner/profile/store/Performance tab tests.
3. Native adapter/metrics/cancellation/cache contracts.
4. Typecheck, lint, rustfmt, clippy, targeted Rust tests, bindings contract, harness.
5. Seeded fuzz (`FC_SEED=20260828`, 2,000 runs).
6. Held-out 2,233-character real-page oracle at the pinned model digest.
7. Packaged public-control journey.
8. Exact-head different-family capable review; no merge without ALLOW.

## Reversal

Stop the Magpie service and start `supertonic3-tts-desktop.service` on the unchanged loopback destination. Revert the eventual squash commit to remove the Performance tab/pipeline changes. Revision-scoped cache entries remain isolated and can be reclaimed through the existing cache UI.
