#!/usr/bin/env bash
#
# Run one gate, preserve its real exit status through tee, and bind the evidence
# to the current candidate SHA. A failed command still leaves a status record.
set -Eeuo pipefail

if (($# < 2)); then
  echo "usage: $0 <evidence-name> <command> [args...]" >&2
  exit 2
fi

evidence_name=$1
shift

if [[ ! $evidence_name =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "run-evidence: invalid evidence name: $evidence_name" >&2
  exit 2
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "run-evidence: run inside a git worktree" >&2
  exit 2
}
artifact_dir="$repo_root/.artifacts"
log_path="$artifact_dir/$evidence_name.log"
status_path="$artifact_dir/$evidence_name.status"
mkdir -p "$artifact_dir"

candidate_sha=$(git -C "$repo_root" rev-parse HEAD)
started_at=$(date '+%d/%m/%Y %H:%M:%S %Z')
status_tmp=$(mktemp "$artifact_dir/.${evidence_name}.status.XXXXXX")
cleanup() {
  rm -f "$status_tmp"
}
trap cleanup EXIT HUP INT TERM

{
  printf 'gate: %s\n' "$evidence_name"
  printf 'candidate: %s\n' "$candidate_sha"
  printf 'started: %s\n' "$started_at"
  printf 'command:'
  printf ' %q' "$@"
  printf '\n'
} >"$log_path"

set +e
"$@" 2>&1 | tee -a "$log_path"
command_status=${PIPESTATUS[0]}
set -e

finished_at=$(date '+%d/%m/%Y %H:%M:%S %Z')
{
  printf 'exit_code=%s\n' "$command_status"
  printf 'candidate_sha=%s\n' "$candidate_sha"
  printf 'started_at=%s\n' "$started_at"
  printf 'finished_at=%s\n' "$finished_at"
} >"$status_tmp"
mv "$status_tmp" "$status_path"

printf 'finished: %s\nexit: %s\n' "$finished_at" "$command_status" >>"$log_path"
exit "$command_status"
