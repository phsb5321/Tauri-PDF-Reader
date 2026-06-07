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

NIX_PKGS="pkg-config openssl alsa-lib gnumake perl gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd xvfb"

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
  Xvfb :97 -screen 0 1280x1024x24 >/tmp/lectrice-e2e-all-xvfb1.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  sleep 2
  export DISPLAY=:97
  E2E_SPEC=./e2e/critical-loop.e2e.mjs pnpm test:e2e
'

echo "==================================================================="
echo "Lane 2/2: native-play  (VITE_E2E_NATIVE + e2e-tts-fixture build)"
echo "==================================================================="
exec bash scripts/e2e-native.sh
