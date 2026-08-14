#!/usr/bin/env bash
#
# Negative-control test for the packaged-gate contract — proves the contract
# CATCHES a silently-dropped gate, not just that it PASSES on the shipped
# workflow (PR#595 parity). Runs against the REAL-YAML-parser checker
# (tools/check-packaged-gate-contract.sh → .mjs).
#
# Each tamper mutates a throwaway copy of the workflow and asserts the
# contract fails for the INTENDED reason; a positive control asserts a
# no-false-positive case passes.
set -euo pipefail
CONTRACT="$(dirname "$0")/../check-packaged-gate-contract.sh"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Baseline workflow file: env-overridable so the CI contract job can point it
# at the fetched head file; default = the repo's own fixture.
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

expect_clean() {
  local desc="$1"
  if "$CONTRACT" "$WORK/clean.yml" >/dev/null 2>&1; then
    echo "clean ($desc): passes — no false positive"
  else
    echo "NEGATIVE CONTROL FAILED: false positive on $desc" >&2
    exit 1
  fi
}

# Baseline: the shipped workflow must PASS the contract.
"$CONTRACT" "$WF" >/dev/null || {
  echo "NEGATIVE CONTROL FAILED: shipped workflow violates the contract" >&2
  exit 1
}
echo "baseline: shipped workflow passes"

# ── Lane / invocation tamper classes ─────────────────────────────────────────
# Tamper 1: remove the lane invocation from the PR-fast job.
sed 's|bash e2e/run-critical-loop.sh|# (lane removed)|' "$WF" >"$WORK/tampered.yml"
expect_violation "PR-fast lane removed" "pr-fast lane step run is not the exact canonical command"

# Tamper 2: skip-green on the lane step (literal) — a STEP-level key, not
# text inside the run block (the parser must see continueOnError).
sed '/^      - name: Packaged PR-fast lane/a\        continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (literal true) added" "continue-on-error found (skip-green)"

# Tamper 3: skip-green via expression.
sed '/^      - name: Packaged PR-fast lane/a\        continue-on-error: ${{ true }}' "$WF" >"$WORK/tampered.yml"
expect_violation "continue-on-error (expression) added" "continue-on-error found (skip-green)"

# Tamper 4: path-filter the pull_request trigger.
sed 's|^  pull_request:$|  pull_request:\n    paths: ["src/**"]|' "$WF" >"$WORK/tampered.yml"
expect_violation "pull_request path filter added" "pull_request is path-filtered"

# Tamper 5: make the PR-fast job conditionally skipped (and drop the
# same-repo guard at the same time).
sed "s|^    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if: falsified" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 6: drop a lane from the serial matrix (via the path override).
cp "$WF" "$WORK/tampered.yml"
sed 's|^run_lane reader|# run_lane reader|' "$REPO_ROOT/scripts/e2e-matrix.sh" >"$WORK/matrix-tampered.sh"
PACKAGED_GATE_MATRIX="$WORK/matrix-tampered.sh" expect_violation "matrix lane dropped" "matrix does not include the reader lane"

# Tamper 7: shell-comment the lane invocation inside the run block.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          # bash e2e/run-critical-loop.sh (disabled)@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation shell-commented" "pr-fast lane step run is not the exact canonical command"

# Tamper 8: inline-comment no-op carrying the invocation substring.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          : # bash e2e/run-critical-loop.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to inline-comment no-op" "pr-fast lane step run is not the exact canonical command"

# Tamper 9: colon no-op taking the invocation as its argument.
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          : bash e2e/run-critical-loop.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation reduced to colon no-op" "pr-fast lane step run is not the exact canonical command"

# Tamper 10: falsify the real-corpus job condition.
sed "s|^    if: github.event_name == 'workflow_dispatch'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus job condition falsified" "real-corpus job-level if: is not exactly the workflow_dispatch trigger"

# Tamper 11: remove the corpus evidence upload's always-run guard.
cp "$WF" "$WORK/tampered.yml"
sed 's|if: always()|if: success()|' "$WORK/tampered.yml" >"$WORK/tampered2.yml" && mv "$WORK/tampered2.yml" "$WORK/tampered.yml"
expect_violation "real-corpus upload loses always()" "real-corpus evidence upload is not if: always()"

