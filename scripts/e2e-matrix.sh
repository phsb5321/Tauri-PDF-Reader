#!/usr/bin/env bash
#
# scripts/e2e-matrix.sh — the serial full-matrix entry point for the packaged
# user gate (the CI `full-matrix` job: nightly schedule + manual dispatch).
#
# Every lane is a SELF-CONTAINED runner with its own hermetic profile, its own
# toolchain entry, its own Xvfb and its own build (mutually-exclusive build
# flags mean lanes cannot share a binary). This script only sequences them
# strictly one-at-a-time and reports per-lane evidence.
#
# Why serial: vm103 is a single-slot runner — the matrix exists in TIME, not
# in concurrent jobs. Never parallelise these lanes. Any lane failure
# (including BLOCKED: missing driver/display/fixture) fails the whole matrix;
# there is no skip-green.
#
# Run from anywhere:   bash scripts/e2e-matrix.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# Clear stale evidence from prior runs (the workflow's lane step is the
# single canonical command; the clear lives here).
rm -f /tmp/lectrice-matrix-*.log /tmp/lectrice-e2e-*-xvfb.log

STATUS=0
run_lane() {
  local name="$1"
  shift
  local log="/tmp/lectrice-matrix-${name}.log"
  echo "===== LANE $name — $(date -u +%H:%M:%SZ) ====="
  if "$@" >"$log" 2>&1; then
    echo "LANE $name: PASS"
  else
    echo "LANE $name: FAIL — evidence: $log"
    tail -20 "$log" | sed 's/^/    | /'
    STATUS=1
  fi
}

run_lane critical-loop bash e2e/run-critical-loop.sh
run_lane native-play   bash scripts/e2e-native.sh
run_lane home          bash scripts/e2e-home.sh
run_lane open          bash e2e/run-open-journey.sh
run_lane session       bash e2e/run-session-journey.sh
run_lane reader        bash e2e/run-reader-journey.sh
run_lane highlight     bash e2e/run-highlight-journey.sh
run_lane close         bash e2e/run-close-journey.sh

if [ "$STATUS" -ne 0 ]; then
  echo "MATRIX: one or more lanes failed (see per-lane evidence above)."
  exit 1
fi
echo "MATRIX: all lanes PASS."
