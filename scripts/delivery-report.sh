#!/usr/bin/env bash
set -Eeuo pipefail

base_ref=${1:-origin/main}
repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "delivery-report: run inside a git worktree" >&2
  exit 2
}
artifact_dir="$repo_root/.artifacts"
report_path="$artifact_dir/delivery-report.md"
candidate_sha=$(git -C "$repo_root" rev-parse HEAD)
branch=$(git -C "$repo_root" branch --show-current)
required_gates=(
  doctor
  verify
  alignment
  alignment-negative
  frontend-build
  coverage
  type-coverage
  smoke-reader
  adversarial-review
)

[[ -z $(git -C "$repo_root" status --porcelain=v1) ]] || {
  echo "delivery-report: candidate worktree is not clean" >&2
  exit 2
}

for gate_name in "${required_gates[@]}"; do
  status_path="$artifact_dir/$gate_name.status"
  log_path="$artifact_dir/$gate_name.log"
  [[ -f $status_path && -f $log_path ]] || {
    echo "delivery-report: missing evidence for $gate_name" >&2
    exit 1
  }
  exit_code=$(awk -F= '$1 == "exit_code" { print $2 }' "$status_path")
  evidence_sha=$(awk -F= '$1 == "candidate_sha" { print $2 }' "$status_path")
  [[ $exit_code == 0 ]] || {
    echo "delivery-report: gate $gate_name exited $exit_code" >&2
    exit 1
  }
  [[ $evidence_sha == "$candidate_sha" ]] || {
    echo "delivery-report: stale $gate_name evidence for $evidence_sha" >&2
    exit 1
  }
done

"$repo_root/tools/adversarial-verdict.sh" \
  "$artifact_dir/adversarial-review.raw.txt" >/dev/null

generated_at=$(date '+%d/%m/%Y %H:%M:%S %Z')
{
  printf '# Lectrice delivery evidence\n\n'
  printf -- '- Generated: %s\n' "$generated_at"
  printf -- '- Branch: `%s`\n' "$branch"
  printf -- '- Candidate: `%s`\n' "$candidate_sha"
  printf -- '- Base: `%s`\n\n' "$base_ref"
  printf '## Gates\n\n'
  printf '| Gate | Exit | Log SHA-256 |\n'
  printf '|---|---:|---|\n'
  for gate_name in "${required_gates[@]}"; do
    log_hash=$(sha256sum "$artifact_dir/$gate_name.log" | awk '{ print $1 }')
    printf '| `%s` | 0 | `%s` |\n' "$gate_name" "$log_hash"
  done
  printf '\n## Product smoke\n\n'
  printf '%s\n' \
    '- Built Tauri app opened the scoped fixture through local-file/PDF.js and library persistence.' \
    '- Visible controls exercised speech marks/highlighting, pause/resume/stop, page seek, restart restore, and accessible error recovery.' \
    '- Fixture mode made no provider call and required no audio device.'
  printf '\n## Adversarial review\n\n'
  printf -- '- Reviewer: `groq/qwen/qwen3.6-27b` (different family)\n'
  printf -- '- Verdict: `PASS`\n'
  printf -- '- Raw output: `adversarial-review.raw.txt`\n'
  printf '\n## Deliberate deferrals\n\n'
  printf '%s\n' \
    '- Audio-timeline seek needs a dedicated product specification; this slice proves page-position seek.' \
    '- Audible voice quality remains a bounded human check.' \
    '- Kernel network isolation is unavailable while preserving loopback in this sandbox; the fixture itself is network-independent.' \
    '- New SCA/fuzz/mutation frameworks await a measured target and planted fault.'
  printf '\n## Reproduction\n\n'
  printf '```bash\nmake verify\nmake verify-full\nmake gate\n```\n\n'
  printf 'Revert after merge: `git revert <squash-merge-sha>` in a new PR.\n'
} >"$report_path"

printf 'delivery-report: %s\n' "$report_path"
