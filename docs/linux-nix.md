# Installing Lectrice on NixOS (Linux, x86_64) — flake package

Status: **derivation + package contract implemented; initial build blocked by
the coordinator's 25-minute serial build cap** (see specs/216 task list and
the run report). Nothing here claims an installed/runnable app yet.

## What the flake provides (once built)

- `packages.x86_64-linux.lectrice` (also `default`) — the Lectrice desktop
  app built by the upstream `cargo-tauri.hook` default deb-install recipe
  (the hook moves `bundle/deb/*/data/usr` into the output, giving
  `bin/tauri-pdf-reader` plus its own desktop/icon data), supplemented with
  the Lectrice contract extras: `bin/lectrice` symlink,
  `share/applications/lectrice.desktop` (with `MimeType=application/pdf`),
  hicolor PNG icons, and the immutable `share/lectrice/version` metadata
  file (package manifest version).
- `apps.x86_64-linux.default` — launches `bin/lectrice`.
- `checks.x86_64-linux.package-contract` — one verifier
  (`nix/package-contract.sh`) run twice: on the real output (must pass) and
  on a deliberately malformed fixture (must fail — the negative control).

## Intended use (after a successful build)

```bash
nix build .#lectrice            # or: nix build github:phsb5321/Tauri-PDF-Reader#lectrice
nix run .#lectrice              # launch the desktop reader
nix build .#checks.x86_64-linux.package-contract
cat "$(nix build .#lectrice --print-out-paths)/share/lectrice/version"
```

Darwin users keep the existing `packages.aarch64-darwin.lectrice` and the
`manage`/`verify` apps — untouched by this work.

## Design notes

- Reuses the locked scheme of `nix/lectrice-darwin.nix` (same pnpmDeps hash,
  cargoLock, HUSKY=0, cargo-tauri.hook); Linux-specific bits follow the
  upstream nixpkgs hook recipe measured from the pinned nixpkgs source
  (default deb bundle + wrapGAppsHook3, which consumes the hook's GST asset
  protocol/plugin arguments — a hand-rolled LD_LIBRARY_PATH wrapper does
  not).
- Runtime deps: WebKitGTK 4.1 stack, glib-networking (WebKit TLS), GStreamer
  base/good/bad, ALSA (rodio/cpal audio out), OpenSSL (native-tls in the
  crate tree). Extra wrapper args go through `gappsWrapperArgs+=`.
- The updater/release tooling (scripts, Linux manager, HM timer,
  `apps.manage` on Linux) belongs to the separate 217 work — this package
  only guarantees the agreed file contract (`bin/lectrice`,
  `share/applications/lectrice.desktop`, icons, `share/lectrice/version`).

## Not yet proven

A completed `nix build .#lectrice` under the serial build cap, the contract
check run, and any native launch — the launch gate stays with the
coordinator. Do not treat this file as proof of an installed app.
