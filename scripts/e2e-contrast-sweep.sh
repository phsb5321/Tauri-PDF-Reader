#!/usr/bin/env bash
#
# Runner for the EXHAUSTIVE contrast sweep (e2e/contrast-sweep.e2e.mjs).
#
# `e2e-contrast-capture.sh` runs the curated-node contrast receipt; this one
# walks every painted text node in both themes and fails on any AA miss.
#
#   bash scripts/e2e-contrast-sweep.sh              (gate: any violation = red)
#   SWEEP_AUDIT=1 bash scripts/e2e-contrast-sweep.sh (audit: report, don't fail)
#
# Inherits the shared entry points — no hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101)
set -euo pipefail
cd "$(dirname "$0")/.."

export SWEEP_AUDIT="${SWEEP_AUDIT:-0}"

# Pin the profile under /tmp explicitly: mktemp -d follows TMPDIR, and the
# hermetic-profile guard (src-tauri/src/lib.rs assert_hermetic_profile) rejects
# a profile outside the process temp root or /tmp. A host with TMPDIR=/var/tmp
# otherwise fails every packaged lane at boot.
E2E_PROFILE_DIR="$(mktemp -d /tmp/lectrice-sweep-profile.XXXXXX)"
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=dual)"
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=dual \
  VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
touch src-tauri/src/lib.rs

toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-sweep-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/contrast-sweep.e2e.mjs pnpm test:e2e
'
