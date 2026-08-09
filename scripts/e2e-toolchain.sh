#!/usr/bin/env bash
#
# e2e-toolchain.sh — the ONE toolchain entry point for every e2e lane. Runs a
# command inside the flake devShell (flake.nix), which is the single pinned
# place the toolchain dependency list lives. A lane must NEVER re-list
# packages: the flake is the real source, and deleting a package there makes
# every lane fail — there is no hand-maintained list to fall back to.
#
# The devShell provides the WebKitGTK/GTK toolchain, Xvfb, speechd, perl and
# LIBCLANG_PATH (bindgen); the shellHook keeps the host pnpm 10 on PATH.
#
# Usage (after `cd` to the repo root; source AFTER ./scripts/e2e-profile.sh):
#   source ./scripts/e2e-toolchain.sh
#   toolchain_run '…'    # run inside the devShell, continue afterwards
#   toolchain_exec '…'   # run inside the devShell, replace this process
set -euo pipefail

toolchain_run() {
  nix develop -c bash -c "$1"
}

toolchain_exec() {
  exec nix develop -c bash -c "$1"
}
