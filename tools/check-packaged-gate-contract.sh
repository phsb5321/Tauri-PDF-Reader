#!/usr/bin/env bash
#
# check-packaged-gate-contract.sh — proves the packaged-user-gate workflow
# cannot silently drop the packaged Tauri user gate (the CI1/#123 trust
# contract). Zero-dependency (bash + grep + awk), same discipline as
# tools/alignment-gate.sh.
#
# What "silently drop" means, made mechanical:
#   1. the workflow must trigger on EVERY pull request (no path filter that
#      lets product changes dodge the lane);
#   2. the PR-fast lane must exist and call the repo's own critical-loop
#      runner, which must drive the critical-loop spec;
#   3. no step may be marked continue-on-error (any value — skip-green);
#   4. the PR-fast job may carry no condition other than the PR trigger
#      (an `if: ${{ false }}` must not pass the contract);
#   5. the full tier (all eight lanes) must exist behind schedule + manual
#      dispatch, wired through the serial matrix runner;
#   6. failure evidence must be uploaded (a red lane without artifacts is a
#      lane that can be re-labelled green without proof).
#
# Usage:  tools/check-packaged-gate-contract.sh [path-to-workflow.yml]
#         default: .github/workflows/packaged-user-gate.yml
#
# Exit: 0 = contract holds · 1 = contract violated · 2 = usage error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WF="${1:-$REPO_ROOT/tools/test/fixtures/packaged-user-gate.yml}"

STATUS=0
fail() {
  echo "CONTRACT VIOLATION: $1" >&2
  STATUS=1
}

[ -f "$WF" ] || { echo "CONTRACT VIOLATION: workflow not found: $WF" >&2; exit 1; }

# 1. Gate on every PR.
grep -q '^  pull_request:$' "$WF" || fail "no pull_request trigger"
awk '/^  pull_request:$/ { in_pull=1; next }
     in_pull && /^  [a-z0-9_-]+:$/ { exit }
     in_pull && /^[ \t]+paths(-ignore)?:/ { print }' "$WF" | grep -q . \
  && fail "pull_request is path-filtered — the gate can be silently skipped"

# 2. PR-fast lane → the repo's critical-loop runner → the spec.
awk '/^  pr-fast:$/ { in_job=1; next }
     in_job && /^  [a-z0-9_-]+:$/ { exit }
     in_job { print }' "$WF" | sed 's/#.*//' \
  | grep -qE '^[[:space:]]*bash e2e/run-critical-loop.sh([[:space:]]|$)' \
  || fail "pr-fast job does not run e2e/run-critical-loop.sh"
RUNNER="$REPO_ROOT/e2e/run-critical-loop.sh"
[ -s "$RUNNER" ] || fail "e2e/run-critical-loop.sh missing or empty"
sed 's/#.*//' "$RUNNER" \
  | grep -qE '^[[:space:]]*E2E_SPEC=./e2e/critical-loop.e2e.mjs([[:space:]]|$)' \
  || fail "critical-loop runner does not drive the critical-loop spec"
[ -s "$REPO_ROOT/e2e/critical-loop.e2e.mjs" ] || fail "critical-loop spec missing or empty"

# 3. No skip-green anywhere — the KEY itself is the violation (an expression
#    like `continue-on-error: ${{ true }}` is the bypass of the literal
#    `true`; `false` is noise that can be flipped).
grep -qE '^[[:space:]]*continue-on-error:' "$WF" && fail "continue-on-error found (skip-green)"

# 4. The gate job must be actually runnable AND same-repo-only: its only
#    allowed job-level condition is the PR trigger AND the same-repo guard.
#    `if: ${{ false }}` (or any other condition, or a missing same-repo
#    guard) makes the contract pass while GitHub skips the job or lets a fork
#    PR execute on the self-hosted runner. EVERY job whose condition can be
#    true on a pull_request must carry the same-repo guard.
for job in $(awk '/^  [a-z0-9_-]+:$/ { gsub(":$", ""); print $1 }' "$WF"); do
  JOB_BLOCK="$(awk -v j="$job" '$0 ~ "^  " j ":$" {f=1;next} f && /^  [a-z0-9_-]+:$/ {exit} f' "$WF")"
  JOB_IF="$(printf '%s\n' "$JOB_BLOCK" | sed -n 's/^    if: //p')"
  case "$JOB_IF" in
    *pull_request*)
      # A condition that EXCLUDES pull_request (e.g. `!= 'pull_request'`)
      # cannot run on a PR — no guard needed. Anything else that mentions
      # pull_request must carry the same-repo guard.
      case "$JOB_IF" in
        *"github.event_name != 'pull_request'"*) ;;
        *)
          printf '%s\n' "$JOB_IF" | grep -q 'github.event.pull_request.head.repo.full_name == github.repository' \
            || fail "$job job can run on pull_request without the same-repo guard (fork execution)"
          ;;
      esac
      ;;
  esac
