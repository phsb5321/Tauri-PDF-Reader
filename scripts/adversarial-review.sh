#!/usr/bin/env bash
set -Eeuo pipefail

base_ref=${1:-origin/main}
repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "adversarial-review: run inside a git worktree" >&2
  exit 2
}
artifact_dir="$repo_root/.artifacts"
raw_output="$artifact_dir/adversarial-review.raw.txt"
candidate_sha=$(git -C "$repo_root" rev-parse HEAD)

command -v opencode >/dev/null 2>&1 || {
  echo "adversarial-review: opencode is required" >&2
  exit 2
}
git -C "$repo_root" rev-parse --verify "$base_ref^{commit}" >/dev/null ||
  {
    echo "adversarial-review: invalid base ref: $base_ref" >&2
    exit 2
  }
git -C "$repo_root" diff --quiet "$base_ref...HEAD" &&
  {
    echo "adversarial-review: candidate diff is empty" >&2
    exit 2
  }
[[ -z $(git -C "$repo_root" status --porcelain=v1) ]] ||
  {
    echo "adversarial-review: commit the candidate before review" >&2
    exit 2
  }

review_dir=$(mktemp -d)
cleanup() {
  rm -rf "$review_dir"
}
trap cleanup EXIT HUP INT TERM

instructions_path="$review_dir/instructions.md"
diff_path="$review_dir/candidate.diff"
cat >"$instructions_path" <<EOF
# Lectrice delivery-harness adversarial review

Candidate SHA: $candidate_sha
Base: $base_ref

Review the attached committed diff against Spec 053. Focus on medium-or-higher:
false-green gates, shell failure propagation, stale evidence, process cleanup,
production-path bypasses, fixture leakage into release builds, accessibility,
security/scope widening, and tests that do not prove their stated boundary.

No repository tools or external context are needed. Do not suggest unrelated
refactors. The first nonblank output line must be exactly PASS or BLOCK.
EOF
git -C "$repo_root" diff --no-ext-diff --binary "$base_ref...HEAD" >"$diff_path"

secret_pattern='(api[_-]?key|authorization|bearer)[[:space:]]*[:=][[:space:]]*[[:alnum:]_./+-]{16,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY'
if rg -n -i "$secret_pattern" "$instructions_path" "$diff_path"; then
  echo "adversarial-review: attachment may contain a secret" >&2
  exit 2
fi

mkdir -p "$artifact_dir"
review_prompt='All review inputs are attached; do not call tools. READ ONLY. Return PASS or BLOCK first, then only medium-or-higher findings with severity, file:line, evidence, impact, and smallest correction. If PASS, list residual uncertainties only.'

set +e
env OPENCODE_CONFIG_CONTENT='{"instructions":[],"mcp":{},"skills":{"paths":[],"urls":[]},"plugin":[],"provider":{"groq":{"models":{"qwen/qwen3.6-27b":{"limit":{"context":131072,"output":16384}}}}}}' \
  opencode run \
  "$review_prompt" \
  --pure --agent plan --model groq/qwen/qwen3.6-27b --format default \
  -f "$instructions_path" "$diff_path" |
  tee "$raw_output"
review_status=${PIPESTATUS[0]}
set -e

if ((review_status != 0)); then
  echo "adversarial-review: opencode failed with exit $review_status" >&2
  exit "$review_status"
fi

"$repo_root/tools/adversarial-verdict.sh" "$raw_output"
