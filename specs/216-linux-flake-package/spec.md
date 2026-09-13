# Spec 216 — Linux flake package for Lectrice (x86_64-linux)

Extend the EXISTING flake machinery (Darwin `nix/lectrice-darwin.nix` scheme)
with a reproducible Linux desktop package. Base: PR #191 head `764f221`.
No Darwin/devShell/tauri-driver replacement; no updater/workflows/release
tooling (coordinator-owned); no product source edits; no model/service work.

## Outcome

- `packages.x86_64-linux.lectrice` (= `default`): actual runnable Lectrice —
  ELF binary at `$out/bin/tauri-pdf-reader` (actual Cargo/bundle binary name,
  mirroring the proven Darwin bundle binary) plus a `lectrice` convenience
  symlink, hicolor PNG icons, a `.desktop` entry with
  `MimeType=application/pdf`, wrapped with WebKitGTK/GTK/GStreamer runtime
  library paths.
- `apps.x86_64-linux.default`: launches the installed binary.
- `checks.x86_64-linux.package-contract`: ONE verifier script
  (`nix/package-contract.sh`) run twice — positive on the real output (all
  conditions hold), negative control on a deliberately malformed fixture
  (broken Exec + removed binary) which the SAME verifier must reject.
  The .app-absence and placeholder assertions are ordinary positive
  assertions, not the negative control (validator correction 13/09).
- Plain immutable version metadata: `$out/share/lectrice/version` contains
  the package manifest version (217 updater contract: validate without
  executing the UI; no pre-existing equivalent).
- Interface agreement with the R2 seat (217, updater): `#$out/bin/lectrice`,
  `$out/share/applications/lectrice.desktop`, hicolor icons, and
  `$out/share/lectrice/version`. 216 owns only the derivation/flake
  package/apps.default; scripts/manage*, HM timer and Linux `apps.manage`
  belong to 217.
- `docs/linux-nix.md` + one backlog entry + this spec trio.

## Constraints

- Minimum diff; reuse the Darwin derivation's pnpm/cargo lock/hash scheme
  (`cargoLock`, `pnpmDeps` hash, HUSKY=0, doCheck=false) where valid; no
  `flake.lock` drift or new inputs; no `scripts/manage*`; no checks disabled.
- Same pinned `cargo-tauri.hook` flow; Linux uses `tauriBundleType = "none"`
  (Nix owns packaging; no deb/rpm/appimage bundle machinery) and installs the
  raw binary itself.
- Runtime closure: WebKitGTK 4.1 stack (gtk3, webkitgtk_4_1,
  glib-networking), GStreamer (gstreamer, gst-plugins-base/good/bad) for
  WebKit media paths; wrap with `LD_LIBRARY_PATH` via makeWrapper.
- Build: `--dry-run` preflight reports closure; refuse > 15 GiB downloads.
  Real build under `lectrice-heavy.lock`, `--max-jobs 1 --cores 1`,
  `CARGO_BUILD_JOBS=1`, ≤ 25 min initial build, raw logs preserved with
  actual exits (pipefail). Max 45 min task, 2 repair rounds, original
  failures preserved. No push/merge/install/updater.

## Acceptance

1. `nix build .#lectrice --no-link --print-out-paths` succeeds within cap.
2. Contract check passes on the built output (binary ELF, desktop Exec
   resolves into the package, icons present, no Darwin layout).
3. Docs + backlog + committed; report with base/head, drv/out hashes,
   commands/exits, remaining native/review/install gates. A successful build
   is not review and not delivery.
