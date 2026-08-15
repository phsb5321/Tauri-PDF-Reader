#!/usr/bin/env bash
#
# CI/manual wrapper for the canonical private corpus journey.
#
# The canonical runner owns app-profile cleanup, exact-source receipts, and all
# per-book oracles. This wrapper isolates its identity-bearing local logs in a
# mode-0700 temporary directory, emits only an identity-free summary to the
# caller's artifact directory, and deletes the private results on every exit.

set -uo pipefail
cd "$(dirname "$0")/.."
umask 077

if [ -z "${LECTRICE_REAL_PDF_CORPUS:-}" ] || [ ! -d "$LECTRICE_REAL_PDF_CORPUS" ]; then
  echo "BLOCKED: external real corpus is unavailable" >&2
  exit 2
fi
if [ -n "${E2E_PROFILE_DIR:-}" ]; then
  echo "FATAL: real-corpus wrapper refuses a caller-owned E2E_PROFILE_DIR" >&2
  exit 2
fi

OUT="${LECTRICE_CORPUS_OUT:-/tmp/lectrice-corpus}"
if [ -d "$OUT" ] && [ -n "$(find "$OUT" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
  echo "FATAL: corpus artifact directory must start empty" >&2
  exit 2
fi
mkdir -p "$OUT"
chmod 700 "$OUT"

PRIVATE_RESULTS=$(mktemp -d /tmp/lectrice-private-results.XXXXXX)
PRIVATE_MARKER="$PRIVATE_RESULTS/.lectrice-private-results-owned"
: > "$PRIVATE_MARKER"
cleanup() {
  local status=$?
  trap - EXIT
  case "$PRIVATE_RESULTS" in
    /tmp/lectrice-private-results.*)
      if [ -f "$PRIVATE_MARKER" ]; then
        rm -rf -- "$PRIVATE_RESULTS" || status=3
        [ ! -e "$PRIVATE_RESULTS" ] || status=3
      else
        echo "cleanup FAILED: private-results ownership marker missing" >&2
        status=3
      fi
      ;;
    *)
      echo "cleanup FAILED: unexpected private-results path" >&2
      status=3
      ;;
  esac
  exit "$status"
}
trap cleanup EXIT

CORPUS_RESULTS_DIR="$PRIVATE_RESULTS" \
  bash e2e/run-corpus-journey.sh
STATUS=$?

SOURCE_SHA=""
if [ -f "$PRIVATE_RESULTS/source.json" ]; then
  SOURCE_SHA=$(jq -r '.sourceSha // ""' "$PRIVATE_RESULTS/source.json")
fi
FAILURE_COUNT=0
[ -f "$PRIVATE_RESULTS/failures.tsv" ] && FAILURE_COUNT=$(wc -l < "$PRIVATE_RESULTS/failures.tsv")
COVER_COUNT=0
COVER_DISTINCT=0
if [ -f "$PRIVATE_RESULTS/cover-hashes.tsv" ]; then
  COVER_COUNT=$(wc -l < "$PRIVATE_RESULTS/cover-hashes.tsv")
  COVER_DISTINCT=$(cut -f3 "$PRIVATE_RESULTS/cover-hashes.tsv" | sort -u | wc -l)
fi

printf '{"sourceSha":"%s","exit":%d,"failures":%d,"coverCount":%d,"distinctCovers":%d,"privateArtifactsRetained":false}\n' \
  "$SOURCE_SHA" "$STATUS" "$FAILURE_COUNT" "$COVER_COUNT" "$COVER_DISTINCT" \
  > "$OUT/summary.json"
chmod 600 "$OUT/summary.json"

exit "$STATUS"