done
# The pr-fast condition must be EXACTLY the PR trigger + same-repo guard.
PRFAST_BLOCK="$(awk '/^  pr-fast:$/ {f=1;next} f && /^  [a-z0-9_-]+:$/ {exit} f' "$WF")"
JOB_IF="$(printf '%s\n' "$PRFAST_BLOCK" | sed -n 's/^    if: //p')"
if [ -n "$JOB_IF" ]; then
  printf '%s\n' "$JOB_IF" | grep -qx 'github.event_name == '\''pull_request'\'' && github.event.pull_request.head.repo.full_name == github.repository' \
    || fail "pr-fast job-level if: is not the PR trigger + same-repo guard — the gate can be skipped or fork-executed"
fi
# The contract job itself must carry the same-repo guard on PRs.
CONTRACT_BLOCK="$(awk '/^  contract:$/ {f=1;next} f && /^  [a-z0-9_-]+:$/ {exit} f' "$WF")"
printf '%s\n' "$CONTRACT_BLOCK" | sed -n 's/^    if: //p' | grep -q 'github.event.pull_request.head.repo.full_name == github.repository' \
  || fail "contract job lacks the same-repo guard"
# Trusted-base architecture: the contract job must check out the BASE tools
# and fetch the HEAD workflow file via the API (the contract cannot be
# head-controlled). Comment-stripped — a comment mentioning base.sha must not
# satisfy the check.
printf '%s\n' "$CONTRACT_BLOCK" | sed 's/#.*//' | grep -q 'contents/.github/workflows/packaged-user-gate.yml' \
  || fail "contract job does not fetch the head workflow file via the API"
printf '%s\n' "$CONTRACT_BLOCK" | sed 's/#.*//' | grep -q 'pull_request.base.sha' \
  || fail "contract job does not pin its checkout to the base sha"
printf '%s\n' "$CONTRACT_BLOCK" | sed 's/#.*//' | grep -q 'gh api "repos/' \
  || fail "contract job does not use gh api to fetch the head file"
# Bootstrap-inert anchor: the contract job must fail when the base does not
# yet own the checker (first-introduction PRs must not self-certify).
printf '%s\n' "$CONTRACT_BLOCK" | grep -q 'BOOTSTRAP-INERT' \
  || fail "contract job lacks the bootstrap-inert anchor check"
# One fixed runner-wide concurrency group — the lane scripts share global
# /tmp paths, so no two runs may ever execute.
grep -qE '^  group: packaged-user-gate$' "$WF" || fail "concurrency group is not the fixed runner-wide packaged-user-gate"
grep -q 'github.ref' <(sed 's/#.*//' "$WF") && fail "concurrency group uses github.ref — fixed group required"
# Self-hosted execution trust: every mutable action ref is forbidden (SHA pins
# only); the repo's own flake pins the toolchain, so no dtolnay@stable either.
grep -qE 'uses: [^ ]+@(v[0-9]+|stable|main|master|latest)([[:space:]]|$)' "$WF" \
  && fail "mutable action ref found — actions must be SHA-pinned"
grep -q 'dtolnay/rust-toolchain' "$WF" && fail "dtolnay rust-toolchain found — the flake pins rust"
# The driver prerequisite is the PINNED devShell: no host provisioning, no
# ~/.cargo/bin hardcode.
grep -q 'cargo/bin/tauri-driver' "$WF" && fail "driver assert hardcodes ~/.cargo/bin — the pinned devShell is the toolchain"
grep -q "nix develop -c bash -c 'command -v tauri-driver'" "$WF" \
  || fail "driver assert does not check command -v tauri-driver inside nix develop"
