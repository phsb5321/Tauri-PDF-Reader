#!/usr/bin/env bash
#
# Reproducible runner for the packaged critical-loop E2E
# (e2e/critical-loop.e2e.mjs) — the PR-fast tier of the user gate:
#   launch → toolbar Open leaves the library → fixture renders (REAL pdf.js
#   text) → the REAL rAF karaoke loop advances the highlight index over real
#   time → a native menu action dispatches.
#
# Build flags (VITE_E2E bridge, DEFAULT cargo features) — the cheaper of the
# two mutually-exclusive lanes (the other is native-play: VITE_E2E_NATIVE +
# cargo --features e2e-tts-fixture). This is the lane CI runs on every PR.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101)
#
# Run from anywhere:   bash e2e/run-critical-loop.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh

echo "==> Building frontend (VITE_E2E bridge, default cargo features)"
VITE_E2E=true pnpm build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs

echo "==> Building debug binary + running the lane under Xvfb"
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  # Software rendering so WebKit can create a session headless (vimeflow#65).
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  # X11 pin — without it GTK inherits the host WAYLAND_DISPLAY and WebKit
  # reports a NEGATIVE devicePixelRatio with an inverted viewport (the
  # 02/08/2026 "wrapped negative viewport" record). Do not modernise away.
  export GDK_BACKEND=x11
  # XDG_* were exported by scripts/e2e-profile.sh in the outer shell and pass
  # through nix develop unchanged — the app config dir (sqlite library) and
  # data dir (fs scope, flags) stay hermetic.
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-critical-loop-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/critical-loop.e2e.mjs pnpm test:e2e
'
