#!/usr/bin/env bash
#
# Reproducible runner for the packaged reauthorization journey
# (e2e/reauth-journey.e2e.mjs) — the issue #120 lost-grant lane.
#
# One hermetic profile, four app launches:
#   seed   — bootstrap seeds fixture A and relocates the row to an
#            OUT-OF-SCOPE copy of the same PDF (real backend relocate,
#            hash-verified) — the lost-grant state.
#   good   — resume line click -> reauth picker returns the in-scope fixture
#            A -> relocate accepts -> reader displays rendered text.
#   cancel — picker returns null -> OPEN_CANCELLED alert visible.
#   wrong  — picker returns the corrupt fixture -> relocate refuses
#            (HASH_MISMATCH) -> WRONG_DOCUMENT alert visible, row untouched.
#   repeat — two resumes in ONE launch: pick 1 = corrupt (refused), pick 2 =
#            fixture B, a real DIFFERENT book, which must be refused too.
#            Catches identity checked only on the first attempt.
#   retry  — the same two resumes with the CORRECT book second: it must open.
#            Without this, `repeat` would also pass against an app that stops
#            responding after one failure.
#
# The observer (this script) pre-places the out-of-scope copy and the corrupt
# fixture; the frontend is rebuilt per phase with the phase's picker-outcome
# envs (the dialog is WebDriver-impossible — same seam class as
# VITE_E2E_OPEN_PATH). The fs read is NOT faked in any phase: the spec never
# arms the fixture-bytes seam, so the scope denial is the real plugin-fs one.
#
# Run from anywhere:   bash e2e/run-reauth-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

# The out-of-scope copy: OUTSIDE the profile dir, so plugin-fs denies it.
OUT_SCOPE_DIR="${E2E_PROFILE_DIR}-outscope"
mkdir -p "$OUT_SCOPE_DIR"
cp "$APP_DIR/e2e-resume-fixture-a.pdf" "$OUT_SCOPE_DIR/e2e-resume-fixture-a.pdf"
OUT_SCOPE_PATH="$OUT_SCOPE_DIR/e2e-resume-fixture-a.pdf"
export OUT_SCOPE_PATH

# The wrong-file fixture: garbage bytes with a .pdf name (exists; the open
# reaches relocate, which hashes and refuses).
printf '%%PDF-1.7 this is not the book %s\n' "$(date +%s)" > "$APP_DIR/corrupt.pdf"

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=single) + phases in the devShell"
export CI=true
toolchain_exec '
  set -euo pipefail
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-reauth-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  GOOD="$XDG_DATA_HOME/com.lectrice.reader/e2e-resume-fixture-a.pdf"
  CORRUPT="$XDG_DATA_HOME/com.lectrice.reader/corrupt.pdf"
  # A real, parseable book that is NOT row A: the second pick in phase repeat.
  # (No apostrophes below this line — the whole block is single-quoted.)
  OTHER="$XDG_DATA_HOME/com.lectrice.reader/e2e-resume-fixture-b.pdf"
  OUTSCOPE="$OUT_SCOPE_PATH"

  echo "==> PHASE seed"
  SEED_STATUS=0
  ( CI=true VITE_E2E_NATIVE=true VITE_E2E=true VITE_E2E_NATIVE_TTS=none \
      VITE_E2E_NATIVE_SEED=single VITE_E2E_PROFILE_DIR="$XDG_DATA_HOME/com.lectrice.reader" \
      VITE_E2E_REAUTH_OUT_PATH="$OUTSCOPE" pnpm build >/dev/null ) || SEED_STATUS=$?
  if [ "$SEED_STATUS" -eq 0 ]; then
    touch src-tauri/src/lib.rs
    ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
    REAUTH_PHASE=seed E2E_SPEC=./e2e/reauth-journey.e2e.mjs pnpm test:e2e || SEED_STATUS=$?
  fi
  echo "==> PHASE seed exit: $SEED_STATUS"

  run_phase() {
    local phase="$1" mode="$2" path="$3"
    local status=0
    echo "==> PHASE $phase (reauth mode=$mode path=$path)"
    ( CI=true VITE_E2E_NATIVE=true VITE_E2E=true VITE_E2E_NATIVE_TTS=none \
        VITE_E2E_NATIVE_SEED=single VITE_E2E_PROFILE_DIR="$XDG_DATA_HOME/com.lectrice.reader" \
        VITE_E2E_REAUTH_OUT_PATH="$OUTSCOPE" VITE_E2E_REAUTH_MODE="$mode" \
        VITE_E2E_REAUTH_PATH="$path" pnpm build >/dev/null ) || status=$?
    if [ "$status" -eq 0 ]; then
      touch src-tauri/src/lib.rs
      ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
      REAUTH_PHASE="$phase" E2E_SPEC=./e2e/reauth-journey.e2e.mjs pnpm test:e2e || status=$?
    fi
    echo "==> PHASE $phase exit: $status"
    return "$status"
  }

  GOOD_STATUS=0
  run_phase good "" "$GOOD" || GOOD_STATUS=$?
  CANCEL_STATUS=0
  run_phase cancel cancel "" || CANCEL_STATUS=$?
  WRONG_STATUS=0
  run_phase wrong "" "$CORRUPT" || WRONG_STATUS=$?
  REPEAT_STATUS=0
  run_phase repeat "" "$CORRUPT|$OTHER" || REPEAT_STATUS=$?
  RETRY_STATUS=0
  run_phase retry "" "$CORRUPT|$GOOD" || RETRY_STATUS=$?

  echo "==> lane summary: seed=$SEED_STATUS good=$GOOD_STATUS cancel=$CANCEL_STATUS wrong=$WRONG_STATUS repeat=$REPEAT_STATUS retry=$RETRY_STATUS"
  [ "$SEED_STATUS" -eq 0 ] && [ "$GOOD_STATUS" -eq 0 ] && [ "$CANCEL_STATUS" -eq 0 ] && [ "$WRONG_STATUS" -eq 0 ] && [ "$REPEAT_STATUS" -eq 0 ] && [ "$RETRY_STATUS" -eq 0 ]
'
