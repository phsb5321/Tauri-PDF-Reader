#!/usr/bin/env bash
#
# Refuse to merge a PR whose head is not the branch tip you meant to ship.
#
# The scar (PR #72, 04/08/2026): the branch's real tip carried a repair that
# closed a verified accessibility MAJOR, but that commit was never pushed. The
# PR still showed seven green checks — against the commit BEFORE it. Squashing
# it landed the slice with the defect still open and unreferenced the repair.
#
# `gh pr view` reports the REMOTE head. A green check set says nothing about a
# local commit that never left the machine. This script is that sentence made
# mechanical.
#
# Usage:
#   scripts/pre-merge-head-check.sh <pr-number>          # check before merging
#   scripts/pre-merge-head-check.sh --compare <a> <b>    # pure comparison (tested)
#
# Exit codes:
#   0  heads agree — safe to merge
#   1  heads disagree — DO NOT MERGE, you have unpushed work
#   2  usage error, or a head could not be determined

set -euo pipefail

# Pure core, kept separate so it is testable without gh, network, or a repo.
compare_heads() {
  local local_head="${1-}" remote_head="${2-}"

  if [[ -z "$local_head" || -z "$remote_head" ]]; then
    echo "pre-merge-head-check: a head is empty (local='$local_head' remote='$remote_head')" >&2
    return 2
  fi

  if [[ "$local_head" != "$remote_head" ]]; then
    cat >&2 <<EOF
pre-merge-head-check: REFUSING — heads disagree.
  local branch tip : $local_head
  PR head (remote) : $remote_head

The PR's checks ran against the remote head. Whatever is in the local tip and
not in the remote head is NOT covered by them, and merging now silently drops it.

Push the branch, wait for checks on the new head, then merge.
EOF
    return 1
  fi

  echo "pre-merge-head-check: OK — $local_head"
  return 0
}

main() {
  if [[ "${1-}" == "--compare" ]]; then
    compare_heads "${2-}" "${3-}"
    return $?
  fi

  local pr="${1-}"
  if [[ -z "$pr" ]]; then
    echo "usage: $0 <pr-number> | --compare <local-head> <remote-head>" >&2
    return 2
  fi

  local branch remote_head local_head
  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
  remote_head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

  # The local ref is the one that can be ahead. Prefer the branch a worktree has
  # checked out; fall back to the plain ref. A branch absent locally is not a
  # failure — there is nothing local that could be unpushed.
  if ! local_head=$(git rev-parse --verify --quiet "refs/heads/$branch"); then
    echo "pre-merge-head-check: no local '$branch' — nothing local to be ahead. OK — $remote_head"
    return 0
  fi

  echo "pre-merge-head-check: PR #$pr branch '$branch'"
  compare_heads "$local_head" "$remote_head"
}

main "$@"
