# Known limitations

Truthful inventory of what the current tree does **not** do, and what is not
yet proven. Every item names its evidence. If a release note claims a
platform or a feature, it must not contradict this page.

Last reviewed: 15/08/2026, after the release-preparation train, against `main`
at commit `8c31cfc`.

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
- **macOS and Windows have no packaged build and no packaged E2E in this
  repository.** The app is Tauri 2.x and the upstream prerequisites are
  documented in the README, but "works on macOS/Windows" is **not a claim this
  repo can back** today. Cutting a tag produces Linux artifacts only.

The published Linux artifacts are verified on the platform they target rather
than on the NixOS build host: for `v0.2.0-rc.0`, the `.deb` installed into a
clean Ubuntu 24.04 container (`Version: 0.2.0`), and both the `.deb` binary and
the AppImage launched there and mapped a window owned by the app process
(`WM_CLASS "tauri-pdf-reader"`, 1200x800). On a NixOS host under Xvfb the
AppImage instead aborts with `EGL_BAD_PARAMETER`, because the app enables GPU
compositing on Linux and Xvfb offers no EGL display — an environment mismatch,
not an artifact defect.

## macOS is buildable but not drivable

macOS is **not a shipped artifact** and no release note claims it. What has
been measured, on macOS 26.6.1 / arm64 at commit `3d68d0e`:

- The app **builds** (`pnpm tauri build --bundles app`) once `SDKROOT` and
  `LIBRARY_PATH` point at the Command Line Tools SDK; without them the link
  fails on `-liconv`.
- The bundle **launches**: `Lectrice.app` version `0.2.0`, bundle id
  `com.lectrice.reader`, exactly one process, and a real 1176x784 window in
  the Quartz window list.

What is **not** proven on macOS, and why it is not merely "pending":

- The wry/WKWebView window exposes **no AX windows** (`count of windows` is 0;
  only the menu bar is exposed), so an accessibility actor cannot reach the
  reader's controls.
- The app registers **no file association and no CLI open path**, so there is
  no non-GUI way to hand it a document.
- `tauri-driver` has **no macOS support**, so the packaged lanes cannot run
  there at all.

That leaves only synthetic keystrokes aimed at whatever is frontmost on a live
desktop, which is neither a controlled oracle nor a safe action. So the macOS
open/render/restart journey is **BLOCKED**, not skipped-green, and the three
reasons above are what would have to change to unblock it.

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
