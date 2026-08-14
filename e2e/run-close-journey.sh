#!/usr/bin/env bash
#
# Reproducible runner for the packaged close-journey E2E
# (e2e/close-journey.e2e.mjs) — four phases, each a fresh app process. The
# dl1 pair and the dl2 pair run on SEPARATE hermetic profiles: on a shared
# profile the dl1 residue (its highlight row, and a lingering app still
# running its 30 s autosave with a stale page) overwrote the dl2 row and
# produced a false "resume-side defect" reading.
#
#   dl1-create  resume → drag-select → Yellow → capture the success toast →
#               GENUINE window close (xdotool windowquit — per `man xdotool`,
#               "sends a request, allowing application close confirmation":
#               WM_DELETE_WINDOW. NOT windowclose, which destroys the window
#               without any client close request — the lane would never
#               exercise CloseRequested (14/08 lane-6/8 evidence).
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
# The runner also PRINTS the observer side after each phase — the profile
# DB highlight row (v_highlight_citations) and the library row page. Those
# are evidence for a human reading the log; only the four phase exit codes
# gate the lane summary.
#
# TIMING: each create phase publishes its own record under
# $E2E_PROFILE_DIR/close-timing/<phase>.json and the runner prints it verbatim.
# The decisive figure is actionToWindowCloseMs — an UPPER bound on the
# interval from the debounce-enqueuing action to the window actually going
# away, measured by the spec, which is the only process alive at the close.
# Under 500 ms means the close landed INSIDE the debounce window, so the
# debounce cannot have flushed by itself and any survival is attributable to
# the close handler. The spec ASSERTS that bound rather than only printing it:
# a close slower than the debounce makes the phase RED, because a green there
# would be vacuous. The runner must never time the close itself — by the time
# it regains control it has already killed the app.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101 — includes
#   xdotool, added for this lane's genuine close)
#
# Run from anywhere:   bash e2e/run-close-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# Exported so the profile-2 rebuild inside toolchain_exec can return to the
# repo root without hardcoding one worktree's absolute path.
export E2E_REPO_ROOT="$PWD"

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
# STALE + CONCURRENT EVIDENCE GUARD: a fixed path outlives its run AND collides
# with the sibling worktrees this lane anchors its pkill for. Per-run directory,
# emptied up front, so a create phase that dies before its close cannot publish
# an older run numbers, and two lanes cannot overwrite each other.
TIMING_DIR="$E2E_PROFILE_DIR/close-timing"
rm -rf "$TIMING_DIR"
mkdir -p "$TIMING_DIR"
export TIMING_DIR
# DL-1 attribution seam: the create IPC is deliberately held in flight for
# this window (Rust highlights_create, e2e-tts-fixture only, read BEFORE the
# DB mutation) so the lane's close can prove the window was HELD for the
# pending write. Inherited by the app through wdio → tauri-driver.
export LECTRICE_E2E_HIGHLIGHT_CREATE_DELAY_MS=250
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
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>"$DISPNUM_FILE" >/tmp/lectrice-e2e-close-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true; rm -f $DISPNUM_FILE" EXIT
  for _ in $(seq 1 100); do [ -s "$DISPNUM_FILE" ] && break; sleep 0.1; done
  export DISPLAY=":$(cat "$DISPNUM_FILE")"
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  # A REAL window manager is mandatory (125): xdotool windowquit sends
  # WM_DELETE_WINDOW (the graceful close-confirmation message), but without a
  # WM the client message never reaches the app — lane-9 measured ZERO
  # CloseRequested firings with no WM. openbox makes the close reach the app
  # close handler. Fail if openbox dies: a close lane without a WM is a
  # false-green machine.
  openbox --sm-disable >/tmp/lectrice-e2e-close-openbox.log 2>&1 &
  OPENBOX_PID=$!
  trap "kill $OPENBOX_PID 2>/dev/null || true; kill $XVFB_PID 2>/dev/null || true; rm -f $DISPNUM_FILE" EXIT
  # WM liveness: openbox becomes the WM within ~300ms of start. Prefer the
  # _NET_SUPPORTING_WM_CHECK probe when xprop exists; the devShell does not
  # ship it, so settle on process liveness (a dead openbox is a hard fail).
  WM_UP=0
  for _ in $(seq 1 30); do
    if ! kill -0 "$OPENBOX_PID" 2>/dev/null; then
      echo "FATAL: openbox exited on DISPLAY=$DISPLAY — no WM for the close lane; windowquit cannot reach CloseRequested without one (lane-9 evidence)" >&2
      exit 1
    fi
    if command -v xprop >/dev/null 2>&1; then
      if xprop -root _NET_SUPPORTING_WM_CHECK >/dev/null 2>&1; then
        WM_UP=1
        break
      fi
    else
      WM_UP=1
    fi
    sleep 0.1
  done
  [ "$WM_UP" -eq 1 ] || { echo "FATAL: WM never came up on DISPLAY=$DISPLAY" >&2; exit 1; }
  echo "openbox WM ready (pid=$OPENBOX_PID)"

  DB="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"
  # ANCHORED to this worktree: an unanchored "target/debug/tauri-pdf-reade[r]"
  # also matches the binary of a sibling worktree, so the lane would kill an
  # app belonging to another agent — and the wait below could spin on that
  # sibling and then fall through as if our own app had died. The [r] bracket
  # keeps the pattern from matching this script own command line.
  : "${E2E_REPO_ROOT:?E2E_REPO_ROOT unset — the kill pattern would match nothing and phase isolation would silently not happen}"
  APP_PAT="^${E2E_REPO_ROOT}/src-tauri/target/debug/tauri-pdf-reade[r]"
  # Validate the ANCHOR itself, once, against the file it must name. A pattern
  # that matches nothing makes pgrep fail on the first poll, so the death wait
  # would exit instantly and report isolation it never performed — fail-open.
  [ -x "$E2E_REPO_ROOT/src-tauri/target/debug/tauri-pdf-reader" ] || {
    echo "FATAL: no debug binary at $E2E_REPO_ROOT/src-tauri/target/debug/tauri-pdf-reader — the kill pattern cannot match the app" >&2
    exit 1
  }
  # run_phase NEVER returns non-zero (set -e would kill the whole lane on the
  # first RED phase); the status lands in the global PHASE_STATUS.
  PHASE_STATUS=0
  run_phase() {
    local PHASE="$1"
    # RESET FIRST: without this a passing phase inherits an earlier phase
    # non-zero status, and the four-boolean summary this lane exists to
    # produce stops being four independent readings.
    PHASE_STATUS=0
    CLOSE_TIMING_PATH="$TIMING_DIR/$PHASE.json" \
      CLOSE_PHASE="$PHASE" E2E_SPEC=./e2e/close-journey.e2e.mjs pnpm test:e2e || PHASE_STATUS=$?
    echo "==> PHASE $PHASE exit: $PHASE_STATUS"
    # PHASE ISOLATION: the verify phases never close the window, and a
    # lingering app keeps running its 30s autosave interval with its stale
    # page — which overwrote the next phase fresh row (the false
    # "resume-side defect" of the pre-isolation runs). KILL the app after
    # every phase and wait for the death.
    pkill -f "$APP_PAT" 2>/dev/null || true
    local DEAD=0
    for _ in $(seq 1 100); do
      if ! pgrep -f "$APP_PAT" >/dev/null 2>&1; then DEAD=1; break; fi
      sleep 0.2
    done
    [ "$DEAD" -eq 1 ] || echo "==> WARNING: app still alive after 20s — phase isolation NOT guaranteed for the next phase"
  }

  # The spec publishes its own timings per phase; the runner only reports them,
  # verbatim. It must NOT recompute the death timestamp: run_phase has already
  # pkilled the app and waited for it, so a poll here would measure the latency
  # of the runner itself and come out >= 500 ms for any app, fixed or broken.
  report_timing() {
    local PHASE="$1" F="$TIMING_DIR/$1.json"
    if [ -f "$F" ]; then
      echo "==> $PHASE TIMING: $(cat "$F")"
    else
      echo "==> $PHASE TIMING: no timing file — the phase never reached its close"
    fi
  }

  echo "==> PHASE dl1-create"
  run_phase dl1-create; D1C=$PHASE_STATUS

  # ── THE DECISIVE NUMBER: actionToWindowCloseMs — an UPPER bound on the
  #    interval from the Yellow click (the debounce enqueue) to the window
  #    actually going away. Under 500 ms means the close landed INSIDE the
  #    debounce window, so the debounce cannot have flushed on its own and the
  #    survival of the highlight is attributable to the close handler.
  report_timing dl1-create

  echo "==> observer: highlight rows after dl1-create (ZERO would confirm the write never flushed)"
  sqlite3 "$DB" "SELECT count(*) FROM v_highlight_citations;" 2>&1 || echo "no view/rows"

  echo "==> PHASE dl1-verify"
  run_phase dl1-verify; D1V=$PHASE_STATUS

  # ── DL2 PAIR ON ITS OWN PROFILE (the dl1 pair residue — highlight row,
  #    lingering apps — contaminated the shared-profile runs). Fresh profile,
  #    fresh build (the fixture paths are baked at build time).
  echo "==> switching to profile 2 for the dl2 pair"
  PROFILE2="$(mktemp -d)"
  # Re-arm the trap now that PROFILE2 exists, so neither temp dir leaks.
  trap "kill $XVFB_PID 2>/dev/null || true; rm -f $DISPNUM_FILE; rm -rf $PROFILE2" EXIT
  APP_DIR2="$PROFILE2/com.lectrice.reader"
  mkdir -p "$APP_DIR2"
  node scripts/gen-e2e-fixtures.mjs "$APP_DIR2" >/dev/null
  export XDG_DATA_HOME="$PROFILE2" XDG_CONFIG_HOME="$PROFILE2"
  DB2="$XDG_DATA_HOME/com.lectrice.reader/pdf-reader.db"
  ( cd "$E2E_REPO_ROOT" && \
    CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=single \
    VITE_E2E_PROFILE_DIR="$APP_DIR2" pnpm build >/dev/null 2>&1 )
  touch src-tauri/src/lib.rs
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )

  echo "==> PHASE dl2-create (profile 2)"
  run_phase dl2-create; D2C=$PHASE_STATUS
  report_timing dl2-create
  echo "==> observer: library row after dl2-create (3 confirms the close-flush landed)"
  sqlite3 "$DB2" "SELECT title, current_page FROM documents ORDER BY last_opened_at DESC LIMIT 1;" 2>&1 || echo "no row/db"

  echo "==> PHASE dl2-verify (profile 2)"
  run_phase dl2-verify; D2V=$PHASE_STATUS

  echo "==> lane summary: dl1-create=$D1C dl1-verify=$D1V dl2-create=$D2C dl2-verify=$D2V"
  [ "$D1C" -eq 0 ] && [ "$D1V" -eq 0 ] && [ "$D2C" -eq 0 ] && [ "$D2V" -eq 0 ]
'
