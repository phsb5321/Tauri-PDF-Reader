#!/usr/bin/env bash
#
# Reproducible runner for the packaged home-journey E2E
# (e2e/home-journey.e2e.mjs) — the user-gate lane for the catch-up epic
# (#89 resume-and-play, #91 resume line + Also in progress, #92 TTS signal).
#
# Two lanes, one spec; the lane decides which half of each assertion runs:
#
#   E2E_LANE=no-key   (default) VITE_E2E_NATIVE_TTS=none, seed=single
#                     fresh launch state: NO TTS key (session-only, #73), one
#                     in-flight book. Asserts the setup signal + Configure,
#                     absence of "Also in progress", silent resume, honest
#                     resume-and-play degradation.
#   E2E_LANE=key      VITE_E2E_NATIVE_TTS=fixture, seed=dual
#                     TTS initialized via the e2e-tts-fixture backend (no
#                     network). Asserts the signal is gone, "Also in
#                     progress" present, and resume-and-play drives the TTS
#                     store to "playing".
#
# Hermetic profile: the app's data dir (SQLite library + fs scope + fixture
# PDFs) lives under a fresh XDG_DATA_HOME, so a real user library is never
# touched. The observer (this script) generates the fixture PDFs prelaunch
# with scripts/gen-e2e-fixtures.mjs and hands the profile dir to the frontend
# build via VITE_E2E_PROFILE_DIR — the bootstrap seeds the library through the
# REAL library IPC before first render (deterministic home content).
#
# Not wired into CI: needs WebKitGTK + a display (vimeflow#65 software-render
# trap), same as the other tauri-driver lanes.
#
# Requires on PATH: pnpm, node, and tauri-driver (~/.cargo/bin). `nix`
# provides the WebKitGTK/GTK toolchain + Xvfb.
#     bash scripts/e2e-home.sh              (no-key lane)
#     E2E_LANE=key bash scripts/e2e-home.sh
#     pnpm test:e2e:home                    (both lanes, serial)
set -euo pipefail
cd "$(dirname "$0")/.."

LANE="${E2E_LANE:-no-key}"
case "$LANE" in
  no-key) TTS_ENV="none"; SEED_ENV="single" ;;
  key)    TTS_ENV="fixture"; SEED_ENV="dual" ;;
  *) echo "ERROR: unknown E2E_LANE=$LANE (no-key|key)" >&2; exit 2 ;;
esac


# Hermetic profile via the SHARED helper (one entry point for all lanes —
# scripts/e2e-profile.sh). Known at BUILD time so the bootstrap can seed
# through real IPC (VITE_E2E_PROFILE_DIR) AND at RUN time (XDG_* exported).
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
  pnpm build
# Force tauri::generate_context! to re-embed the freshly built dist/.
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + running E2E under Xvfb"
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  # Force software rendering so WebKit can create a session headless (vimeflow#65).
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  # Pin the X11 backend: without it, GTK inherits the host session
  # WAYLAND_DISPLAY and creates the app window on the REAL compositor with a
  # garbage scale factor — WebKit then reports a NEGATIVE devicePixelRatio and
  # an inverted (negative) viewport, and every element hit-test fails. The
  # negative-dpr wrap is exactly the 02/08/2026 "wrapped negative viewport"
  # record, reproduced 07/08/2026 and fixed by this line (verified: dpr -1/96
  # without it, +1.04 with it). Do not "modernise" this away.
  export GDK_BACKEND=x11
  # XDG_DATA_HOME / XDG_CONFIG_HOME were exported by scripts/e2e-profile.sh in
  # the outer shell and pass through nix-shell unchanged — the app config
  # dir (sqlite library) and data dir (fs scope, flags) stay hermetic.
  # Let Xvfb pick a FREE display and report it via -displayfd (avoids collisions
  # with stale/sibling Xvfb on a fixed :NN, and is a real readiness signal rather
  # than a blind sleep — the number is written only once the display is up).
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-home-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/home-journey.e2e.mjs pnpm test:e2e
'
