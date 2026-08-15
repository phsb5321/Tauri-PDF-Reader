#!/usr/bin/env bash
#
# corpus-watch-rebase.sh — ACTIVE watch loop for the corpus lane. Polls
# origin/main every 60s; when a prerequisite merges (#122 open / #123
# contrast / covers PR), rebases 125-corpus-runner onto the new main and
# re-runs ONLY the lightweight guard tests (no packaged/full corpus run).
#
# Deterministic — no LLM needed per iteration. Safety:
#   - rebase only when the worktree is CLEAN (no uncommitted changes);
#   - a conflicted rebase is ABORTED (never left half-applied) and logged;
#   - full private-corpus run stays HELD (this loop never starts it).
#
# Usage:   setsid nohup bash scripts/corpus-watch-rebase.sh > /tmp/lectrice-corpus-watch.out 2>&1 < /dev/null &
# Kill:    kill "$(cat /tmp/lectrice-corpus-watch.pid)"

set -uo pipefail
WORKTREE="$(cd "$(dirname "$0")/.." && pwd)"
LOG=/tmp/lectrice-corpus-watch.log
STATE=/tmp/lectrice-corpus-watch.state
PIDFILE=/tmp/lectrice-corpus-watch.pid
INTERVAL=60

echo "$$" > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

log() { echo "$(date '+%d/%m/%Y %H:%M:%S %Z') $*" >> "$LOG"; }

: > "$LOG"
log "watch start (interval ${INTERVAL}s, worktree $WORKTREE)"
LAST_MAIN=""
COVERS_PR=""

while true; do
  cd "$WORKTREE" || { log "FATAL: worktree missing"; exit 1; }

  if ! git fetch origin main -q 2>>"$LOG"; then
    log "fetch failed (retrying in ${INTERVAL}s)"
    sleep "$INTERVAL"
    continue
  fi
  NEW_MAIN="$(git rev-parse origin/main)"

  # Covers PR appearance tracking (headRefName 121-cover-pipeline).
  COVERS_NOW="$(gh pr list --state open --json number,headRefName 2>/dev/null \
    | jq -r '.[] | select(.headRefName == "121-cover-pipeline") | .number' | head -1)"
  if [ -n "$COVERS_NOW" ] && [ "$COVERS_NOW" != "$COVERS_PR" ]; then
    log "covers PR #$COVERS_NOW opened (121-cover-pipeline)"
    COVERS_PR="$COVERS_NOW"
  fi

  if [ -n "$LAST_MAIN" ] && [ "$NEW_MAIN" != "$LAST_MAIN" ]; then
    log "origin/main moved: $LAST_MAIN -> $NEW_MAIN"
    # Identify the merged PR on the new main.
    gh pr list --state merged --json number,title,mergeCommit,mergedAt --limit 6 2>/dev/null \
      | jq -r --arg sha "$NEW_MAIN" '.[] | select(.mergeCommit.oid == $sha) | "  merged #\(.number) \(.title[0:60])"' \
      >> "$LOG" || log "  (merged-PR identification unavailable)"
    if [ -n "$COVERS_PR" ]; then
      gh pr view "$COVERS_PR" --json state 2>/dev/null | jq -r '"  covers PR #'"$COVERS_PR"' state: \(.state)"' >> "$LOG"
    fi

    if [ -n "$(git status --porcelain)" ]; then
      log "  REBASE SKIPPED — worktree dirty (uncommitted changes)"
    elif git rebase origin/main >>"$LOG" 2>&1; then
      log "  REBASE OK -> $(git rev-parse --short HEAD) on $NEW_MAIN"
      if bash scripts/corpus-negative-controls.sh >>"$LOG" 2>&1; then
        log "  CONTROLS PASS (23/23) on new head"
      else
        log "  CONTROLS FAIL — investigate (log: scripts/corpus-negative-controls.sh)"
      fi
    else
      git rebase --abort 2>>"$LOG"
      log "  REBASE CONFLICT — ABORTED, manual resolution required"
    fi
  fi

  LAST_MAIN="$NEW_MAIN"
  echo "$LAST_MAIN" > "$STATE"
  sleep "$INTERVAL"
done
