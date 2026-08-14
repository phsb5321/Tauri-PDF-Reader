#!/usr/bin/env bash
#
# check-packaged-gate-contract.sh — thin wrapper over the REAL-YAML-parser
# contract (tools/check-packaged-gate-contract.mjs) plus the non-YAML checks
# for the scripts the workflow invokes. Callers and CI are unchanged.
#
# Exit: 0 = contract holds · 1 = violation · 2 = tooling/parse failure
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WF="${1:-$REPO_ROOT/tools/test/fixtures/packaged-user-gate.yml}"

# 1. The parser-based contract (fail-closed: unreadable / unparseable /
#    multi-document files exit non-zero with a distinct message).
node "$SCRIPT_DIR/check-packaged-gate-contract.mjs" "$WF" || exit $?

# 2. Non-YAML checks — the CONTENT of the scripts the workflow invokes.
STATUS=0
fail() {
  echo "CONTRACT VIOLATION: $1" >&2
  STATUS=1
}

RUNNER="$REPO_ROOT/e2e/run-critical-loop.sh"
[ -s "$RUNNER" ] || fail "e2e/run-critical-loop.sh missing or empty"
sed 's/#.*//' "$RUNNER" |
  grep -qE '^[[:space:]]*E2E_SPEC=./e2e/critical-loop.e2e.mjs([[:space:]]|$)' \
  || fail "critical-loop runner does not drive the critical-loop spec"
[ -s "$REPO_ROOT/e2e/critical-loop.e2e.mjs" ] || fail "critical-loop spec missing or empty"

MATRIX="${PACKAGED_GATE_MATRIX:-$REPO_ROOT/scripts/e2e-matrix.sh}"
[ -s "$MATRIX" ] || fail "scripts/e2e-matrix.sh missing or empty"
for lane in critical-loop native-play home open session reader highlight close; do
  grep -qE "^run_lane $lane([[:space:]]|$)" "$MATRIX" || fail "matrix does not include the $lane lane"
done

CORPUS="$REPO_ROOT/scripts/e2e-real-corpus.sh"
[ -s "$CORPUS" ] || fail "scripts/e2e-real-corpus.sh missing or empty"
grep -q 'LECTRICE_REAL_PDF_CORPUS' "$CORPUS" \
  || fail "corpus runner does not consume LECTRICE_REAL_PDF_CORPUS"

exit "$STATUS"
