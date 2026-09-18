# Plan 216

Slice 1 — `nix/lectrice-linux.nix`: buildRustPackage mirroring the Darwin
scheme (same src/pnpmDeps hash/cargoLock/HUSKY=0), Linux bundle type "none",
postInstall installs `target/release/tauri-pdf-reader` + `lectrice` symlink +
hicolor icons + .desktop + wrapProgram with WebKitGTK/GStreamer library path.

Slice 2 — flake.nix linuxOutputs additions: `packages.{lectrice,default}`,
`apps.default`, `checks.package-contract` (runCommand assertions incl.
negative controls). recursiveUpdate keeps darwinOutputs intact.

Slice 3 — preflight `nix build .#lectrice --dry-run` (closure cost gate),
then the real bounded build under lectrice-heavy.lock with raw logs to the
run evidence dir.

Slice 4 — run the contract check on the built output, docs/linux-nix.md,
backlog entry, commit (hooks), run-dir report with exact hashes/exits.
