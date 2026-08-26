# Known limitations

Truthful inventory of what the current tree does **not** do, and what is not
yet proven. Every item names its evidence. If a release note claims a
platform or a feature, it must not contradict this page.

Last reviewed: 26/08/2026 for the Apple-silicon Nix package. The Linux
release claims remain scoped to `v0.2.0`.

## Fast-close verification position

The close-flush protocol and deterministic packaged close lane are **shipped**
([#113], [#125]). The backend prevents close, requests both debounced writers
(highlights + reading position), waits for acknowledgement, and then closes.

Exact packaged evidence from #125 proves both data-loss paths together:

- **DL-1 (highlights):** close marker 49 ms, deliberately delayed IPC 250 ms,
  actual window disappearance 387 ms, highlight present after restart.
- **DL-2 (reading position):** actual window disappearance 401 ms (<500 ms),
  persisted row and restarted reader both at page 3.

This closes the stale #115 defect. The evidence is Linux/X11/WebKitGTK scoped —
see "macOS is buildable but not drivable" below for why the same journey has no
macOS receipt.

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
- Windows has no packaged build or packaged E2E in this repository.
- macOS has a personal Apple-silicon Nix package and a deterministic
  bundle/process/Quartz-window launch gate. It still has no public signed DMG
  or full reader E2E. Cutting a tag continues to produce Linux artifacts only.

The published Linux artifacts are verified on the platform they target rather
than on the NixOS build host: for `v0.2.0-rc.0`, the `.deb` installed into a
clean Ubuntu 24.04 container (`Version: 0.2.0`), and both the `.deb` binary and
the AppImage launched there and mapped a window owned by the app process
(`WM_CLASS "tauri-pdf-reader"`, 1200x800). On a NixOS host under Xvfb the
AppImage instead aborts with `EGL_BAD_PARAMETER`, because the app enables GPU
compositing on Linux and Xvfb offers no EGL display — an environment mismatch,
not an artifact defect.

## macOS personal Nix channel is launch-verified, not publicly distributed

On macOS 26.6.1 / arm64, the flake's locked package produces
`Applications/Lectrice.app`, version `0.2.0`, bundle id
`com.lectrice.reader`, and a thin arm64 Mach-O. The derivation seals the bundle
with an ad-hoc signature after Nix fixups. `scripts/verify-macos-flake.sh`
checks the immutable identity/signature, launches that exact bundle through
`open -n`, requires exactly one new process, and observes one 1200×800 Quartz
window before terminating only that process.

That supports Pedro's managed-Mac Nix channel. It does **not** support a public
macOS download claim:

- the bundle is ad-hoc signed, not Developer ID signed or Apple notarized;
- no DMG is published by the tag release workflow;
- the wry/WKWebView controls still expose no usable accessibility window tree;
- `tauri-driver` still has no macOS native WebDriver host, so the Linux reader
  journeys cannot be replayed there; and
- there remains no file-association/open-event actor for a deterministic PDF
  open journey.

The Nix package therefore proves reproducible install identity and native
launch/window health, not full feature parity. Public distribution requires
Apple credentials and notarization; deeper packaged behavior requires a safe
macOS actor rather than frontmost-window synthetic keystrokes.

## Egress

The **only** outbound network call in the app is to ElevenLabs when a speak
action runs ([#97] removed the jsDelivr CDN egress; there is no in-app
update-check egress). The external Nix profile manager fetches the public Git
flake only when install/update is invoked. Contract and file:line receipts:
`SECURITY.md`.

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