# A blocked prerequisite must ALWAYS leave its receipt — every job with a
# prerequisite assert must carry the enforcement step.
for job in pr-fast full-matrix real-corpus; do
  BLOCK="$(awk -v j="$job" '$0 ~ "^  " j ":$" {f=1;next} f && /^  [a-z0-9_-]+:$/ {exit} f' "$WF")"
  # The enforcement step must exist, be failure-gated, and actually test the
  # receipt's presence (a name-only or vacuous body does not enforce).
  printf '%s\n' "$BLOCK" | grep -q 'Prerequisite receipt enforced' \
    || fail "$job job lacks the prerequisite-receipt enforcement step"
  ENF="$(printf '%s\n' "$BLOCK" | awk '/- name: Prerequisite receipt enforced/{f=1;next} f && /^      - name:/{exit} f')"
  printf '%s\n' "$ENF" | grep -q 'if: failure()' \
    || fail "$job enforcement step is not failure-gated"
  printf '%s\n' "$ENF" | grep -q 'ci-evidence/prerequisite-failure.json' \
    || fail "$job enforcement step does not test the receipt's presence"
done

# 5. The full tier exists behind schedule + manual dispatch, serial matrix.
grep -q '^  schedule:$' "$WF" || fail "no nightly schedule for the full matrix"
grep -q '^  workflow_dispatch:$' "$WF" || fail "no manual dispatch for the full matrix"
awk '/^  full-matrix:$/ { in_job=1; next }
     in_job && /^  [a-z0-9_-]+:$/ { exit }
     in_job { print }' "$WF" | sed 's/#.*//' \
  | grep -qE '^[[:space:]]*bash scripts/e2e-matrix.sh([[:space:]]|$)' \
  || fail "full-matrix job does not run scripts/e2e-matrix.sh"
MATRIX="${PACKAGED_GATE_MATRIX:-$REPO_ROOT/scripts/e2e-matrix.sh}"
[ -s "$MATRIX" ] || fail "scripts/e2e-matrix.sh missing or empty"
# Every packaged lane must be present — dropping one from the matrix is a
# silent gate drop for that journey.
for lane in critical-loop native-play home open session reader highlight close; do
  grep -qE "^run_lane $lane\\b" "$MATRIX" || fail "matrix does not include the $lane lane"
done
# The matrix must be serial by construction: a single loop, never a parallel
# fan-out. Reject xargs -P / & fan-out patterns that would stampede vm103.
grep -qE 'xargs(\s+-P|\s+--max-procs)|\s&\s*$|parallel\s' "$MATRIX" \
  && fail "matrix script contains a parallel fan-out pattern"

# 6. The real-corpus job must exist, run ONLY on manual dispatch, invoke the
#    corpus runner on an active line, and always upload its evidence (the
#    default success() condition would skip the upload after a prerequisite
#    BLOCKED, leaving the receipt stranded).
CORPUS_BLOCK="$(awk '/^  real-corpus:$/ {f=1;next} f && /^  [a-z0-9_-]+:$/ {exit} f' "$WF")"
[ -n "$CORPUS_BLOCK" ] || fail "real-corpus job missing from the workflow"
CORPUS_JOB_IF="$(printf '%s\n' "$CORPUS_BLOCK" | sed -n 's/^    if: //p')"
printf '%s\n' "$CORPUS_JOB_IF" | grep -qx 'github.event_name == '\''workflow_dispatch'\''' \
  || fail "real-corpus job-level if: is not exactly the workflow_dispatch trigger"
printf '%s\n' "$CORPUS_BLOCK" | sed 's/#.*//' \
  | grep -qE '^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=("[^"]*"|[^ ]*)[[:space:]]+)*bash scripts/e2e-real-corpus\.sh([[:space:]]|$)' \
  || fail "real-corpus job does not run scripts/e2e-real-corpus.sh"
[ -s "$REPO_ROOT/scripts/e2e-real-corpus.sh" ] || fail "scripts/e2e-real-corpus.sh missing or empty"
grep -q 'LECTRICE_REAL_PDF_CORPUS' "$REPO_ROOT/scripts/e2e-real-corpus.sh" \
  || fail "corpus runner does not consume LECTRICE_REAL_PDF_CORPUS"
# The always() guard must be ON THE UPLOAD STEP itself, not merely somewhere
# in the job (a copy-step always() with a success()-guarded upload would
# strand the receipt).
UPLOAD_BLOCK="$(printf '%s\n' "$CORPUS_BLOCK" | awk '/- name: Upload corpus soak evidence/{f=1;next} f && /^      - name:/{exit} f')"
printf '%s\n' "$UPLOAD_BLOCK" | grep -q 'if: always()' \
  || fail "real-corpus evidence upload is not if: always() — a BLOCKED receipt would never upload"

# 7. Failure evidence must be uploaded (SHA-pinned action).
grep -q 'actions/upload-artifact@' "$WF" || fail "no failure-artifact upload"
grep -q 'if: failure()' "$WF" || fail "artifact upload not gated on failure"

exit "$STATUS"
