# Feature Specification: Account-Free Local Narration

**Feature Branch**: `170-local-tts`  
**Created**: 2026-08-23  
**Status**: Draft

## Outcome

A reader can choose a synthesis service they operate on their own machine, hear a PDF page without an account or cloud API key, and see exactly where the page text is sent. The existing ElevenLabs route remains available and unchanged.

## User Scenarios & Testing

### User Story 1 — Read with a local voice (P1)

As a reader with a configured local synthesis service, I can launch Lectrice, open a document, and press Play without entering an ElevenLabs key.

**Independent test**: start a contract fixture on loopback, launch the packaged app with a local-provider config, open the public PDF fixture, press Play, and prove the fixture returned WAV while the managed ElevenLabs route received zero requests.

**Acceptance scenarios**:

1. Given a valid local destination and published voice catalog, startup connects, exposes those voices, and enables Play without an API key.
2. Given Play on extracted PDF text, exactly that text is sent to the configured destination, WAV audio is decoded, and playback starts.
3. Given a selected Brazilian Portuguese voice, the request carries that exact voice and current speed.
4. Given one ambiguous timeout after dispatch, exactly one bounded retry uses the same deterministic idempotency identity; user Stop or window close cancels without retry.
5. Given audio ends naturally, playback returns to idle and auto-page advances exactly once; explicit Stop never advances.

### User Story 2 — Fail honestly (P1)

As a reader, I am never told local narration works when the service is missing, incompatible, or silent.

**Independent test**: exercise unavailable host, empty voice catalog, malformed WAV, oversized response, and wrong media type; each must leave Play unavailable or enter a named error state without contacting ElevenLabs.

**Acceptance scenarios**:

1. An unavailable destination shows a local-service connection error and does not fall back to cloud synthesis.
2. An empty catalog blocks initialization.
3. A non-WAV or structurally invalid response is rejected before playback or cache write.
4. A local provider that publishes no marks does not display word-level progress or move the karaoke highlight.

### User Story 3 — Understand the privacy boundary (P2)

As a reader, I can see that PDF-derived text goes to the local destination I configured and nowhere else.

**Independent test**: the setup/status surface names the effective destination and local provider; the ElevenLabs key field and egress disclosure are not shown while local mode is active.

## Requirements

- **FR-001** — Local narration MUST be opt-in; existing installs remain on ElevenLabs unless explicitly configured otherwise.
- **FR-002** — The destination MUST originate from native user configuration, never a shipped hostname or discovery probe.
- **FR-003** — Initial delivery MUST accept exactly `http://127.0.0.1:5301`; every other destination is rejected. Any broader network scope requires a new security decision.
- **FR-004** — PDF text networking MUST occur in Rust through typed Tauri IPC; the WebView MUST NOT fetch the service.
- **FR-005** — Initialization MUST require healthy readiness and at least one advertised voice.
- **FR-006** — Synthesis MUST use the existing reader-operated-host contract: health, capabilities, idempotent WAV synthesis, bounded input, and explicit voice/speed.
- **FR-007** — There MUST be no post-dispatch fallback to ElevenLabs.
- **FR-008** — Cache identity MUST include provider, service/model revision, voice, speed, and media type so WAV and MP3 entries cannot collide; cache size, count, clear, and retention behavior MUST include both formats.
- **FR-009** — A provider with no word marks MUST produce no `WordTiming` rows; UI MUST fall back to ordinary playback state rather than fabricate karaoke precision.
- **FR-010** — The local setup/status surface MUST name the destination and state that PDF-derived text is sent there.
- **FR-011** — Existing ElevenLabs initialization, timestamps, caching, and playback behavior MUST remain unchanged.
- **FR-012** — A live verifier MUST synthesize one sentence from Mac.Pro through the configured loopback tunnel, validate WAV structure, and prove zero cloud credential is required.
- **FR-013** — Mac installation MUST NOT occur until backend contract tests, targeted frontend tests, packaged public-control Play, live Mac-origin synthesis, independent review, AND a safe Mac app actor prove the staged candidate. Because no safe Mac app actor exists today, installation remains BLOCKED and the restored bundle stays installed.
- **FR-014** — Local requests MUST have explicit connect and total deadlines, be cancelled by Stop/close/page change, and retry at most once with the identical idempotency key only after an ambiguous transport timeout.
- **FR-015** — The first slice MUST reject text above the service's published or hard UTF-8 bound with `TEXT_TOO_LONG`; it MUST NOT truncate or silently split. Sentence chunking is a separately specified follow-up.
- **FR-016** — Provider and destination MUST be read-only WebView status derived from native config. No typed IPC command may mutate the destination.
- **FR-017** — The Mac tunnel MUST use key-only SSH, `ExitOnForwardFailure`, keepalives, launchd restart, loopback bind, and a health oracle. Its unload/removal command MUST be retained.

## Edge Cases

- Destination includes a path, credentials, non-loopback host, query, fragment, or unsupported scheme.
- Health is ready but capabilities contains zero voices.
- Voice disappears between capability read and synthesis.
- Response has WAV media type but truncated RIFF data.
- Text exceeds the service's published UTF-8 bound.
- Request is repeated with the same idempotency key and changed body; the fixture returns 409 rather than replaying the original bytes.
- Local service dies before or during synthesis; request cancellation/deadline returns a local error and never dispatches to cloud.
- Natural sink completion and explicit Stop race; at most one terminal transition occurs and only natural completion may auto-page.

## Success Criteria

- **SC-001** — Local adapter contract tests cover readiness, voices, request body, idempotency, media type, WAV validation, response bound, and all named failures.
- **SC-002** — Packaged user gate reaches public Play with local mode and records one local WAV request plus zero ElevenLabs requests.
- **SC-003** — Local mode renders no API-key requirement and names its exact destination.
- **SC-004** — No-mark mode renders no word-progress claim while audio playback state remains correct through play, pause/resume, finish, and stop.
- **SC-005** — A Mac-origin live probe against the desktop service returns a valid WAV for a PT-BR sentence and exact configured voice through a healthy key-only tunnel.
- **SC-006** — Existing targeted ElevenLabs suites and the full repository verification gate remain green.
- **SC-007** — The restored Mac bundle remains installed while the Mac app actor is unavailable; a staged candidate is not an installation.
- **SC-008** — Timeout, cancellation, retry, natural finish, explicit stop, and auto-page tests are deterministic and contain no wall-clock sleeps.