# Tamper 12: colon no-op on the corpus invocation.
sed 's@^        run: LECTRICE_CORPUS_OUT="[^"]*" bash scripts/e2e-real-corpus.sh$@        run: |\n          LECTRICE_CORPUS_OUT="$RUNNER_TEMP/lectrice-corpus" : bash scripts/e2e-real-corpus.sh@' "$WF" >"$WORK/tampered.yml"
expect_violation "real-corpus invocation reduced to colon no-op" "real-corpus lane step run is not the exact canonical command"

# ── Job-set / condition tamper classes ───────────────────────────────────────
# Tamper 13: same-repo guard removed from pr-fast.
sed "s| && github.event.pull_request.head.repo.full_name == github.repository$||" "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast same-repo guard removed" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 19: full-matrix allowed to run on pull_request.
sed "s|^    if: github.event_name != 'pull_request'$|    if: github.event_name == 'pull_request'|" "$WF" >"$WORK/tampered.yml"
expect_violation "unguarded job can run on pull_request" "full-matrix job-level if: is not the exact canonical condition"

# Tamper 25: pr-fast loses its job-level if entirely.
sed '/^    if: github.event_name == '\''pull_request'\'' && github.event.pull_request.head.repo.full_name == github.repository$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "pr-fast job-level if deleted" "pr-fast job-level if: is not the PR trigger + same-repo guard"

# Tamper 26: full-matrix loses its job-level if.
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix job-level if deleted" "full-matrix job has no job-level if"

# Tamper 27: contract if replaced with a bare pull_request exclusion.
sed "s@^    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository\$@    if: github.event_name != 'pull_request'@" "$WF" >"$WORK/tampered.yml"
expect_violation "contract if replaced with bare exclusion" "contract job-level if: is not the exact canonical guard"

# Tamper 28: contract if deleted entirely.
sed "/^    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository\$/d" "$WF" >"$WORK/tampered.yml"
expect_violation "contract job-level if deleted" "contract job has no job-level if"

# Tamper 29: full-matrix if replaced with false.
sed "s|^    if: github.event_name != 'pull_request'$|    if: \${{ false }}|" "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix if falsified" "full-matrix job-level if: is not the exact canonical condition"

# Tamper 30: full-matrix if deleted (deletion NC for the exact-condition rule).
sed '/^    if: github.event_name != '\''pull_request'\''$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "full-matrix job-level if deleted (exact)" "full-matrix job has no job-level if"

# Tamper 31: an uppercase job ID injected (closed job set).
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "uppercase unguarded job injected" "unexpected self-hosted job set"

# Tamper 33: a condition-gamed new job.
sed 's|^jobs:$|jobs:\n  EVIL_JOB:\n    if: github.event_name != '\''pull_request'\'' \|\| github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "condition-gamed job injected" "unexpected self-hosted job set"

# Tamper 36: quoted job ID injected.
sed 's|^jobs:$|jobs:\n  "EVIL_JOB":\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted job ID injected" "unexpected self-hosted job set"

# Tamper 37: single-quoted job ID injected.
sed 's|^jobs:$|jobs:\n  '\''EVIL_JOB'\'':\n    if: github.event_name == '\''pull_request'\''\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted job ID injected" "unexpected self-hosted job set"

# Tamper 38: whitespace before the colon in a job key.
sed 's|^jobs:$|jobs:\n  EVIL_JOB :\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon job key injected" "unexpected self-hosted job set"

# Tamper 39: unquoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  EVIL_JOB: # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "trailing-comment job key injected" "unexpected self-hosted job set"

# Tamper 40: quoted job key with a trailing YAML comment.
sed 's|^jobs:$|jobs:\n  "EVIL_JOB": # comment\n    runs-on: [self-hosted, Linux, X64, vm103]\n    steps:\n      - run: echo exposed|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted trailing-comment job key injected" "unexpected self-hosted job set"

