# Known limitations

Truthful inventory of what the current tree does **not** do, and what is not
yet proven. Every item names its evidence. If a release note claims a
platform or a feature, it must not contradict this page.

Last reviewed: 15/08/2026, after the stabilization and corpus train,
against `main` at commit `4f74f4b`.

## Fast-close verification position

The close-flush protocol and deterministic packaged close lane are **shipped**
([#113], [#125]). The backend prevents close, requests both debounced writers
(highlights + reading position), waits for acknowledgement, and then closes.

Exact packaged evidence from #125 proves both data-loss paths together:

- **DL-1 (highlights):** close marker 49 ms, deliberately delayed IPC 250 ms,
  actual window disappearance 387 ms, highlight present after restart.
- **DL-2 (reading position):** actual window disappearance 401 ms (<500 ms),
  persisted row and restarted reader both at page 3.

This closes the stale #115 defect. The evidence is Linux/X11/WebKitGTK scoped;
final exact-SHA macOS install/open/render/restart proof is still pending.

## Fixture-vs-live TTS

- Packaged E2E drives a **deterministic fixture engine** (`e2e-tts-fixture`
  Cargo feature, opt-in; never in `default`) — no network, no audio output.
- The **live ElevenLabs path** (the `elevenlabs-tts` default feature) is not
  exercised in CI: it needs an API key and real network. Its egress contract
  is documented in `SECURITY.md` with file:line receipts.
- **Native TTS** (Speech Dispatcher) is a Cargo feature that is **not enabled
  by default** and not part of any shipped build. The README's feature list
  reflects AI TTS only.

## Linux artifact reality

- The release workflow builds and publishes **AppImage + deb only**
  (`.github/workflows/release.yml`), on a **self-hosted Linux runner**.
- **macOS and Windows have no packaged build and no packaged E2E in this
  repository.** The app is Tauri 2.x and the upstream prerequisites are
  documented in the README, but "works on macOS/Windows" is **not a claim this
  repo can back** today. Cutting a tag produces Linux artifacts only.

## Egress

The **only** outbound network call in the app is to ElevenLabs when a speak
action runs ([#97] removed the jsDelivr CDN egress; there is no update-check
egress). Contract and file:line receipts: `SECURITY.md`.

## Platform-scoped runtime

The packaged E2E lanes pin X11 + software rendering (the vimeflow#65
WebKitGTK software-render trap). A Wayland-only environment or a GPU-only
environment may not run the packaged lanes as-is. This is a test-environment
limitation, not a product one — but it means "packaged E2E green" is scoped
to that pinned environment.

## Not a roadmap

This page is not a promise list. A limitation listed here may be closed by a
later slice, or may remain — the changelog (not this page) records when
something changed.

[#97]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/97
[#113]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/113
[#115]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/115
[#125]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/125
