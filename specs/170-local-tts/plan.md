# Implementation Plan: Account-Free Local Narration

**Branch**: `170-local-tts` | **Spec**: [spec.md](./spec.md)

## Technical Context

Lectrice's `AiTtsEngine` currently owns an `ElevenLabsClient`, assumes MP3 cache files, and the frontend equates "initialized" with an in-memory API key. Proso already proves a loopback bridge with `GET /health`, `GET /v1/capabilities`, and idempotent `POST /v1/tts` returning WAV. Mac.Pro can reach the desktop loopback service through a user SSH local-forward; Lectrice continues to address only `127.0.0.1`.

## Constitution Check

- **Hexagonal architecture**: introduce a Rust `SynthesizerPort`; provider HTTP clients are adapters. UI never imports networking.
- **Typed IPC ratchet**: new init/status commands carry `#[specta::specta]`, enter both command macros, regenerate bindings, and do not raise the untyped pin.
- **Test first**: adapter and UI contract tests go red before implementation; no coverage floor changes.
- **Design system**: reuse the existing settings surface and tokens; no new raw colors/spacing.
- **State machine**: provider/mark capability becomes explicit store state; transitions retain debug logging.
- **Verification discipline**: Linux packaged public-control Play proves composition; a Mac-origin native contract probe proves transport/WAV; macOS UI remains BLOCKED unless a safe actor becomes available.

## Architecture

1. **Port and common result**
   - Move provider-neutral voice, word-timing, media-type, and synthesis-result shapes out of the ElevenLabs adapter.
   - Port operations: readiness/voice catalog and synthesis. A result carries audio bytes, media type, duration, optional marks, provider/model revision.
2. **Adapters**
   - Wrap existing ElevenLabs behavior without changing its wire path.
   - Add `LocalTtsClient` using the Proso contract. Validate a literal loopback URL, bounded response, published voice, and `audio/wav` whose RIFF chunk bounds, PCM format, channels, sample rate, bit depth, data length, duration, and rodio decode all agree.
   - Idempotency key is `sha256("lectrice-local-v1\\0" + service_revision + "\\0" + voice + "\\0" + normalized_speed + "\\0" + text)`. One ambiguous transport-timeout retry reuses it; 409 is terminal. Replay is tested through the app adapter; same-key/changed-body 409 is a direct Proso-contract fixture because a correct app key necessarily changes with the body.
   - Reqwest connect/total deadlines are explicit. A per-request cancellation generation is selected against the request future; Stop, close, or page change drops the future and never retries.
3. **Application service**
   - `AiTtsEngine` selects one configured adapter and never falls through to another after dispatch.
   - Local over-bound text returns `TEXT_TOO_LONG`; first slice does not truncate or chunk.
   - New local cache identity includes provider, service revision, voice, normalized speed, and media type and writes `.wav`; existing ElevenLabs key/`.mp3` lookup stays byte-compatible. Extension-aware get/set/timestamp paths plus clear/info accounting cover WAV retention. Collision and clear/accounting tests use identical text/voice across both media.
   - No-mark synthesis returns an empty timing list and real WAV duration; player format detection handles MP3/WAV. The sink's existing finished signal increments a natural-completion token; plain local playback consumes it exactly once for idle/auto-page, while explicit Stop does not.
4. **Native configuration and typed IPC**
   - Extend `[ai_tts]` with provider and local URL while retaining ElevenLabs defaults. Both are read-only WebView status; there is no command that writes the URL.
   - Add typed local initialization and provider capability/status data; config round-trip proves restart durability and rejects non-loopback/credential/path/query/fragment inputs in Rust.
5. **Frontend composition**
   - Seed provider/destination before first render.
   - Local mode auto-initializes without a key, names its destination, lists published voices, and uses plain playback when marks are unsupported.
   - ElevenLabs form remains unchanged in cloud mode.
6. **Verification and deployment**
   - Contract fixture plus targeted Rust/TS tests.
   - Packaged local-provider journey through public controls and zero-cloud trap.
   - Mac launchd SSH local-forward binds `127.0.0.1:5301`, requires key-only auth, `ExitOnForwardFailure`, keepalives, restart-on-failure, and a health oracle; retain an unload/removal command.
   - Run a Mac-origin live contract probe through the tunnel and stage a candidate app without replacing either installed bundle.
   - Installation remains BLOCKED until a safe Mac app actor exists and proves the staged candidate. Preserve the restored bundle.

## Security Decisions

- First slice whitelists exactly `http://127.0.0.1:5301`; every other URL is rejected, including private/link-local/public IPv4, non-`::1` IPv6, alternate ports, DNS, credentials, path, query, fragment, and HTTPS. Broader destinations require a new security decision.
- URL remains in native config; no bearer or model payload is stored in WebView persistence.
- Text is bounded by capabilities and a hard local ceiling before dispatch; oversize is an explicit error.
- Response bytes and read time are bounded before strict WAV decode/cache.
- Cloud fallback is forbidden after local selection.
- Tunnel configuration contains no password, uses existing key authentication, and exposes the desktop service only on Mac loopback.

## Verification Order

1. Source/architecture tests and config round-trip.
2. Targeted local adapter Rust tests, one thread.
3. Targeted frontend store/hook/settings/playback tests.
4. Lint and typecheck.
5. Packaged local-provider journey, serialized under the heavy gate.
6. `pnpm verify` and alignment gate.
7. Different-family exact-head review.
8. Configure the hash-pinned tunnel and run the Mac-origin live probe.
9. Stage a candidate only; installation stays BLOCKED until a safe Mac app actor becomes available.

## Rollback

The code slice reverts with one squash commit. The Mac deployment retains the current known bundle and uses a hash-fenced rollback script; no app data directory is replaced.
