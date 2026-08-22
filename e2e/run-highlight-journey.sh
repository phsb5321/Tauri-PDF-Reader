#!/usr/bin/env bash
#
# Reproducible runner for the packaged highlight-journey E2E
# (e2e/highlight-journey.e2e.mjs) — two phases over ONE hermetic profile:
#
#   phase create — resume the fixture, drag-select text, pick Yellow,
#                  assert the overlay mark renders; then the runner verifies
#                  the row through the v_highlight_citations view (observer).
#   phase verify — the app RELAUNCHES on the same profile; the spec asserts
#                  the SAME overlay mark without creating anything.
#
# One profile for both phases is the whole point: persistence across a real
# app restart is the two-sided assertion.
#
# Lives in e2e/ (not scripts/) deliberately: eng's 101 owns scripts/ + flake
# toolchain routing. It sources the SHARED hermetic-profile helper
# (scripts/e2e-profile.sh) and reuses the home-journey seeding (fixtures +
# VITE_E2E_NATIVE bootstrap) — no second profile mechanism.
#
# Run from anywhere:   bash e2e/run-highlight-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Hermetic profile + pinned toolchain — the shared entry points used by every
# packaged lane. Keeping a private nix-shell list here was the drift.
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=single, no TTS)"
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=single \
  VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + both phases under Xvfb"
export CI=true
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  # XDG_* were exported by scripts/e2e-profile.sh in the outer shell and pass
  # through nix-shell unchanged — config + data dirs stay hermetic for BOTH
  # phases, which is what makes persistence observable.
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-highlight-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  DB="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"

  echo "==> PHASE create"
  HIGHLIGHT_PHASE=create E2E_SPEC=./e2e/highlight-journey.e2e.mjs pnpm test:e2e

  echo "==> observer: v_highlight_citations after create"
  sqlite3 "$DB" "SELECT highlight_id, page_number, substr(text_content,1,40) FROM v_highlight_citations;"

  echo "==> PHASE verify (fresh app process, same profile)"
  HIGHLIGHT_PHASE=verify E2E_SPEC=./e2e/highlight-journey.e2e.mjs pnpm test:e2e

  echo "==> observer: v_highlight_citations after verify (must still hold)"
  sqlite3 "$DB" "SELECT highlight_id, page_number, substr(text_content,1,40) FROM v_highlight_citations;"
'