# ── Mutable action ref classes (all YAML spellings normalize to the same
#    parsed value — the parser is the fix, the tamper list is the proof) ─────
# Tamper 14: mutable action ref reintroduced.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref reintroduced" "mutable action ref found"

# Tamper 23: quoted mutable action ref.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: "actions/checkout@v4"|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted mutable action ref" "mutable action ref found"

# Tamper 32: single-quoted mutable action ref.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: '\''actions/checkout@v4'\''|' "$WF" >"$WORK/tampered.yml"
expect_violation "single-quoted mutable action ref" "mutable action ref found"

# Tamper 35: mutable ref with a trailing YAML comment.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: actions/checkout@v4 # mutable|' "$WF" >"$WORK/tampered.yml"
expect_violation "mutable action ref with trailing comment" "mutable action ref found"

# Tamper 41: local action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: ./scripts/local-action|' "$WF" >"$WORK/tampered.yml"
expect_violation "local action ref" "mutable action ref found"

# Tamper 42: docker action (no-@ form).
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses: docker://alpine:latest|' "$WF" >"$WORK/tampered.yml"
expect_violation "docker action ref" "mutable action ref found"

# Tamper 44: quoted-key flow form with a mutable value.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "uses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted-key flow form with mutable value" "mutable action ref found"

# Tamper 46: YAML-escaped uses key spelling.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "\\u0075ses": actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "escaped uses key spelling" "mutable action ref found"

# Tamper 47: bare uses key with whitespace before the colon.
sed 's|uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262|uses : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon bare uses key" "mutable action ref found"

# Tamper 48: quoted uses key with whitespace before the colon.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - "uses" : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "whitespace-colon quoted uses key" "mutable action ref found"

# Tamper 49: flow mapping form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - { uses: actions/checkout@v4 }|' "$WF" >"$WORK/tampered.yml"
expect_violation "flow mapping uses" "mutable action ref found"

# Tamper 50: quoted-key flow mapping form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - { "uses": actions/checkout@v4 }|' "$WF" >"$WORK/tampered.yml"
expect_violation "quoted-key flow mapping uses" "mutable action ref found"

# Tamper 51: explicit-key form.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - ? uses\n        : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "explicit-key uses" "mutable action ref found"

# Tamper 52: block-scalar explicit key (folded >-) — the reviewer's BLOCKER #7.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - ? >-\n          uses\n        : actions/checkout@v4|' "$WF" >"$WORK/tampered.yml"
expect_violation "block-scalar explicit key (>-)" "mutable action ref found"

# Tamper 53: block-scalar explicit key (literal |-).
sed 's;^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$;      - ? |-\n          uses\n        : actions/checkout@v4;' "$WF" >"$WORK/tampered.yml"
expect_violation "block-scalar explicit key (|-)" "mutable action ref found"

# Tamper 54: anchors/aliases carrying a mutable value.
sed 's|^      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262$|      - uses: \&mutable actions/checkout@v4\n      - uses: *mutable|' "$WF" >"$WORK/tampered.yml"
expect_violation "anchor/alias mutable ref" "YAML anchors/aliases/merge keys are not permitted"

# Tamper 55: multi-document workflow (fail-closed).
cp "$WF" "$WORK/tampered.yml"
printf '\n---\nother: 1\n' >>"$WORK/tampered.yml"
expect_violation "multi-document workflow" "expected exactly one YAML document"

# ── Trusted-base / receipts / concurrency classes ────────────────────────────
# Tamper 16: the prerequisite-receipt enforcement step is removed.
sed '/Prerequisite receipt enforced/,+3d' "$WF" >"$WORK/tampered.yml"
expect_violation "receipt enforcement step removed" "lacks the prerequisite-receipt enforcement step"

# Tamper 17: the contract job stops fetching the head file.
sed '/gh api "repos\//d' "$WF" >"$WORK/tampered.yml"
expect_violation "contract head-fetch removed" "contract job does not fetch the head workflow file"

