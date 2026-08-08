#!/usr/bin/env bash
#
# Reproducible runner for the native play-button E2E (e2e/native-play.e2e.mjs).
#
# Builds the frontend with VITE_E2E_NATIVE=true and the Tauri debug binary with
# --features e2e-tts-fixture, then drives the REAL play button through
# tauri-driver + WebKitWebDriver under Xvfb, asserting the karaoke index advances
# off real backend marks.
#
# This rung is intentionally NOT wired into CI: it needs WebKitGTK + a display
# (the documented vimeflow#65 software-rendering trap), the same reason the
# tauri-driver critical-loop E2E is local-only. This script is the canonical way
# to reproduce the GREEN result.
#
# Requires on PATH: pnpm, node, and tauri-driver (~/.cargo/bin). `nix` provides
# the WebKitGTK/GTK toolchain + Xvfb. Run from anywhere:
#     bash scripts/e2e-native.sh   (or: pnpm test:e2e:native)
set -euo pipefail
cd "$(dirname "$0")/.."

NIX_PKGS="pkg-config openssl alsa-lib gnumake perl clang llvmPackages.libclang.lib gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd xvfb"
# Keep the standalone runner aligned with flake.nix. Merely putting libclang in
# the Nix closure does not make its dlopen path discoverable to bindgen.
export LIBCLANG_PATH="${LIBCLANG_PATH:-$(nix eval --raw nixpkgs#llvmPackages.libclang.lib)/lib}"

echo "==> Building frontend (VITE_E2E_NATIVE=true)"
VITE_E2E_NATIVE=true pnpm build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + running E2E under Xvfb"
exec nix-shell -p $NIX_PKGS --run '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  # Force software rendering so WebKit can create a session headless (vimeflow#65).
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  # Pin the X11 backend (see e2e-home.sh): without it GTK inherits the host
  # session WAYLAND_DISPLAY, the app window lands on the real compositor
  # with a garbage scale, and WebKit reports a NEGATIVE devicePixelRatio /
  # inverted viewport — every element hit-test then fails. This is the
  # 02/08/2026 "wrapped negative viewport" class; deterministic with x11.
  export GDK_BACKEND=x11
  # Let Xvfb pick a FREE display and report it via -displayfd (avoids collisions
  # with stale/sibling Xvfb on a fixed :NN, and is a real readiness signal rather
  # than a blind sleep — the number is written only once the display is up).
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-native-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY"
  E2E_SPEC=./e2e/native-play.e2e.mjs pnpm test:e2e
'
