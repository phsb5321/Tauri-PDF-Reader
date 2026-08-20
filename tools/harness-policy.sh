#!/usr/bin/env bash
# One Lectrice policy, called by Pi settlement, Make, Husky, verify.sh and CI.
set -euo pipefail

threshold="${LECTRICE_SPEC_FILE_THRESHOLD:-3}"
mode=base
base=origin/main
spec_only=0
status_only=0

usage() {
  cat >&2 <<'EOF'
usage: tools/harness-policy.sh [--base REF | --staged | --worktree] [--spec-only] [--status]
EOF
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base) base="${2:?--base needs a ref}"; mode=base; shift 2 ;;
    --staged) mode=staged; shift ;;
    --worktree) mode=worktree; shift ;;
    --spec-only) spec_only=1; shift ;;
    --status) status_only=1; shift ;;
    *) usage ;;
  esac
done

case "$threshold" in
  ''|*[!0-9]*) echo "harness-policy: LECTRICE_SPEC_FILE_THRESHOLD must be an integer >= 1" >&2; exit 2 ;;
esac
[ "$threshold" -ge 1 ] || { echo "harness-policy: threshold must be >= 1" >&2; exit 2; }

git rev-parse --show-toplevel >/dev/null 2>&1 || { echo "harness-policy: not a Git repository" >&2; exit 2; }
root="$(git rev-parse --show-toplevel)"
cd "$root"

failures=()
if [ "$spec_only" -eq 0 ] && [ -n "${PI_SESSION_ID:-}${PI_AGENT_NAME:-}" ]; then
  if ! command -v pi >/dev/null 2>&1; then
    failures+=("agent seat detected but pi is unavailable; cannot read its durable goal")
  elif ! pi goal status >/dev/null 2>&1; then
    failures+=("this agent seat has no durable goal; run: pi goal set \"<measurable outcome>\"")
  fi
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
case "$mode" in
  base)
    git rev-parse --verify --quiet "$base" >/dev/null || { echo "harness-policy: base ref '$base' is unavailable" >&2; exit 2; }
    {
      git diff --name-only --diff-filter=ACMRT "$base...HEAD"
      git diff --name-only --diff-filter=ACMRT HEAD
      git ls-files --others --exclude-standard
    } >"$tmp"
    ;;
  staged) git diff --cached --name-only --diff-filter=ACMRT >"$tmp" ;;
  worktree)
    { git diff --name-only --diff-filter=ACMRT HEAD; git ls-files --others --exclude-standard; } >"$tmp"
    ;;
esac
sort -u -o "$tmp" "$tmp"

changed_count="$(grep -c . "$tmp" || true)"
product_count="$(grep -Ec '^(src/|src-tauri/src/)' "$tmp" || true)"
branch="${PI_SPEC_FEATURE:-${GITHUB_HEAD_REF:-$(git branch --show-current)}}"
feature="${branch##*/}"
spec_dir="specs/$feature"
required=(spec.md plan.md tasks.md)
missing=()

if [ "$product_count" -gt 0 ] && [ "$changed_count" -ge "$threshold" ]; then
  if ! printf '%s' "$feature" | grep -Eq '^[0-9]{3}-[a-z0-9][a-z0-9-]*$'; then
    failures+=("broad product change is on branch '$branch'; use a Spec Kit feature branch NNN-slug")
  else
    for artifact in "${required[@]}"; do
      [ -s "$spec_dir/$artifact" ] || missing+=("$artifact")
    done
    if [ "${#missing[@]}" -gt 0 ]; then
      failures+=("broad product change needs the complete branch-bound chain in $spec_dir (missing: ${missing[*]}); run /speckit.specify -> /speckit.plan -> /speckit.tasks")
    else
      grep -Fq '## User Scenarios & Testing' "$spec_dir/spec.md" || failures+=("$spec_dir/spec.md is not a completed Spec Kit specification")
      grep -Fq '## Technical Context' "$spec_dir/plan.md" || failures+=("$spec_dir/plan.md is not a completed Spec Kit plan")
      grep -Eq '^- \[[ xX]\] T[0-9]+' "$spec_dir/tasks.md" || failures+=("$spec_dir/tasks.md has no executable Txxx tasks")
      if grep -Rqs '\[NEEDS CLARIFICATION\]' "$spec_dir/spec.md" "$spec_dir/plan.md" "$spec_dir/tasks.md"; then
        failures+=("$spec_dir still contains [NEEDS CLARIFICATION]")
      fi
    fi
  fi
fi

printf 'harness-policy: mode=%s changed=%s product=%s threshold=%s branch=%s\n' \
  "$mode" "$changed_count" "$product_count" "$threshold" "${branch:-DETACHED}"

if [ "${#failures[@]}" -gt 0 ]; then
  printf 'harness-policy: REFUSED\n' >&2
  printf '  - %s\n' "${failures[@]}" >&2
  exit 1
fi

if [ "$status_only" -eq 1 ]; then
  if [ "$product_count" -gt 0 ] && [ "$changed_count" -ge "$threshold" ]; then
    printf 'harness-policy: spec=%s (complete)\n' "$spec_dir"
  else
    printf 'harness-policy: targeted/spec-less path (below threshold or no product code)\n'
  fi
fi
printf 'harness-policy: PASS\n'
