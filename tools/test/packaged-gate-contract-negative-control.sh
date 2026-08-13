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
# Baseline workflow file: env-overridable so the CI contract job can point it
# at the fetched head file; default = the repo's own file.
WF="${PACKAGED_GATE_WF:-$REPO_ROOT/tools/test/fixtures/packaged-user-gate.yml}"
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

# Tamper 5: make the PR-fast job conditionally skipped (and drop the
# same-repo guard at the same time).
sed "s|^    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if: falsified" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 13: same-repo guard removed from pr-fast (fork PRs could execute).
sed "s| && github.event.pull_request.head.repo.full_name == github.repository$||" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast same-repo guard removed" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 14: mutable action ref reintroduced (SHA pins are the trust floor).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref reintroduced" "mutable action ref found"

# Tamper 15: the driver assert hardcodes ~/.cargo/bin again.
sed "s|nix develop -c bash -c 'command -v tauri-driver'|DRIVER=\"\$HOME/.cargo/bin/tauri-driver\"; [ -x \"\$DRIVER\" ]|" "$WF" >"$WORK/tampered.yml"
expect_violation "driver assert hardcodes ~/.cargo/bin" "driver assert hardcodes ~/.cargo/bin"

# Tamper 16: the prerequisite-receipt enforcement step is removed.
sed '/Prerequisite receipt enforced/,+1d' "$WF" >"$WORK/tampered.yml"
expect_violation "receipt enforcement step removed" "lacks the prerequisite-receipt enforcement step"

# Tamper 17: the contract job stops fetching the head file (head-controlled).
sed '/gh api "repos\//d' "$WF" >"$WORK/tampered.yml"
expect_violation "contract head-fetch removed" "contract job does not fetch the head workflow file"

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

# Tamper 9: colon no-op taking the invocation as its argument
# (`: bash …` succeeds without running anything).
sed 's|^          bash e2e/run-critical-loop.sh|          : bash e2e/run-critical-loop.sh|' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to colon no-op" "pr-fast job does not run e2e/run-critical-loop.sh"

# Tamper 10: falsify the real-corpus job condition (the manual lane must not
# be skippable without the contract noticing).
sed "s|^    if: github.event_name == 'workflow_dispatch'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus job condition falsified" "real-corpus job-level if: is not exactly the workflow_dispatch trigger"

# Tamper 11: remove the corpus evidence upload's always-run guard.
cp "$WF" "$WORK/tampered.yml"
sed 's|if: always()|if: success()|' "$WORK/tampered.yml" >"$WORK/tampered2.yml" && mv "$WORK/tampered2.yml" "$WORK/tampered.yml"
expect_violation "real-corpus upload loses always()" "real-corpus evidence upload is not if: always()"

# Tamper 12: colon no-op on the corpus invocation (the anchored-runner class).
sed 's|\(LECTRICE_CORPUS_OUT="[^"]*" \)bash scripts/e2e-real-corpus.sh|\1: bash scripts/e2e-real-corpus.sh|' "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus invocation reduced to colon no-op" "real-corpus job does not run scripts/e2e-real-corpus.sh"

# Tamper 18: concurrency group back to per-ref (global /tmp collision class).
sed 's|^  group: packaged-user-gate$|  group: packaged-user-gate-${{ github.ref }}|' "$WF" >"$WORK/tampered.yml"
expect_violation "concurrency group per-ref reintroduced" "concurrency group uses github.ref"

# Tamper 19: a non-guarded job allowed to run on pull_request (the reviewer's
# full-matrix falsifier).
sed "s|^    if: github.event_name != 'pull_request'$|    if: github.event_name == 'pull_request'|" "$WF" >"$WORK/tampered.yml"
expect_violation "unguarded job can run on pull_request" "full-matrix job can run on pull_request without the same-repo guard"

# Tamper 20: base.sha reduced to a comment (checkout loads head tools).
sed 's|github.event.pull_request.base.sha|github.event.pull_request.head.sha # base.sha|' "$WF" >"$WORK/tampered.yml"
expect_violation "base-sha checkout reduced to a comment" "contract job does not pin its checkout to the base sha"

# Tamper 21: the enforcement step body stops testing the receipt.
sed 's|\[ -f ci-evidence/prerequisite-failure.json \]|true|' "$WF" >"$WORK/tampered.yml"
expect_violation "enforcement step body vacuous" "enforcement step does not test the receipt's presence"

# Tamper 22: the bootstrap-inert anchor is removed (first-introduction PR
# could self-certify).
sed '/BOOTSTRAP-INERT/d' "$WF" >"$WORK/tampered.yml"
expect_violation "bootstrap-inert anchor removed" "contract job lacks the bootstrap-inert anchor check"

echo "NEGATIVE CONTROL PASS: contract catches all twenty-two drop attempts for the intended reasons"
