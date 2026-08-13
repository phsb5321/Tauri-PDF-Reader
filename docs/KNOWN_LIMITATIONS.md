# Known limitations

Truthful inventory of what the current tree does **not** do, and what is not
yet proven. Every item names its evidence. If a release note claims a
platform or a feature, it must not contradict this page.

Last reviewed: 13/08/2026, during the `120-release-docs` slice (PR #117),
against `main` at commit `260e0b4`.

## Fast-close verification position (track A)

The close-flush protocol is **shipped** ([#113]): the backend's
`CloseRequested` handler prevents the close, asks the renderer to flush both
debounced writers (highlights + reading position) and ack with a 3s timeout.

What is proven, separately (they are different facts):

- The **protocol itself** has direct jsdom test coverage (the ack is emitted).
- **DL-1 (highlights)** survives a genuine, driver-mediated window close
  inside the save debounce — `dl1-verify` PASS ([#115]).
- **DL-2 (reading position) is an open defect on that path**: `dl2-verify`
  FAIL — after a genuine close inside the autosave debounce, relaunch lands
  on page 2 instead of the page the user was on ([#115]'s lane summary:
  `dl2-create PASS · dl2-verify FAIL, rowPage=2, landedPage=2`).

On top of that, the E2E **harness** has its own nondeterminism: it cannot
reliably deliver `CloseRequested` to the app in every environment (tao's
delete-event fires but the runtime does not deliver it to
`on_window_event`; documented in `docs/agent-backlog-state.md`, iteration
#61/#62).

What that means in practice: a release note must claim **DL-1 fixed** and
**DL-2 still failing**, not "close loses no work". A track-A fix is expected
to close DL-2 and make the lane deterministic.

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
