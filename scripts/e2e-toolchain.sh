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

# CI (vm103): the runner exports a SHARED CARGO_HOME=/var/cache/ci/cargo whose
# config.toml applies to every Rust build on the box — and it pins the HOST
# toolchain: linker = /usr/bin/cc, -fuse-ld=mold, -C target-cpu=x86-64-v3.
# The lanes compile inside the pinned flake devShell (nix rust, nix clang, nix
# glibc), so that config links nix-rustc objects with the host gcc/glibc. The
# resulting host-glibc binaries then die two ways, both observed on this lane:
# build scripts SIGSEGV (signal 11: serde, proc-macro2, quote, libc), and
# bindgen cannot dlopen the nix libclang ("GLIBC_ABI_GNU2_TLS not found").
# Reproduced on the runner 17/08/2026: identical checkout + devShell, only
# CARGO_HOME differing — default HOME cargo builds clean, /var/cache/ci/cargo
# fails at signalsmith-stretch/bindgen; adding the two overrides below makes
# it build again. The shared registry (CARGO_HOME) is deliberately kept — only
# the host-toolchain linker/rustflags are neutralised inside the devShell, and
# the artifacts get their own target dir so host-linked and nix-linked objects
# never mix. Local (non-CI) runs are untouched.
if [ "${CI:-}" = "true" ]; then
  export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/ci-cargo/lectrice/packaged-nix-target}"
  export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=cc
  export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS=""
fi

# One executable identity for WebdriverIO and every process observer. CI puts
# Cargo output outside the checkout; hardcoding src-tauri/target makes a lane
# either fail or observe a sibling/stale process instead of the app it built.
if [ -n "${CARGO_TARGET_DIR:-}" ]; then
  case "$CARGO_TARGET_DIR" in
    /*) E2E_TARGET_DIR="$CARGO_TARGET_DIR" ;;
    *) E2E_TARGET_DIR="$PWD/$CARGO_TARGET_DIR" ;;
  esac
else
  E2E_TARGET_DIR="$PWD/src-tauri/target"
fi
export E2E_APP_PATH="$E2E_TARGET_DIR/debug/tauri-pdf-reader"

toolchain_run() {
  nix develop -c bash -c "$1"
}

toolchain_exec() {
  exec nix develop -c bash -c "$1"
}
