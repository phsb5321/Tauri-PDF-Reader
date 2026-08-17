#!/usr/bin/env bash
#
# Packaged measurement of the highlights-panel DOCK (e2e/highlights-dock.e2e.mjs).
#
# Asserts by GEOMETRY, not by eye, that the panel docks beside the page instead
# of stacking below it and being clipped — the item-5 defect.
#
# Hermetic profile pinned under /tmp (assert_hermetic_profile refuses to boot
# outside /tmp; this host's default TMPDIR is /var/tmp).
#
# The frontend is built with BOTH bootstraps: VITE_E2E_NATIVE (hermetic seeded
# profile) and VITE_E2E (the `emitMenu` seam). `toggle-highlights` exists ONLY
# as a native GtkMenuBar item, which WebDriver cannot click — see the spec
# header for why that seam is used and what it does and does not certify. The
# two flags are independent branches in src/main.tsx and compose.
#
# Honors the shared flock — REQUIRED, and this script does NOT take it for you
# (same contract as e2e/run-corpus-journey.sh and scripts/home-audit-capture.sh;
# no script in this repo self-locks, because the documented callers already wrap
# it and an inner flock on the same file would deadlock against its own wrapper):
#
#   flock /tmp/lectrice-heavy-gate.lock bash scripts/highlights-dock-capture.sh
#
# Output: /tmp/lectrice-highlights-dock.png + DOCK_BEFORE/DOCK_AFTER probe lines.
set -euo pipefail
cd "$(dirname "$0")/.."

export TMPDIR=/tmp

E2E_PROFILE_DIR="$(mktemp -d /tmp/lectrice-dock-profile.XXXXXX)"
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR"

echo "==> Building frontend (VITE_E2E_NATIVE=true + VITE_E2E=true, seed=single)"
VITE_E2E_NATIVE=true \
  VITE_E2E=true \
  VITE_E2E_NATIVE_TTS=none \
  VITE_E2E_NATIVE_SEED=single \
  VITE_E2E_PROFILE_DIR="$APP_DIR" \
  "$HOME/.local/share/pnpm/pnpm" build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + measuring the dock"
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-dock-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/highlights-dock.e2e.mjs "$HOME/.local/share/pnpm/pnpm" test:e2e
'
