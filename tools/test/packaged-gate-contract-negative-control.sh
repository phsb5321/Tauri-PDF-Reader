#!/usr/bin/env bash
#
# Negative-control test for the packaged-gate contract — proves the contract
# CATCHES a silently-dropped gate, not just that it PASSES on the shipped
# workflow (PR#595 parity: a self-pass cannot distinguish a functioning
# detector from a no-op).
#
# Tampers a throwaway copy three ways — lane removed, skip-green added,
# pull_request path-filtered — and asserts the contract fails on each, after
# asserting the shipped workflow passes.
set -euo pipefail
CONTRACT="$(dirname "$0")/../check-packaged-gate-contract.sh"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WF="$REPO_ROOT/.github/workflows/packaged-user-gate.yml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

expect_violation() {
  local desc="$1"
  local expect_msg="$2"
  local out
  out="$("$CONTRACT" "$WORK/tampered.yml" 2>&1 || true)"
  if [ -z "$out" ]; then
    echo "NEGATIVE CONTROL FAILED: contract passed where it must fail: $desc" >&2
    exit 1
  fi
  if ! printf '%s\n' "$out" | grep -qF "$expect_msg"; then
    echo "NEGATIVE CONTROL FAILED: contract failed for the WRONG reason on: $desc" >&2
    echo "  expected message: $expect_msg" >&2
    echo "  got: $out" >&2
    exit 1
  fi
  echo "caught ($expect_msg): $desc"
}

# Baseline: the shipped workflow must PASS the contract.
"$CONTRACT" "$WF" >/dev/null || {
  echo "NEGATIVE CONTROL FAILED: shipped workflow violates the contract" >&2
  exit 1
}
echo "baseline: shipped workflow passes"

# Tamper 1: remove the lane invocation from the PR-fast job.
sed 's|bash e2e/run-critical-loop.sh|# (lane removed)|' "$WF" >"$WORK/tampered.yml"
expect_violation "PR-fast lane removed" "pr-fast job does not run e2e/run-critical-loop.sh"

# Tamper 2: skip-green on the lane step (literal).
sed '/bash e2e\/run-critical-loop.sh/a\        continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (literal true) added" "continue-on-error found (skip-green)"

# Tamper 3: skip-green via expression (the literal-grep bypass class).
sed '/bash e2e\/run-critical-loop.sh/a\        continue-on-error: \${{ true }}' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (expression) added" "continue-on-error found (skip-green)"

# Tamper 4: path-filter the pull_request trigger.
sed 's|^  pull_request:$|  pull_request:\n    paths: ["src/**"]|' "$WF" >"$WORK/tampered.yml"
expect_violation "pull_request path filter added" "pull_request is path-filtered"

# Tamper 5: make the PR-fast job conditionally skipped.
sed "s|^    if: github.event_name == 'pull_request'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if: falsified" "pr-fast job-level if: is not the PR trigger"

# Tamper 6: drop a lane from the serial matrix (via the path override).
cp "$WF" "$WORK/tampered.yml"
sed 's|^run_lane reader|# run_lane reader|' "$REPO_ROOT/scripts/e2e-matrix.sh" >"$WORK/matrix-tampered.sh"
PACKAGED_GATE_MATRIX="$WORK/matrix-tampered.sh" expect_violation "matrix lane dropped" "matrix does not include the reader lane"

# Tamper 7: shell-comment the lane invocation inside the run block
# (the comment-blind substring-grep bypass class).
sed 's|^          bash e2e/run-critical-loop.sh|          # bash e2e/run-critical-loop.sh (disabled)|' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation shell-commented" "pr-fast job does not run e2e/run-critical-loop.sh"

# Tamper 8: inline-comment no-op carrying the invocation substring
# (`: # bash …` is a successful shell no-op).
sed 's|^          bash e2e/run-critical-loop.sh|          : # bash e2e/run-critical-loop.sh|' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to inline-comment no-op" "pr-fast job does not run e2e/run-critical-loop.sh"

echo "NEGATIVE CONTROL PASS: contract catches all eight drop attempts for the intended reasons"
