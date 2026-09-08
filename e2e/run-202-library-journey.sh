#!/usr/bin/env bash
#
# Reproducible runner for the packaged library-202 journey E2E
# (e2e/library-202-journey.e2e.mjs) — the user-gate lane for slice 202
# (#183 tail: labeled read-aloud controls, 0%-vs-divider packaged gate via
# the authorized zero-progress seed, declared-125% + keyboard reachability).
#
# HEAVY LANE — holds the shared serial-work lock for its whole run:
#
#   flock -w 1500 is taken on /tmp/lectrice-heavy-gate.lock (bounded wait;
#   the runner refuses with BLOCKED rather than racing QA/siblings).
#
# THREE lanes, one spec; the lane decides seed + TTS env (contract of
# scripts/e2e-home.sh) AND exports E2E_202_LANE so the spec's lane-gated
# its are distinguishable from skipped ones in evidence:
#
#   no-key   VITE_E2E_NATIVE_TTS=none,    seed=single
#   key      VITE_E2E_NATIVE_TTS=fixture, seed=dual
#   zero     VITE_E2E_NATIVE_TTS=none,    seed=zero-progress
#            (the ONE authorized additive bootstrap seed: a 500-page fixture
#            registered at page 2 → 0% in flight; all existing seeds
#            preserved; no actor-side mutation)
#   E2E_202_LANES="no-key key zero" (default: all three, serial, one lock)
#
# Hermetic profile via the SHARED helpers (scripts/e2e-profile.sh +
# scripts/e2e-toolchain.sh + scripts/gen-e2e-fixtures.mjs); the zero lane
# additionally generates scripts/gen-e2e-zero-fixture.mjs (unique file, no
# shared-script edits).
#
# The FRONTEND build runs INSIDE the pinned devShell (pinned pnpm — the host
# pnpm is not used), then the bounded cargo build (timeout 1500s) reports
# BLOCKED-with-reason on timeout — a build timeout is NOT a journey verdict
# (08/09 #200 seat's 900s cold-build timeout is the recorded precedent).
#
# Xvfb screen is 3200x1400 so the journey's 2560px width fits. Identity is
# recorded per lane: git head + binary sha256 + lane exit.
#
# Requires on PATH: node, tauri-driver (~/.cargo/bin); nix provides the
# WebKitGTK/GTK toolchain, Xvfb and the pinned pnpm.
#     E2E_202_LANES="zero" bash e2e/run-202-library-journey.sh
#     bash e2e/run-202-library-journey.sh   (all three lanes)
set -euo pipefail
cd "$(dirname "$0")/.."

LOCK_PATH=/tmp/lectrice-heavy-gate.lock

echo "== library-202 journey identity: head=$(git rev-parse HEAD) branch=$(git branch --show-current)"

# One lock hold for the whole run (bounded wait, then BLOCKED — never race).
exec 9>"$LOCK_PATH"
if ! flock -w 1500 9; then
  echo "BLOCKED: /tmp/lectrice-heavy-gate.lock busy for >1500s — run later, do not race" >&2
  exit 3
fi

mapfile -t LANES < <(tr ' ' '\n' <<< "${E2E_202_LANES:-no-key key zero}")

OVERALL=0
for LANE in "${LANES[@]}"; do
  case "$LANE" in
    no-key) TTS_ENV="none"; SEED_ENV="single" ;;
    key)    TTS_ENV="fixture"; SEED_ENV="dual" ;;
    zero)   TTS_ENV="none"; SEED_ENV="zero-progress" ;;
    *) echo "ERROR: unknown lane=$LANE (no-key|key|zero)" >&2; exit 2 ;;
  esac

  # Fresh hermetic profile PER LANE (the helper mktemps a new dir per run).
  unset E2E_PROFILE_DIR
  source ./scripts/e2e-profile.sh
  source ./scripts/e2e-toolchain.sh
  APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
  mkdir -p "$APP_DIR"
  node scripts/gen-e2e-fixtures.mjs "$APP_DIR"
  if [ "$LANE" = "zero" ]; then
    node scripts/gen-e2e-zero-fixture.mjs "$APP_DIR"
  fi

  echo "==> [lane=$LANE] Building (frontend on the PINNED devShell pnpm) + journey under Xvfb"
  # toolchain_run (NOT toolchain_exec: that execs away the process and the
  # remaining lanes would never run). Exit status propagates through nix
  # develop. Frontend build AND cargo build both run inside the pinned shell.
  if ! toolchain_run "
    set -euo pipefail
    export VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS='$TTS_ENV' VITE_E2E_NATIVE_SEED='$SEED_ENV' VITE_E2E_PROFILE_DIR='$APP_DIR'
    pnpm build
    touch src-tauri/src/lib.rs
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
    E2E_SPEC=./e2e/library-202-journey.e2e.mjs E2E_202_LANE='$LANE' pnpm test:e2e
  "; then
    echo "==> [lane=$LANE] FAILED (head=$(git rev-parse HEAD) binary=$(sha256sum "$E2E_APP_PATH" 2>/dev/null | cut -c1-16 || echo unknown))" >&2
    OVERALL=1
  else
    echo "==> [lane=$LANE] PASSED (head=$(git rev-parse HEAD) binary=$(sha256sum "$E2E_APP_PATH" 2>/dev/null | cut -c1-16 || echo unknown))"
  fi
done

exit "$OVERALL"