# Tamper 18: concurrency group back to per-ref.
sed 's|^  group: packaged-user-gate$|  group: packaged-user-gate-${{ github.ref }}|' "$WF" >"$WORK/tampered.yml"
expect_violation "concurrency group per-ref reintroduced" "concurrency group is not the fixed runner-wide packaged-user-gate"

# Tamper 20: base.sha reduced to a comment (checkout loads head tools).
sed 's|github.event.pull_request.base.sha|github.event.pull_request.head.sha # base.sha|' "$WF" >"$WORK/tampered.yml"
expect_violation "base-sha checkout reduced to a comment" "contract job does not pin its checkout to the base sha"

# Tamper 21: the enforcement step body stops testing the receipt.
sed 's|\[ -f ci-evidence/prerequisite-failure.json \]|true|' "$WF" >"$WORK/tampered.yml"
expect_violation "enforcement step body vacuous" "enforcement step does not test the receipt's presence"

# Tamper 22: the bootstrap-inert anchor is removed.
sed '/BOOTSTRAP-INERT/d' "$WF" >"$WORK/tampered.yml"
expect_violation "bootstrap-inert anchor removed" "contract job lacks the bootstrap-inert anchor check"

# Tamper 24: the lane invocation moved into an env value with a no-op run.
sed -e 's|^        run: bash e2e/run-critical-loop.sh$|        run: true|' \
    -e 's|^      - name: Packaged PR-fast lane|      - name: Packaged PR-fast lane\n        env:\n          BURY: bash e2e/run-critical-loop.sh|' \
    "$WF" >"$WORK/tampered.yml"
expect_violation "lane invocation buried in an env value" "pr-fast lane step run is not the exact canonical command"

# ── B1/B2/M1-merge/M2 classes ─────────────────────────────────────────────────
# Tamper 56: step-level if: false on the PR-fast lane step (skips the gate).
sed '/^      - name: Packaged PR-fast lane/a\        if: false' "$WF" >"$WORK/tampered.yml"
expect_violation "step-level if: false on the lane step" "step-level if: not permitted"

# Tamper 57: step-level if: false on the driver assertion.
sed '/^      - name: Assert tauri-driver inside the PINNED flake devShell/a\        if: false' "$WF" >"$WORK/tampered.yml"
expect_violation "step-level if: false on the driver assertion" "step-level if: not permitted"

# Tamper 58: needs: contract deleted from pr-fast (head code runs when the
# base contract fails).
sed '/^    needs: contract$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "needs: contract deleted" "does not require needs: contract"

# Tamper 59: merge key present (M1 presence rejection).
sed 's|^jobs:$|jobs:\n  <<: &merge_jobs {}\n  |' "$WF" >"$WORK/tampered.yml"
expect_violation "merge key present" "YAML anchors/aliases/merge keys are not permitted"

# Tamper 60: runs-on widened away from the exact vm103 label set.
sed 's|runs-on: \[self-hosted, Linux, X64, vm103\]|runs-on: [self-hosted, Linux, X64]|' "$WF" >"$WORK/tampered.yml"
expect_violation "runs-on widened to self-hosted" "runs-on is not the exact vm103 label set"

# Tamper 61: permissions widened to contents: write.
sed 's|^permissions:$|permissions:\n  contents: write|; /^  contents: read$/d' "$WF" >"$WORK/tampered.yml"
expect_violation "permissions widened to contents: write" "permissions must be exactly contents: read"

# Tamper 62: lane run gains a `|| true` operator (skip-green suffix).
sed 's@bash e2e/run-critical-loop.sh$@bash e2e/run-critical-loop.sh || true@' "$WF" >"$WORK/tampered.yml"
expect_violation "lane run with || true suffix" "pr-fast lane step run is not the exact canonical command"

# Tamper 63: job-level continue-on-error on pr-fast.
sed '/^  pr-fast:$/a\    continue-on-error: true' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level continue-on-error" "continue-on-error found (skip-green)"

# Tamper 64: job-local permissions block overrides the global.
sed '/^  pr-fast:$/a\    permissions:\n      contents: write' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level permissions block" "job-level permissions are not permitted"

