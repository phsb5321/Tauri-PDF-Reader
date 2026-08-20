#!/usr/bin/env bash
# One Lectrice policy, called by Pi settlement, Make, Husky, verify.sh and CI.
set -euo pipefail

# Policy, not a caller-controlled tuning knob: environment overrides would let a
# committing process raise the threshold and turn enforcement off.
threshold=3
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

work="$(mktemp -d)"
tmp="$work/changed"
trap 'rm -rf "$work"' EXIT
case "$mode" in
  base)
    git rev-parse --verify --quiet "$base" >/dev/null || { echo "harness-policy: base ref '$base' is unavailable" >&2; exit 2; }
    {
      git diff --name-only --diff-filter=ACMRTDU "$base...HEAD"
      git diff --name-only --diff-filter=ACMRTDU HEAD
      git ls-files --others --exclude-standard
    } >"$tmp"
    ;;
  staged) git diff --cached --name-only --diff-filter=ACMRTDU >"$tmp" ;;
  worktree)
    { git diff --name-only --diff-filter=ACMRTDU HEAD; git ls-files --others --exclude-standard; } >"$tmp"
    ;;
esac
sort -u -o "$tmp" "$tmp"

# lint-staged cannot safely format a partially staged file without either using
# the repository-global stash or risking unstaged hunks. Refuse that ambiguous
# state before lint-staged runs; staging whole files is the recovery path.
git diff --cached --name-only | sort -u >"$work/staged"
git diff --name-only | sort -u >"$work/unstaged"
comm -12 "$work/staged" "$work/unstaged" >"$work/partial"
if [ -s "$work/partial" ]; then
  failures+=("partially staged files are unsafe with the no-stash hook; stage or unstage each whole file: $(tr '\n' ' ' <"$work/partial")")
fi
if git diff --name-only --diff-filter=U | grep -q .; then
  failures+=("unmerged paths are present; resolve the index before running the harness")
fi

changed_count="$(grep -c . "$tmp" || true)"
product_count="$(grep -Ec '^(src/|src-tauri/src/)' "$tmp" || true)"
branch="$(git branch --show-current)"
[ -n "$branch" ] || branch="${GITHUB_HEAD_REF:-}"
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
      if grep -REiq '\[(FEATURE NAME|DATE|BRIEF DESCRIPTION|TASK DESCRIPTION|STORY|NEEDS CLARIFICATION)\]|\$ARGUMENTS|REPLACE THIS' \
          "$spec_dir/spec.md" "$spec_dir/plan.md" "$spec_dir/tasks.md"; then
        failures+=("$spec_dir still contains Spec Kit template/clarification markers")
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
