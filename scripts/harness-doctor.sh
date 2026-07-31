#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  echo "harness-doctor: $*" >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || die "not in a git worktree"
worktree_name=${repo_root##*/}
branch=$(git -C "$repo_root" branch --show-current)

[[ $worktree_name =~ -[0-9]{3}-[a-z0-9-]+$ ]] ||
  die "unsafe worktree '$worktree_name' (expected repository-NNN-slug)"
[[ -n $branch && $branch != main ]] || die "feature branch required"
git -C "$repo_root" rev-parse --verify origin/main^{commit} >/dev/null ||
  die "origin/main is unavailable"

case $(uname -s) in
  Linux) ;;
  *) die "native smoke is currently supported on Linux only" ;;
esac

required_commands=(bash cargo git make nix-shell node pnpm rustc timeout)
for required_command in "${required_commands[@]}"; do
  command -v "$required_command" >/dev/null 2>&1 ||
    die "missing required command: $required_command"
done

if command -v tauri-driver >/dev/null 2>&1; then
  tauri_driver=$(command -v tauri-driver)
elif [[ -x ${CARGO_HOME:-$HOME/.cargo}/bin/tauri-driver ]]; then
  tauri_driver=${CARGO_HOME:-$HOME/.cargo}/bin/tauri-driver
else
  die "tauri-driver is missing from PATH and Cargo bin"
fi

git -C "$repo_root" diff --check

printf 'worktree: %s\n' "$repo_root"
printf 'branch: %s\n' "$branch"
printf 'candidate: %s\n' "$(git -C "$repo_root" rev-parse HEAD)"
printf 'tauri-driver: %s\n' "$tauri_driver"
printf 'platform: %s %s\n' "$(uname -s)" "$(uname -m)"
printf 'doctor: PASS\n'
