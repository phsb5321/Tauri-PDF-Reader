#!/usr/bin/env bash
#
# Reproducible runner for the packaged library-202 journey E2E
# (e2e/library-202-journey.e2e.mjs) — the user-gate lane for slice 202
# (#183 tail: labeled read-aloud controls, 0%-vs-divider track treatment,
# width/scale legibility, keyboard reachability, pinned New shelf form).
#
# HEAVY LANE — holds the shared serial-work lock for its whole run:
#
#   flock -w 1500 is taken on /tmp/lectrice-heavy-gate.lock (bounded wait;
#   the runner refuses with BLOCKED rather than racing QA/siblings).
#
# Two lanes, one spec; the lane decides seed + TTS env (same contract as
# scripts/e2e-home.sh):
#
#   E2E_LANE=no-key   (default) VITE_E2E_NATIVE_TTS=none, seed=single
#   E2E_LANE=key      VITE_E2E_NATIVE_TTS=fixture, seed=dual
#   E2E_202_LANES="no-key key" (default: both, serial, one lock hold)
#
# Hermetic profile via the SHARED helpers (scripts/e2e-profile.sh +
# scripts/e2e-toolchain.sh + scripts/gen-e2e-fixtures.mjs) — unchanged
# fixtures; this slice adds NO bootstrap seed (the 0% packaged probe is
# documented as a seam gap; the jsdom suite owns that branch).
#
# The cargo build is bounded separately (timeout 1500s) and reports
# BLOCKED-with-reason on timeout — a build timeout is NOT a journey verdict
# (the 08/09 #200 seat's 900s cold-build timeout is the recorded precedent).
#
# Xvfb screen is 3200x1400 so the journey's 2560px width fits.
#
# Requires on PATH: pnpm, node, tauri-driver (~/.cargo/bin); nix provides
# WebKitGTK/GTK + Xvfb.
#     E2E_LANE=no-key bash e2e/run-202-library-journey.sh
#     E2E_202_LANES="no-key key" bash e2e/run-202-library-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

LOCK_PATH=/tmp/lectrice-heavy-gate.lock

# One lock hold for the whole run (bounded wait, then BLOCKED — never race).
exec 9>"$LOCK_PATH"
if ! flock -w 1500 9; then
  echo "BLOCKED: /tmp/lectrice-heavy-gate.lock busy for >1500s — run later, do not race" >&2
  exit 3
fi

mapfile -t LANES < <(tr ' ' '\n' <<< "${E2E_202_LANES:-no-key key}")

OVERALL=0
for LANE in "${LANES[@]}"; do
  case "$LANE" in
    no-key) TTS_ENV="none"; SEED_ENV="single" ;;
    key)    TTS_ENV="fixture"; SEED_ENV="dual" ;;
    *) echo "ERROR: unknown E2E_LANE=$LANE (no-key|key)" >&2; exit 2 ;;
  esac

  # Fresh hermetic profile PER LANE (the helper mktemps a new dir per run).
  unset E2E_PROFILE_DIR
  source ./scripts/e2e-profile.sh
  source ./scripts/e2e-toolchain.sh
  APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
  mkdir -p "$APP_DIR"
  node scripts/gen-e2e-fixtures.mjs "$APP_DIR"

  echo "==> [lane=$LANE] Building frontend (VITE_E2E_NATIVE=true, seed=$SEED_ENV)"
  VITE_E2E_NATIVE=true \
    VITE_E2E_NATIVE_TTS="$TTS_ENV" \
    VITE_E2E_NATIVE_SEED="$SEED_ENV" \
    VITE_E2E_PROFILE_DIR="$APP_DIR" \
    pnpm build
  # Force tauri::generate_context! to re-embed the freshly built dist/.
  touch src-tauri/src/lib.rs

  echo "==> [lane=$LANE] Building debug binary (bounded 1500s) + running journey under Xvfb"
  # toolchain_run (NOT toolchain_exec: that execs away the process and a
  # second lane would never run). Exit status propagates through nix develop.
  if ! toolchain_run "
    set -euo pipefail
    if ! timeout 1500 cargo build --features e2e-tts-fixture --manifest-path src-tauri/Cargo.toml; then
      echo 'BLOCKED: cargo build timed out (1500s) or failed — build identity unknown, NOT a journey verdict' >&2
      exit 4
    fi
    export WEBKIT_WEBDRIVER=\"\$(command -v WebKitWebDriver)\"
    export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
    export GDK_BACKEND=x11
    DISPNUM_FILE=\$(mktemp)
    Xvfb -displayfd 3 -screen 0 3200x1400x24 3>\$DISPNUM_FILE >/tmp/lectrice-e2e-202-xvfb.log 2>&1 &
    XVFB_PID=\$!
    trap \"kill \$XVFB_PID 2>/dev/null || true\" EXIT
    for _ in \$(seq 1 100); do [ -s \$DISPNUM_FILE ] && break; sleep 0.1; done
    DISPNUM=\$(cat \$DISPNUM_FILE)
    [ -n \"\$DISPNUM\" ] || { echo 'ERROR: Xvfb failed to start' >&2; exit 1; }
    export DISPLAY=:\$DISPNUM
    echo \"Xvfb ready on DISPLAY=\$DISPLAY profile=\$XDG_DATA_HOME\"
    E2E_SPEC=./e2e/library-202-journey.e2e.mjs pnpm test:e2e
  "; then
    echo "==> [lane=$LANE] FAILED" >&2
    OVERALL=1
  else
    echo "==> [lane=$LANE] PASSED"
  fi
done

exit "$OVERALL"
