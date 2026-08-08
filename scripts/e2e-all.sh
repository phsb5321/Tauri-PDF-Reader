#!/usr/bin/env bash
#
# Runs BOTH local tauri-driver E2E lanes in sequence, each with its own build.
# This is the "full E2E acceptance" convenience target (`pnpm test:e2e:all`).
#
# The two specs require MUTUALLY-EXCLUSIVE build flags, so they cannot share one
# binary or one wdio invocation — which is why there is no single default
# `test:e2e` suite that covers both:
#   - e2e/critical-loop.e2e.mjs : VITE_E2E=true (the window.__E2E__ bridge),
#                                 default cargo features.
#   - e2e/native-play.e2e.mjs   : VITE_E2E_NATIVE=true AND
#                                 cargo --features e2e-tts-fixture.
#
# Neither lane runs in CI: both need WebKitGTK + a display (the vimeflow#65
# software-render trap). See scripts/e2e-native.sh and wdio.conf.mjs.
#
# Requires on PATH: pnpm, node, tauri-driver (~/.cargo/bin). `nix` provides the
# WebKitGTK/GTK toolchain + Xvfb.
set -euo pipefail
cd "$(dirname "$0")/.."

# Hermetic profile — the ONE shared entry point for every e2e lane. Points
# XDG_CONFIG_HOME (sqlite library DB) + XDG_DATA_HOME (fs scope, flags) at a
# fresh temp dir; the e2e-tts-fixture build refuses to boot without it.
source ./scripts/e2e-profile.sh

NIX_PKGS="pkg-config openssl alsa-lib gnumake perl clang llvmPackages.libclang.lib gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd xvfb"
# Keep the standalone runner aligned with flake.nix. Merely putting libclang in
# the Nix closure does not make its dlopen path discoverable to bindgen.
export LIBCLANG_PATH="${LIBCLANG_PATH:-$(nix eval --raw nixpkgs#llvmPackages.libclang.lib)/lib}"

echo "==================================================================="
echo "Lane 1/2: critical-loop  (VITE_E2E bridge build, default features)"
echo "==================================================================="
VITE_E2E=true pnpm build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs
nix-shell -p $NIX_PKGS --run '
  set -euo pipefail
  ( cd src-tauri && cargo build )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  # Pin the X11 backend (see e2e-home.sh): prevents the host Wayland
  # session leak that makes WebKit report a negative devicePixelRatio and an
  # inverted viewport (the 02/08/2026 wrapped-negative-viewport class).
  export GDK_BACKEND=x11
  # Free-display auto-pick + readiness via -displayfd (see scripts/e2e-native.sh).
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-all-xvfb1.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY"
  E2E_SPEC=./e2e/critical-loop.e2e.mjs pnpm test:e2e
'

echo "==================================================================="
echo "Lane 2/2: native-play  (VITE_E2E_NATIVE + e2e-tts-fixture build)"
echo "==================================================================="
exec bash scripts/e2e-native.sh