# Tamper 65: multi-command pr-fast lane run (set +e; …; true).
sed 's@^        run: bash e2e/run-critical-loop.sh$@        run: |\n          set +e\n          bash e2e/run-critical-loop.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command pr-fast lane run" "pr-fast lane step run is not the exact canonical command"

# Tamper 66: multi-command full-matrix lane run.
sed 's@^        run: bash scripts/e2e-matrix.sh$@        run: |\n          set +e\n          bash scripts/e2e-matrix.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command full-matrix lane run" "full-matrix lane step run is not the exact canonical command"

# Tamper 67: multi-command real-corpus lane run.
sed 's@^        run: LECTRICE_CORPUS_OUT="\$RUNNER_TEMP/lectrice-corpus" bash scripts/e2e-real-corpus.sh$@        run: |\n          set +e\n          LECTRICE_CORPUS_OUT="$RUNNER_TEMP/lectrice-corpus" bash scripts/e2e-real-corpus.sh\n          true@' "$WF" >"$WORK/tampered.yml"
expect_violation "multi-command real-corpus lane run" "real-corpus lane step run is not the exact canonical command"

# Tamper 68: shell override on the pr-fast lane step.
sed '/^      - name: Packaged PR-fast lane/a\        shell: bash' "$WF" >"$WORK/tampered.yml"
expect_violation "lane step shell override" "lane step shell override is not permitted"

# Tamper 69: workflow-level defaults.run.shell override.
sed 's|^permissions:$|defaults:\n  run:\n    shell: bash -c '"'"'exit 0'"'"' {0}\npermissions:|' "$WF" >"$WORK/tampered.yml"
expect_violation "workflow-level defaults.run.shell" "workflow-level defaults are not permitted"

# Tamper 70: job-level defaults.run.shell on pr-fast.
sed '/^  pr-fast:$/a\    defaults:\n      run:\n        shell: bash -c '"'"'exit 0'"'"' {0}' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level defaults.run.shell" "job-level defaults are not permitted"

# Tamper 71: workflow env gains BASH_ENV.
sed 's|^env:$|env:\n  BASH_ENV: /tmp/evil|' "$WF" >"$WORK/tampered.yml"
expect_violation "workflow env BASH_ENV injection" "workflow env is not the exact pinned map"

# Tamper 72: job-level env on pr-fast.
sed '/^  pr-fast:$/a\    env:\n      BASH_ENV: /tmp/evil' "$WF" >"$WORK/tampered.yml"
expect_violation "job-level env BASH_ENV injection" "job-level env is not permitted"

# Tamper 73: lane-step env with BASH_ENV.
sed '/^      - name: Packaged PR-fast lane/a\        env:\n          BASH_ENV: /tmp/evil' "$WF" >"$WORK/tampered.yml"
expect_violation "lane-step env BASH_ENV injection" "step-level env is not permitted"

# Tamper 74: unexpected env at an allowed contract step (extra key).
sed 's|GH_TOKEN: \${{ github.token }}|GH_TOKEN: \${{ github.token }}\n          PATH: /tmp/evil|' "$WF" >"$WORK/tampered.yml"
expect_violation "unexpected env key at allowed step" "step-level env is not permitted"

# ── Positive control (no-false-positive class) ───────────────────────────────
python3 - "$WF" "$WORK/clean.yml" <<'PY'
import sys
s = open(sys.argv[1]).read()
s = s.replace(
    '      - name: Install dependencies\n        run: pnpm install --frozen-lockfile',
    '      - name: Install dependencies\n        run: pnpm install --frozen-lockfile\n\n      - name: no-false-positive probe\n        run: |-\n          echo \'{"uses": "actions/checkout@v4"}\'\n\n      - name: indentation-indicator probe\n        run: |2-\n          echo \'{"uses": "actions/checkout@v4"}\'',
)
open(sys.argv[2], 'w').write(s)
PY
expect_clean "run:|- and run:|2- bodies with quoted keys"

echo "NEGATIVE CONTROL PASS: contract catches all violation classes + one positive control, for the intended reasons"
