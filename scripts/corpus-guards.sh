#!/usr/bin/env bash
#
# corpus-guards.sh — the runner's failure-decision logic, sourced by BOTH the
# corpus runner (e2e/run-corpus-journey.sh) and the lightweight negative
# controls (scripts/corpus-negative-controls.sh). One definition, one test:
# the controls exercise exactly the functions the runner executes.
#
# State contract (shared via env):
#   GUARDS_FAILED   — 0/1 accumulator, mirrors the runner's FAILED
#   GUARDS_FAILURES — path of the failures file (TSV, basename/sha/kind/cmd/log)
#
# Every guard returns non-zero when the condition it guards FAILS, so the
# negative controls can assert exit codes directly.

guard_init() {
  GUARDS_FAILED=0
  : > "$GUARDS_FAILURES"
}

guard_record() {
  local basename="$1" sha="$2" kind="$3" cmd="$4" log="$5"
  printf "%s\t%s\t%s\t%s\t%s\n" "$basename" "$sha" "$kind" "$cmd" "$log" >> "$GUARDS_FAILURES"
  GUARDS_FAILED=1
}

# NC1: a failed build must be recorded and turn the run non-green.
# Message output stays with build_book (which already reports the failure
# line) — this guard only records, preserving the pre-refactor output.
# Usage: guard_build_status <status> <basename> <sha> <cmd> <log>
guard_build_status() {
  local status="$1" basename="$2" sha="$3" cmd="$4" log="$5"
  if [ "$status" -ne 0 ]; then
    guard_record "$basename" "$sha" build "$cmd" "$log"
    return 1
  fi
  return 0
}

# NC2: an EPUB whose enumerated sha256 differs from the committed manifest is
# a FATAL (exit 3) — an unmanifested/mutated negative control refuses to run.
# Usage: guard_epub_manifest <enumerated_sha> <manifest_sha> <basename>
guard_epub_manifest() {
  local enum_sha="$1" manifest_sha="$2" basename="$3"
  if [ -z "$manifest_sha" ] || [ "$manifest_sha" = "null" ]; then
    echo "FATAL: no manifest sha256 for $basename — unmanifested negative control, refusing" >&2
    return 3
  fi
  if [ "$enum_sha" != "$manifest_sha" ]; then
    echo "FATAL: enumerated EPUB sha256 ($enum_sha) != manifest ($manifest_sha) — refusing" >&2
    return 3
  fi
  return 0
}

# NC3: cover-hashes.tsv must contain EXACTLY the expected row count (missing
# rows = subset false-green; extra rows = stale results-dir false-green).
# Usage: guard_cover_count <actual_rows> <expected_rows> <failures_path>
guard_cover_count() {
  local actual="$1" expected="$2" logpath="$3"
  if [ "$actual" -ne "$expected" ]; then
    echo "==> Cover-coverage FAIL: $actual/$expected books have cover hashes — exact-count invariant violated (stale rows in a reused results dir must not false-green)"
    guard_record "(all books)" "(multiple)" cover-coverage \
      "cover-hashes.tsv has $actual rows, expected exactly $expected" "$logpath"
    return 1
  fi
  return 0
}

# NC4: any leftover cover-cache file for a deleted document must fail the run.
# Usage: guard_cache_leftover <leftover> <basename> <sha> <cmd> <log>
guard_cache_leftover() {
  local leftover="$1" basename="$2" sha="$3" cmd="$4" log="$5"
  if [ -n "$leftover" ]; then
    echo "    cache-cleanup FAIL: leftover cover cache for ${sha:0:12}: $leftover"
    guard_record "$basename" "$sha" cache-cleanup "$cmd" "$log"
    return 1
  fi
  return 0
}

# NC5: cover evidence must be consistent — a rendered blob hash and a cached
# covers/{SHA}-* file hash must BOTH exist and MATCH. One-sided evidence
# (blob without cache file, or cache file without blob) and mismatched
# hashes all fail. Both-empty returns 0 (the caller decides the BLOCKED
# record for bases without a cover surface).
# Usage: guard_cover_hash_match <blob_sha> <file_sha> <basename> <sha> <cmd> <log>
guard_cover_hash_match() {
  local blob="$1" file="$2" basename="$3" sha="$4" cmd="$5" log="$6"
  if [ -n "$file" ] && [ -z "$blob" ]; then
    echo "    cover-tie FAIL: cache file exists but spec logged no rendered contentSha256"
    guard_record "$basename" "$sha" cover-tie "$cmd" "$log"
    return 1
  fi
  if [ -n "$file" ] && [ -n "$blob" ] && [ "$blob" != "$file" ]; then
    echo "    cover-tie FAIL: $basename rendered=$blob cache=$file"
    guard_record "$basename" "$sha" cover-tie "$cmd" "$log"
    return 1
  fi
  if [ -n "$blob" ] && [ -z "$file" ]; then
    echo "    cover-cache FAIL: spec rendered a cover (contentSha256=$blob) but no covers/{SHA}-* cache file exists"
    guard_record "$basename" "$sha" cover-cache "$cmd" "$log"
    return 1
  fi
  return 0
}

# NC6: a missing/blocked oracle (no cover-cache dir, unavailable tts query,
# no pre-delete tts row, missing cover-hashes.tsv, missing probe) must fail
# the run — BLOCKED is not green. The caller passes the EXACT message to
# preserve runner output.
# Usage: guard_missing_oracle <kind> <basename> <sha> <cmd> <log> <message>
guard_missing_oracle() {
  local kind="$1" basename="$2" sha="$3" cmd="$4" log="$5" message="$6"
  echo "$message"
  guard_record "$basename" "$sha" "$kind" "$cmd" "$log"
  return 1
}
