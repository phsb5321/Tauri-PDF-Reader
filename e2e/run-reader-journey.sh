#!/usr/bin/env bash
#
# Reproducible runner for the packaged reader-journey E2E
# (e2e/reader-journey.e2e.mjs) — two phases over ONE hermetic profile:
#
#   phase navigate — resume the fixture, navigate 2→3 (Next) and 3→4 (page
#                    input), zoom in, asserting the RENDERED text layer
#                    follows; then the observer verifies the library row
#                    holds page 4 in the profile DB (useAutoSave landed).
#   phase verify   — the app RELAUNCHES on the same profile; the home resume
#                    line must already show "Page 4 of 5 · 80%", and resume
#                    must land on and render page 4.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101)
#
# Run from anywhere:   bash e2e/run-reader-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=single, no TTS)"
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=single \
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
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-reader-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  DB="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"

  echo "==> PHASE navigate"
  NAV_STATUS=0
  READER_PHASE=navigate E2E_SPEC=./e2e/reader-journey.e2e.mjs pnpm test:e2e || NAV_STATUS=$?
  echo "==> PHASE navigate exit: $NAV_STATUS"

  echo "==> observer: library row after navigate (useAutoSave must have landed)"
  sqlite3 "$DB" "SELECT title, current_page, page_count FROM documents ORDER BY last_opened_at DESC LIMIT 1;"

  echo "==> PHASE verify (fresh app process, same profile)"
  VERIFY_STATUS=0
  READER_PHASE=verify E2E_SPEC=./e2e/reader-journey.e2e.mjs pnpm test:e2e || VERIFY_STATUS=$?
  echo "==> PHASE verify exit: $VERIFY_STATUS"

  echo "==> lane summary: navigate=$NAV_STATUS verify=$VERIFY_STATUS"
  [ "$NAV_STATUS" -eq 0 ] && [ "$VERIFY_STATUS" -eq 0 ]
'
