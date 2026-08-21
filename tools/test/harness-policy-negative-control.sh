#!/usr/bin/env bash
# Hermetic falsifier: committed broad work cannot pass on no/partial spec evidence.
set -euo pipefail

subject="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/tools/harness-policy.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q -b main
git config user.email harness@example.invalid
git config user.name harness-negative-control
git config core.hooksPath /dev/null
# Keep captured evidence under .git so the untracked-file detector cannot make
# the negative control change its own measured file count.
output="$tmp/.git/harness-output"
mkdir -p src
echo base >README.md
git add README.md
git commit -qm base
git branch -M main

git checkout -qb 080-targeted-control
printf 'a\n' >src/a.ts
printf 'b\n' >src/b.ts
git add src
git commit -qm 'targeted product change'
"$subject" --base main --spec-only >"$output" 2>&1
grep -q 'harness-policy: PASS' "$output"

printf 'staged\n' >>src/a.ts
git add src/a.ts
printf 'unstaged\n' >>src/a.ts
if "$subject" --base main --spec-only >"$output" 2>&1; then
  echo "negative-control: FAIL — partially staged file passed" >&2
  exit 1
fi
grep -q 'partially staged files are unsafe' "$output"
grep -q 'unstaged' src/a.ts
git restore --staged --worktree src/a.ts

git checkout -q main
git checkout -qb 080-negative-control
rm -rf src
mkdir -p src
printf 'a\n' >src/a.ts
printf 'b\n' >src/b.ts
printf 'c\n' >src/c.ts
git add src
git commit -qm 'broad product change without spec'

if "$subject" --base main --spec-only >"$output" 2>&1; then
  echo "negative-control: FAIL — no-spec branch passed" >&2
  exit 1
fi
grep -q 'complete branch-bound chain' "$output"

mkdir -p specs/080-negative-control
printf '# partial\n## User Scenarios & Testing\n' >specs/080-negative-control/spec.md
printf '# partial\n## Technical Context\n' >specs/080-negative-control/plan.md
if "$subject" --base main --spec-only >"$output" 2>&1; then
  echo "negative-control: FAIL — partial chain passed" >&2
  exit 1
fi
grep -q 'missing: tasks.md' "$output"

printf '# Tasks\n- [ ] T001 Prove the gate\n' >specs/080-negative-control/tasks.md
"$subject" --base main --spec-only >"$output" 2>&1
grep -q 'harness-policy: PASS' "$output"

git checkout -q --orphan 080-unrelated-control
git rm -qrf .
mkdir -p src
printf 'a\n' >src/a.ts
printf 'b\n' >src/b.ts
printf 'c\n' >src/c.ts
git add src
git commit -qm 'unrelated broad product change'
if "$subject" --base main --spec-only >"$output" 2>&1; then
  echo "negative-control: FAIL — unrelated-history product change passed" >&2
  exit 1
fi
grep -q 'complete branch-bound chain' "$output"

echo 'negative-control: PASS — targeted allowed; partial-stage refused without loss; no/partial/unrelated spec refused; complete chain allowed'
