#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "clean-artifacts: run inside a git worktree" >&2
  exit 2
}
artifact_dir="$repo_root/.artifacts"

case $artifact_dir in
  "$repo_root/.artifacts") ;;
  *)
    echo "clean-artifacts: refused unexpected path: $artifact_dir" >&2
    exit 2
    ;;
esac

if [[ -d $artifact_dir ]]; then
  find "$artifact_dir" -mindepth 1 -maxdepth 1 -delete
fi
echo "clean-artifacts: generated evidence removed"
