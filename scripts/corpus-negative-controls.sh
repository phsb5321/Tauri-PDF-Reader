#!/usr/bin/env bash
#
# corpus-negative-controls.sh — LIGHTWEIGHT deterministic negative controls
# for the corpus runner's failure logic. No packaged build, no app run, no
# heavy lock: each control sources the SAME guards library the runner uses
# (scripts/corpus-guards.sh) and asserts the guard returns NONZERO on a
# failing input AND ZERO on a passing input (a guard that always fails would
# make the negative control vacuous).
#
# Controls (mapping to coordinator requirements):
#   NC1 build command forced failure        => guard returns nonzero
#   NC2 EPUB oracle mutation                => guard returns nonzero (FATAL 3)
#   NC3 cover expected-count mismatch       => guard returns nonzero
#   NC4 cleanup stale cache                 => guard returns nonzero
#
# Usage: bash scripts/corpus-negative-controls.sh
# Exit:  0 = all four controls passed (negative AND positive legs)
#        1 = any leg failed

set -uo pipefail
cd "$(dirname "$0")/.."
GUARDS="$PWD/scripts/corpus-guards.sh"
# CORPUS_CONTROLS_TMP: writable PARENT for the controls' scratch dir, for
# review sandboxes where /tmp/mktemp is blocked. The actual scratch dir is a
# script-owned mktemp CHILD under it, so cleanup never touches a caller-
# supplied path. Default: mktemp -d under the system temp.
TMP_PARENT="${CORPUS_CONTROLS_TMP:-}"
if [ -n "$TMP_PARENT" ]; then
  mkdir -p "$TMP_PARENT"
  TMP="$(mktemp -d "$TMP_PARENT/corpus-controls.XXXXXX")"
else
  TMP="$(mktemp -d)"
fi
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# A control leg: name + the guard's exit code + expected (nonzero=1 / zero=0)
check() {
  local name="$1" got="$2" want="$3"
  if { [ "$want" -eq 1 ] && [ "$got" -ne 0 ]; } || { [ "$want" -eq 0 ] && [ "$got" -eq 0 ]; }; then
    echo "  ✓ $name (exit $got)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected ${want:+nonzero}${want:+ }${want:+}got $got"
    FAIL=$((FAIL + 1))
  fi
}

echo "==> NC0: runner wiring contract — the runner sources the SAME guards"
if grep -q 'source "$E2E_REPO_ROOT/scripts/corpus-guards.sh"' e2e/run-corpus-journey.sh \
  && grep -q 'guard_build_status' e2e/run-corpus-journey.sh \
  && grep -q 'guard_epub_manifest' e2e/run-corpus-journey.sh \
  && grep -q 'guard_cover_count' e2e/run-corpus-journey.sh \
  && grep -q 'guard_cache_leftover' e2e/run-corpus-journey.sh \
  && grep -q 'guard_cover_hash_match' e2e/run-corpus-journey.sh \
  && grep -q 'guard_missing_oracle' e2e/run-corpus-journey.sh \
  && grep -q 'rm -rf -- "$CORPUS_PROFILE_ROOT"' e2e/run-corpus-journey.sh \
  && grep -q 'confirmCalls() === 1' e2e/corpus-journey.e2e.mjs \
  && grep -q 'confirmCallCount += 1' src/e2e-native-bootstrap.ts; then
  echo "  ✓ NC0 wiring (guards + private-profile cleanup + confirm invocation)"
  PASS=$((PASS + 1))
else
  echo "  ✗ NC0 wiring — runner does not use the tested guards"
  FAIL=$((FAIL + 1))
fi

echo "==> NC1: build command forced failure => nonzero"
source "$GUARDS"
GUARDS_FAILURES="$TMP/nc1.tsv"
guard_init
guard_build_status 0 "book.pdf" "sha" "cmd" "log"   # positive leg
check "NC1 build ok (exit 0)" $? 0
GUARDS_FAILURES="$TMP/nc1b.tsv"
guard_init
guard_build_status 1 "book.pdf" "sha" "cmd" "log"   # negative leg
NC1_GOT=$?
check "NC1 build fail (nonzero)" "$NC1_GOT" 1
grep -q $'\tbuild\t' "$GUARDS_FAILURES" && check "NC1 failure recorded" 0 0 || check "NC1 failure recorded" 1 0

