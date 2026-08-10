#!/usr/bin/env bash
#
# Reproducible runner for the packaged session-journey E2E
# (e2e/session-journey.e2e.mjs) — two phases over ONE hermetic profile:
#
#   phase create — open Sessions, create "E2E Session" with both fixture
#                  documents, restore it, assert the last-read document
#                  opens at its saved page, then navigate and restore again.
#   phase verify — the app RELAUNCHES on the same profile; the session must
#                  survive, restore must behave identically, and delete
#                  (2-click confirm) must remove it from the list.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101)
#
# Run from anywhere:   bash e2e/run-session-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Hermetic profile via the SHARED helper, then the SHARED toolchain.
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=dual, no TTS)"
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=dual \
  VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + both phases in the devShell"
export CI=true
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  # XDG_* were exported by scripts/e2e-profile.sh and pass through nix develop
  # unchanged — config + data dirs stay hermetic for BOTH phases.
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-session-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  # Both phases run even if the first REDs (the create-phase verdict is a
  # product finding, not a harness failure — the verify phase must still
  # produce its own evidence). Statuses are captured; the runner exits 1 if
  # either phase failed.
  echo "==> PHASE create"
  CREATE_STATUS=0
  SESSION_PHASE=create E2E_SPEC=./e2e/session-journey.e2e.mjs pnpm test:e2e || CREATE_STATUS=$?
  echo "==> PHASE create exit: $CREATE_STATUS"

  echo "==> PHASE verify (fresh app process, same profile)"
  VERIFY_STATUS=0
  SESSION_PHASE=verify E2E_SPEC=./e2e/session-journey.e2e.mjs pnpm test:e2e || VERIFY_STATUS=$?
  echo "==> PHASE verify exit: $VERIFY_STATUS"

  echo "==> lane summary: create=$CREATE_STATUS verify=$VERIFY_STATUS"
  [ "$CREATE_STATUS" -eq 0 ] && [ "$VERIFY_STATUS" -eq 0 ]
'
