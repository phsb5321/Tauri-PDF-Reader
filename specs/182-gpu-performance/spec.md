# Feature Specification: GPU Narration Performance

## Purpose

Lectrice must use a higher-capacity local narration engine without sending a whole PDF page to one fragile model invocation. Readers must be able to see which model and accelerator are actually active, choose a coherent playback-performance policy, and trust that Stop, page changes, and provider switches invalidate queued work.

## User Scenarios & Testing

### User Story 1 — Continuous GPU narration (P1)

As a reader, I can press Play on a normal book page and hear it narrated by the selected local GPU engine without a full-page crash or a long silent stall between units.

### Acceptance scenarios

1. Given a 2,233-character real PDF page, when narration starts, then the first request is one short semantic unit and every later request remains within the active engine's published safety ceiling.
2. Given a heading followed by prose, when the page is planned, then the heading remains a standalone unit and later same-paragraph sentences may share bounded context; document block boundaries are never crossed.
3. Given the full held-out page, when the local bridge receives it directly, then it defensively splits at sentence/word boundaries, synthesizes every source character in order, and returns one valid PCM16 WAV instead of crashing.
4. Given active narration, when Stop, a page change, or a provider switch occurs, then no queued or in-flight result from the old generation can play, highlight, or advance the page.
5. Given local narration has not been explicitly started, then no PDF-derived text is dispatched to the model process.
6. Given a local-engine failure, then Lectrice reports the failure and never silently routes the text to a cloud or alternate provider.

### User Story 2 — Honest Performance tab (P1)

As a reader, I can open Settings → Performance and verify the engine that is actually narrating, its execution backend/device, its input and queue limits, and measured generation speed.

### Acceptance scenarios

1. The tab names the active provider revision and, when published by the local service, exact model, quantization, accelerator backend, and device.
2. The tab does not infer GPU use from a model name. Missing runtime metadata is displayed as unavailable, never as GPU.
3. After an uncached synthesis, the tab displays request size, generation time, generated-audio duration, and standard real-time factor (`generation wall / audio duration`).
4. Cached playback is not misreported as model-generation performance.
5. A reader can select Responsive, Balanced, or Continuous playback. The tab explains the concrete context and look-ahead policy for each profile.
6. The selected profile survives relaunch without persisting PDF text, credentials, or runtime measurements.
7. All controls are keyboard reachable and expose names, selected state, and status through accessibility APIs.

### User Story 3 — Better local candidate without false claims (P2)

As a reader, I can use the audited Magpie Multilingual 357M Q6_K Vulkan candidate while retaining a reversible path to the known-good Supertonic service.

### Acceptance scenarios

1. The service verifies the pinned model digest before listening.
2. Runtime metadata identifies Magpie Q6_K, Vulkan/RADV, and the actual device.
3. A real synthesis opens the GPU device and produces a measured VRAM increase; a static label alone cannot satisfy this gate.
4. The held-out page succeeds, its generated audio exceeds 30 seconds, and the packaged app naturally advances exactly once.
5. Promotion does not claim subjective naturalness. The blind listening scorecard remains the preference authority.
6. Reverting the service selection restores Supertonic without changing reader data or cloud credentials.

## Performance profiles

| Profile    | Spoken-context ceiling |                      Look-ahead | Intended trade-off                            |
| ---------- | ---------------------: | ------------------------------: | --------------------------------------------- |
| Responsive |        180 UTF-8 bytes |                          1 unit | More model boundaries, least speculative work |
| Balanced   |        300 UTF-8 bytes |                          1 unit | Existing source-aligned policy                |
| Continuous |        300 UTF-8 bytes | 2 units, generated sequentially | More cache/compute for fewer boundary stalls  |

The provider's smaller published limit always wins. Look-ahead is sequential and must respect a single-slot local engine.

## Non-functional requirements

- First uncached bounded Magpie unit completes within 15 seconds on the audited RX 5700 XT.
- Aggregate sustained standard RTF remains below 0.80 across the held-out page's bounded units. A deliberately short first unit is gated by latency, not by its overhead-dominated individual RTF.
- The direct full-page defensive path has a 180-second outer oracle; Lectrice itself retains a bounded per-unit request deadline.
- No model binary is committed to Git. The bridge accepts explicit artifact paths, verifies the pinned digest, and fails closed when artifacts or Vulkan are unavailable.
- Durable evidence records build identity, model digest, backend/device, chunk trace, timing, VRAM delta, packaged public-control trace, and replay command.

## Out of scope

- Claiming that Magpie sounds better before the blind scorecard is completed.
- Live cross-process GPU-utilization percentages on every operating system.
- Automatic model downloads, cloud fallback, or selecting an arbitrary network endpoint from the WebView.