echo "==> NC2: EPUB oracle mutation => nonzero (FATAL)"
GUARDS_FAILURES="$TMP/nc2.tsv"
guard_init
guard_epub_manifest "abc123" "abc123" "book.epub"    # positive leg (match)
check "NC2 manifest match (exit 0)" $? 0
guard_epub_manifest "abc123" "def456" "book.epub"    # negative leg (mutation)
NC2_GOT=$?
check "NC2 epub mutation (nonzero)" "$NC2_GOT" 1
guard_epub_manifest "abc123" "null" "ghost.epub"     # negative leg (unmanifested)
NC2B_GOT=$?
check "NC2 unmanifested epub (nonzero)" "$NC2B_GOT" 1

echo "==> NC3: cover expected-count mismatch => nonzero"
GUARDS_FAILURES="$TMP/nc3.tsv"
guard_init
guard_cover_count 5 5 "$TMP/nc3.tsv"                 # positive leg
check "NC3 exact count (exit 0)" $? 0
GUARDS_FAILURES="$TMP/nc3b.tsv"
guard_init
guard_cover_count 4 5 "$TMP/nc3b.tsv"                # negative leg: missing row
NC3_GOT=$?
check "NC3 missing row (nonzero)" "$NC3_GOT" 1
grep -q $'\tcover-coverage\t' "$TMP/nc3b.tsv" && check "NC3 missing-row recorded" 0 0 || check "NC3 missing-row recorded" 1 0
GUARDS_FAILURES="$TMP/nc3c.tsv"
guard_init
guard_cover_count 6 5 "$TMP/nc3c.tsv"                # negative leg: stale row (isolated file)
NC3B_GOT=$?
check "NC3 stale row (nonzero)" "$NC3B_GOT" 1
grep -q $'\tcover-coverage\t' "$TMP/nc3c.tsv" && check "NC3 stale-row recorded" 0 0 || check "NC3 stale-row recorded" 1 0

echo "==> NC4: cleanup stale cache => nonzero"
GUARDS_FAILURES="$TMP/nc4.tsv"
guard_init
guard_cache_leftover "" "book.pdf" "sha" "cmd" "log" # positive leg (no leftover)
check "NC4 no leftover (exit 0)" $? 0
GUARDS_FAILURES="$TMP/nc4b.tsv"
guard_init
guard_cache_leftover "$TMP/stale/covers/sha-1.png" "book.pdf" "sha" "cmd" "log"
NC4_GOT=$?
check "NC4 stale cache (nonzero)" "$NC4_GOT" 1
grep -q $'\tcache-cleanup\t' "$TMP/nc4b.tsv" && check "NC4 stale-cache recorded" 0 0 || check "NC4 stale-cache recorded" 1 0

echo "==> NC5: cover hash mismatch => nonzero"
GUARDS_FAILURES="$TMP/nc5.tsv"
guard_init
guard_cover_hash_match "abc123" "abc123" "book.pdf" "sha" "cmd" "log"  # positive leg (match)
check "NC5 hash match (exit 0)" $? 0
GUARDS_FAILURES="$TMP/nc5b.tsv"
guard_init
guard_cover_hash_match "abc123" "def456" "book.pdf" "sha" "cmd" "log"  # mismatch
NC5_GOT=$?
check "NC5 hash mismatch (nonzero)" "$NC5_GOT" 1
grep -q $'\tcover-tie\t' "$TMP/nc5b.tsv" && check "NC5 mismatch recorded" 0 0 || check "NC5 mismatch recorded" 1 0
GUARDS_FAILURES="$TMP/nc5c.tsv"
guard_init
guard_cover_hash_match "" "def456" "book.pdf" "sha" "cmd" "log"       # cache file, no blob
NC5C_GOT=$?
check "NC5 no-blob (nonzero)" "$NC5C_GOT" 1
GUARDS_FAILURES="$TMP/nc5d.tsv"
guard_init
guard_cover_hash_match "abc123" "" "book.pdf" "sha" "cmd" "log"       # blob, no cache file
NC5D_GOT=$?
check "NC5 no-cache-file (nonzero)" "$NC5D_GOT" 1
grep -q $'\tcover-cache\t' "$TMP/nc5d.tsv" && check "NC5 no-cache-file recorded" 0 0 || check "NC5 no-cache-file recorded" 1 0

echo "==> NC6: missing oracle/selector => nonzero"
GUARDS_FAILURES="$TMP/nc6.tsv"
guard_init
guard_missing_oracle cache-cleanup-blocked "book.pdf" "sha" "cmd" "log" \
  "    cache-cleanup BLOCKED (FAILED): tts oracle unavailable"
NC6_GOT=$?
check "NC6 missing oracle (nonzero)" "$NC6_GOT" 1
grep -q $'\tcache-cleanup-blocked\t' "$TMP/nc6.tsv" && check "NC6 missing-oracle recorded" 0 0 || check "NC6 missing-oracle recorded" 1 0

echo
echo "==> RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
