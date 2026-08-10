#!/usr/bin/env bash
#
# Reproducible runner for the packaged close-journey E2E
# (e2e/close-journey.e2e.mjs) — four phases over ONE hermetic profile, each
# a fresh app process:
#
#   dl1-create  resume → drag-select → Yellow → capture the success toast →
#               GENUINE window close (xdotool windowclose = WM_DELETE_WINDOW,
#               the message a window manager sends on the close button — NOT
#               a process kill, which would prove nothing about
#               CloseRequested and would pass a broken fix).
#   dl1-verify  relaunch → resume → the highlight must STILL be there.
#               Expected RED on main (DL-1).
#   dl2-create  resume (page 2) → Next (page 3) → GENUINE window close,
#               inside the page-change save debounce (500 ms — the explicit
#               argument at useAutoSave.ts:90, not the function default :74-75).
#   dl2-verify  relaunch → resume → the page must be 3. Expected RED on
#               main (DL-2).
#
# The runner also verifies the observer side after each phase: the profile
# DB's highlight row (v_highlight_citations) and the library row's page.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101 — includes
#   xdotool, added for this lane's genuine close)
#
# Run from anywhere:   bash e2e/run-close-journey.sh
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

echo "==> Building debug binary + all four phases in the devShell"
export CI=true
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-close-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  DB="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"
  # run_phase NEVER returns non-zero (set -e would kill the whole lane on the
  # first RED phase); the status lands in the global PHASE_STATUS.
  PHASE_STATUS=0
  run_phase() {
    local PHASE="$1"
    CLOSE_PHASE="$PHASE" E2E_SPEC=./e2e/close-journey.e2e.mjs pnpm test:e2e || PHASE_STATUS=$?
    echo "==> PHASE $PHASE exit: $PHASE_STATUS"
    # PHASE ISOLATION: the verify phases never close the window, and a
    # lingering app keeps running its 30s autosave interval with its stale
    # page — which overwrote the next phase fresh row (the false
    # "resume-side defect" of the pre-isolation runs). KILL the app after
    # every phase and wait for the death. The [r] bracket keeps the pattern
    # from matching this script own command line.
    pkill -f "target/debug/tauri-pdf-reade[r]" 2>/dev/null || true
    for _ in $(seq 1 100); do
      if ! pgrep -f "target/debug/tauri-pdf-reade[r]" >/dev/null 2>&1; then break; fi
      sleep 0.2
    done
  }

  echo "==> PHASE dl1-create"
  run_phase dl1-create; D1C=$PHASE_STATUS

  # ── THE DECISIVE NUMBER: the interval between the Yellow click and the
  #    window close, joined with the app-death timestamp (teardown latency).
  #    clickToClose > 500 ms would mean the debounce flushed BEFORE the close
  #    and DL-1 was never tested; clickToDeath >= 500 ms names the 500 ms
  #    timer as the persistence mechanism (it fired during teardown).
  if [ -f /tmp/lectrice-dl1-timing.json ]; then
    TCLICK=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" /tmp/lectrice-dl1-timing.json tClick)
    TCLOSE=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" /tmp/lectrice-dl1-timing.json tClose)
    TTOAST=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" /tmp/lectrice-dl1-timing.json tToastDone)
    # Poll for the app process death (the debug binary launched by tauri-driver).
    TDEATH=""
    for _ in $(seq 1 200); do
      if ! pgrep -f "target/debug/tauri-pdf-reade[r]" >/dev/null 2>&1; then
        TDEATH=$(date +%s%3N)
        break
      fi
      sleep 0.05
    done
    if [ -n "$TDEATH" ]; then
      echo "==> DL1 TIMING: clickToToast=$((TTOAST - TCLICK))ms clickToClose=$((TCLOSE - TCLICK))ms closeToDeath=$((TDEATH - TCLOSE))ms clickToDeath=$((TDEATH - TCLICK))ms"
    else
      echo "==> DL1 TIMING: clickToClose=$((TCLOSE - TCLICK))ms (app process never observed dying within 10s)"
    fi
  else
    echo "==> DL1 TIMING: no timing file (spec did not reach the click)"
  fi

  echo "==> observer: highlight rows after dl1-create (ZERO would confirm the write never flushed)"
  sqlite3 "$DB" "SELECT count(*) FROM v_highlight_citations;" 2>&1 || echo "no view/rows"

  echo "==> PHASE dl1-verify"
  run_phase dl1-verify; D1V=$PHASE_STATUS

  # ── DL2 PAIR ON ITS OWN PROFILE (the dl1 pair residue — highlight row,
  #    lingering apps — contaminated the shared-profile runs). Fresh profile,
  #    fresh build (the fixture paths are baked at build time).
  echo "==> switching to profile 2 for the dl2 pair"
  PROFILE2="$(mktemp -d)"
  APP_DIR2="$PROFILE2/com.lectrice.reader"
  mkdir -p "$APP_DIR2"
  node scripts/gen-e2e-fixtures.mjs "$APP_DIR2" >/dev/null
  export XDG_DATA_HOME="$PROFILE2" XDG_CONFIG_HOME="$PROFILE2"
  DB2="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"
  ( cd /home/notroot/Documents/Code/personal/tauri-pdf-reader-114-dl1-timing && \
    CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=single \
    VITE_E2E_PROFILE_DIR="$APP_DIR2" pnpm build >/dev/null 2>&1 )
  touch src-tauri/src/lib.rs
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )

  echo "==> PHASE dl2-create (profile 2)"
  run_phase dl2-create; D2C=$PHASE_STATUS
  echo "==> observer: library row after dl2-create (3 confirms the close-flush landed)"
  sqlite3 "$DB2" "SELECT title, current_page FROM documents ORDER BY last_opened_at DESC LIMIT 1;" 2>&1

  echo "==> PHASE dl2-verify (profile 2)"
  run_phase dl2-verify; D2V=$PHASE_STATUS

  echo "==> lane summary: dl1-create=$D1C dl1-verify=$D1V dl2-create=$D2C dl2-verify=$D2V"
  [ "$D1C" -eq 0 ] && [ "$D1V" -eq 0 ] && [ "$D2C" -eq 0 ] && [ "$D2V" -eq 0 ]
'
