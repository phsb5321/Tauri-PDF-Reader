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

# Tamper 1: remove the lane run from the PR-fast job.
sed 's|run: bash e2e/run-critical-loop.sh|# (lane removed)|' "$WF" >"$WORK/tampered.yml"
expect_violation "PR-fast lane removed" "pr-fast job does not run e2e/run-critical-loop.sh"

# Tamper 2: skip-green on the lane step.
sed '/run: bash e2e\/run-critical-loop.sh/a\        continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error added" "continue-on-error found (skip-green)"

# Tamper 3: path-filter the pull_request trigger.
sed 's|^  pull_request:$|  pull_request:\n    paths: ["src/**"]|' "$WF" >"$WORK/tampered.yml"
expect_violation "pull_request path filter added" "pull_request is path-filtered"

echo "NEGATIVE CONTROL PASS: contract catches all three drop attempts for the intended reasons"
