#!/usr/bin/env bash
#
# Reproducible runner for the packaged contrast capture
# (e2e/contrast-capture.e2e.mjs) — the issue #120 receipt lane for the
# contrast slice (#125): explicit-light and explicit-dark home screenshots
# at the fixed 1200×800 viewport, through the same hermetic profile as the
# home journey (no-key lane: TTS=none, seed=single — the composition that
# matches the authoritative light baseline).
#
# Requires on PATH: pnpm (host 10.x), node, tauri-driver (~/.cargo/bin).
# `nix` provides the WebKitGTK/GTK toolchain + Xvfb (see scripts/e2e-toolchain.sh).
#     bash scripts/e2e-contrast-capture.sh               (no-key lane, home+reader)
#     E2E_LANE=key bash scripts/e2e-contrast-capture.sh   (fixture TTS lane, tts phase)
set -euo pipefail
cd "$(dirname "$0")/.."

LANE="${E2E_LANE:-no-key}"
case "$LANE" in
  no-key) TTS_ENV="none"; SEED_ENV="single"; CAPTURE_PHASE="home" ;;
  key)    TTS_ENV="fixture"; SEED_ENV="dual"; CAPTURE_PHASE="tts" ;;
  *) echo "ERROR: unknown E2E_LANE=$LANE (no-key|key)" >&2; exit 2 ;;
esac
export CAPTURE_PHASE

# Hermetic profile via the SHARED helper. Pin the profile under /tmp
# explicitly: mktemp -d would otherwise follow a redirected TMPDIR and the
# hermetic-profile guard (src-tauri/src/lib.rs assert_hermetic_profile)
# rejects a profile created outside /tmp.
E2E_PROFILE_DIR="$(mktemp -d /tmp/lectrice-contrast-profile.XXXXXX)"
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR"

echo "==> Building frontend (VITE_E2E_NATIVE=true, lane=$LANE, seed=$SEED_ENV)"
VITE_E2E_NATIVE=true \
  VITE_E2E_NATIVE_TTS="$TTS_ENV" \
  VITE_E2E_NATIVE_SEED="$SEED_ENV" \
  VITE_E2E_PROFILE_DIR="$APP_DIR" \
  "$HOME/.local/share/pnpm/pnpm" build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + running capture under Xvfb"
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-contrast-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/contrast-capture.e2e.mjs "$HOME/.local/share/pnpm/pnpm" test:e2e
'
