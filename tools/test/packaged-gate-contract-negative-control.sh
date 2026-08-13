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
# full-matrix falsifier — now caught by the exact-canonical-condition rule).
sed "s|^    if: github.event_name != 'pull_request'$|    if: github.event_name == 'pull_request'|" "$WF" >"$WORK/tampered.yml"
expect_violation "unguarded job can run on pull_request" "full-matrix job-level if: is not the exact canonical condition"

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

# Tamper 23: quoted mutable action ref (the quote-bypass class).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: "actions/checkout@v4"|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted mutable action ref" "mutable action ref found"

# Tamper 24: the lane invocation moved into an env value with a no-op run
# (the run-block-scoping class — the reviewer's exact falsifier).
sed -e 's|^          bash e2e/run-critical-loop.sh$|          true|' \
    -e 's|^      - name: Packaged PR-fast lane|      - name: Packaged PR-fast lane\n        env:\n          BURY: bash e2e/run-critical-loop.sh|' \
    "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation buried in an env value" "pr-fast job does not run e2e/run-critical-loop.sh"

# Tamper 25: pr-fast loses its job-level if entirely (a missing condition
# must fail, not pass vacuously).
sed '/^    if: github.event_name == '\''pull_request'\'' && github.event.pull_request.head.repo.full_name == github.repository$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if deleted" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 26: full-matrix loses its job-level if (a job without a condition
# runs on every event, including fork PRs).
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix job-level if deleted" "full-matrix job has no job-level if"

# Tamper 27: contract if replaced with a bare pull_request exclusion (the
# skip-capable variant — the exact-canonical-guard class).
sed "s@^    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository\$@    if: github.event_name != 'pull_request'@" "$WF" >"$WORK/tampered.yml"
expect_violation "contract if replaced with bare exclusion" "contract job-level if: is not the exact canonical guard"

# Tamper 28: contract if deleted entirely (the missing-if branch fires first).
sed "/^    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository\$/d" "$WF" >"$WORK/tampered.yml"
expect_violation "contract job-level if deleted" "contract job has no job-level if"

# Tamper 29: full-matrix if replaced with false (matrix silently never runs).
sed "s|^    if: github.event_name != 'pull_request'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix if falsified" "full-matrix job-level if: is not the exact canonical condition"

# Tamper 30: full-matrix if deleted (deletion NC for the exact-condition rule).
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
# The deletion trips the missing-if branch first; ensure the message is the
# missing-if one for full-matrix.
expect_violation "full-matrix job-level if deleted (exact)" "full-matrix job has no job-level if"

# Tamper 31: an uppercase job ID without any condition (job-scan class —
# now caught by the CLOSED job set).
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "uppercase unguarded job injected" "unexpected self-hosted job key"

# Tamper 33: a new job with a condition game that is true on pull requests
# (`!= pull_request || == pull_request`) — the closed job set rejects the
# job itself, not the condition.
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    if: github.event_name != '\''pull_request'\'' \|\| github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "condition-gamed job injected" "unexpected self-hosted job key"

# Tamper 34: a mutable ref in a form the old tag list missed (@v4.0.0).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4.0.0|' "$WF" >"$WORK/tampered.yml"
expect_violation "semver-tag mutable action ref" "mutable action ref found"

# Tamper 32: single-quoted mutable action ref (the quote-bypass class).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: '\''actions/checkout@v4'\''|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted mutable action ref" "mutable action ref found"

# Tamper 35: mutable ref with a trailing YAML comment (comment-strip class).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4 # mutable|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref with trailing comment" "mutable action ref found"

# Tamper 36: quoted job ID injected (quoted-ID class).
sed 's|^jobs:$|jobs:\n  "EVIL_JOB":\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted job ID injected" "unexpected self-hosted job key"

# Tamper 37: single-quoted job ID injected (both quoted forms must be caught).
sed 's|^jobs:$|jobs:\n  '\''EVIL_JOB'\'':\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted job ID injected" "unexpected self-hosted job key"

# Tamper 38: whitespace before the colon in a job key (valid YAML).
sed 's|^jobs:$|jobs:\n  EVIL_JOB :\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon job key injected" "unexpected self-hosted job key"

# Tamper 39: unquoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  EVIL_JOB: # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "trailing-comment job key injected" "unexpected self-hosted job key"

# Tamper 40: quoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  "EVIL_JOB": # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted trailing-comment job key injected" "unexpected self-hosted job key"

# Tamper 41: local action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: ./scripts/local-action|' "$WF" >"$WORK/tampered.yml"
expect_violation "local action ref" "mutable action ref found"

# Tamper 42: docker action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: docker://alpine:latest|' "$WF" >"$WORK/tampered.yml"
expect_violation "docker action ref" "mutable action ref found"

# Tamper 43: a VALID SHA pin with a trailing YAML comment (the structural
# exact-match class — comments are never stripped).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # comment|' "$WF" >"$WORK/tampered.yml"
expect_violation "SHA pin with trailing comment" "mutable action ref found"

# Tamper 44: quoted-key flow form with a mutable value (`- "uses": …`).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|- "uses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted-key flow form with mutable value" "mutable action ref found"

# Tamper 45: a quoted VALID SHA value (quoted values are rejected raw).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted SHA value" "mutable action ref found"

# Tamper 46: YAML-escaped uses key spelling (`\u0075ses` = `uses`).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|- "\\u0075ses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "escaped uses key spelling" "mutable action ref found"

# Tamper 47: bare uses key with whitespace before the colon.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon bare uses key" "mutable action ref found"

# Tamper 48: quoted uses key with whitespace before the colon.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|- "uses" : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon quoted uses key" "mutable action ref found"

echo "NEGATIVE CONTROL PASS: contract catches all forty-eight drop attempts for the intended reasons"
