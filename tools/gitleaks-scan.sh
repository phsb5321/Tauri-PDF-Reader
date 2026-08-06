#!/usr/bin/env bash
#
# Fail-closed Gitleaks control — ops-parity T102.
#
# Target CLI: Gitleaks 8.30.1 (`dir` / `git`). The removed `protect`
# subcommand is not used (specs/077-ops-parity/research.md D6).
#
# Modes:
#   tools/gitleaks-scan.sh canary  — negative control: plant a synthetic
#                                    canary in a temp dir, prove `gitleaks dir`
#                                    DETECTS it as rule `elevenlabs-api-key`.
#   tools/gitleaks-scan.sh dir     — scan the working tree (fail on finding).
#   tools/gitleaks-scan.sh git     — scan full git history (fail on finding).
#   tools/gitleaks-scan.sh all     — canary, then dir, then git.
#
# Fail-closed contract (gap-matrix falsifier): a missing binary exits 1; a
# canary that goes undetected exits 1; any finding exits 1. A green exit is
# only ever "tool ran and found nothing".
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/.gitleaks.toml"
# Canary assembled from fragments so no literal secret-shaped bytes exist in
# the repo (the scanner must be able to scan its own control). Repeated
# characters keep entropy low: only the repo rule may claim it.
CANARY_VALUE="sk_$(printf 'A%.0s' {1..40})"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "FAIL-CLOSED: 'gitleaks' not on PATH (need 8.30.1: gitleaks dir|git)." >&2
  exit 1
fi

canary() {
  local tmp output exit_code planted
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  printf 'elevenlabs key: %s\n' "$CANARY_VALUE" > "$tmp/canary.txt"

  # Low-entropy by construction (repeated characters): generic-api-key cannot
  # claim it. Only the repo rule `elevenlabs-api-key` may. Findings print to
  # stderr, so capture 2>&1. Fail-closed on the tool's own exit code: a
  # finding exits 1; 0 (rule broken — nothing found) or any other code (tool
  # crash) must fail the control, so the exit code is inspected explicitly
  # rather than assumed from a log-line grep.
  exit_code=0
  output="$(gitleaks dir "$tmp" -c "$CONFIG" --no-banner --no-color -v 2>&1)" || exit_code=$?
  if [[ "$exit_code" -eq 1 ]] &&
    printf '%s\n' "$output" | grep -q "RuleID:.*elevenlabs-api-key" &&
    printf '%s\n' "$output" | grep -q "$CANARY_VALUE"; then
    echo "canary detected as elevenlabs-api-key — control discriminates."
  else
    echo "FAIL-CLOSED: canary NOT detected (gitleaks exit $exit_code) — control is false-green." >&2
    exit 1
  fi

  # Second arm: the canary must also trip the REAL working-tree scan. Planted
  # inside \$ROOT so an allowlist regression (a future broad path entry) cannot
  # blind the scan while the temp-dir arm still passes. Removed immediately;
  # a stale leftover would make dir scans red — fail-closed, by design.
  planted="$ROOT/tools/.gl-canary/canary.txt"
  mkdir -p "$(dirname "$planted")"
  trap 'rm -rf "$tmp" "$ROOT/tools/.gl-canary"' RETURN
  printf 'elevenlabs key: %s\n' "$CANARY_VALUE" > "$planted"
  exit_code=0
  output="$(gitleaks dir "$ROOT" -c "$CONFIG" --no-banner --no-color -v 2>&1)" || exit_code=$?
  if [[ "$exit_code" -eq 1 ]] &&
    printf '%s\n' "$output" | grep -q "RuleID:.*elevenlabs-api-key" &&
    printf '%s\n' "$output" | grep -q "$CANARY_VALUE"; then
    echo "working-tree canary detected — scan path + allowlist verified."
  else
    echo "FAIL-CLOSED: working-tree canary NOT detected (gitleaks exit $exit_code) — scan path or allowlist is blind." >&2
    exit 1
  fi
}

mode="${1:-all}"
case "$mode" in
  canary) canary ;;
  dir) gitleaks dir "$ROOT" -c "$CONFIG" --no-banner ;;
  git) gitleaks git "$ROOT" -c "$CONFIG" --no-banner ;;
  all)
    echo "== gitleaks $(gitleaks version 2>/dev/null | head -1 || echo 'version unknown') =="
    canary
    echo "== dir scan =="
    gitleaks dir "$ROOT" -c "$CONFIG" --no-banner
    echo "== git history scan =="
    gitleaks git "$ROOT" -c "$CONFIG" --no-banner
    ;;
  *)
    echo "usage: $0 {canary|dir|git|all}" >&2
    exit 2
    ;;
esac
