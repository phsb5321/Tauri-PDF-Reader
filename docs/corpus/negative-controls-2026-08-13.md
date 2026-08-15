# Corpus negative controls — receipts 13/08/2026

Authoritative date: 13/08/2026 (BRT). Exact head: `125-corpus-runner` @ `b4396461`.
Replay command (deterministic, no build/app/lock):

```bash
bash scripts/corpus-negative-controls.sh
```

Result on the exact head: **23 legs, 23 passed, 0 failed** (exit 0). Full transcript:
`/tmp/corpus-controls-transcript-2026-08-13-1721.txt` (host-local, regenerable).

## NC1 — forced build failure ⇒ nonzero (`guard_build_status`)

- positive: `guard_build_status 0 …` → exit 0 ✓
- negative: `guard_build_status 1 …` → exit 1 ✓, `build` kind recorded in failures.tsv ✓
- Falsifier guarded: a build that fails must never let the run exit green.

## NC2 — EPUB wrong acceptance ⇒ nonzero (`guard_epub_manifest`)

- positive: enumerated sha == manifest sha → exit 0 ✓
- negative: sha mutation → exit 3 (FATAL) ✓
- negative: unmanifested basename → exit 3 ✓
- Falsifier guarded: a swapped/edited EPUB must refuse to run the control.

## NC3 — cover expected-count mismatch ⇒ nonzero (`guard_cover_count`)

- positive: exact count (5/5) → exit 0 ✓
- negative: missing row (4/5) → exit 1 ✓ + `cover-coverage` recorded ✓ (isolated file)
- negative: stale row (6/5) → exit 1 ✓ + `cover-coverage` recorded ✓ (isolated file)
- Falsifier guarded: subset OR stale-row evidence must not false-green.

## NC4 — stale cache cleanup ⇒ nonzero (`guard_cache_leftover`)

- positive: no leftover → exit 0 ✓
- negative: leftover `covers/{sha}-*` file → exit 1 ✓ + `cache-cleanup` recorded ✓
- Falsifier guarded: a deleted document's cached cover must be gone.

## NC5 — cover hash mismatch ⇒ nonzero (`guard_cover_hash_match`)

- positive: rendered blob sha == cached file sha → exit 0 ✓
- negative: mismatch → exit 1 ✓ + `cover-tie` recorded ✓
- negative: cache file present, no rendered blob → exit 1 ✓
- negative: rendered blob present, no cache file → exit 1 ✓ + `cover-cache` recorded ✓
- Falsifier guarded: one-sided or mismatched cover evidence fails; only
  both-empty (no cover surface) is the caller's BLOCKED decision.

## NC6 — missing selector/oracle ⇒ nonzero (`guard_missing_oracle`)

- negative: blocked oracle (tts unavailable / no pre-delete row / post-delete
  query failed / no cover-cache dir / missing cover-hashes.tsv) → exit 1 ✓ +
  kind recorded ✓
- Falsifier guarded: BLOCKED is not green; every blocked path records.

## NC0 — wiring contract

The runner sources the same guards and uses all six (`grep`-verified) ✓ —
the controls cannot pass while the runner drifts to untested logic.

## Western gate verdict

Codex/OpenAI, exact head `b439646` (round 9): **APPROVE**.

- All six guards sourced/called; final exit folds `FAILED || GUARDS_FAILED`.
- `CORPUS_CONTROLS_TMP` is a writable parent; the trap deletes only the
  script-owned `mktemp -d` child (never a caller path) — verified.
- 23/23 accepted (host re-run + parent-survival test); `bash -n` and
  `git diff --check` pass; no private paths; no corpus bytes.
- Hold in force: #119/#122/#123 OPEN, covers PR not yet opened at review time.

## Guard history (what the gate caught and was fixed)

1. Cover-hash + missing-oracle were inline-only → extracted to guards (NC5/NC6).
2. Blob-without-cache-file misrouted to NC6 → routed to NC5's one-sided arm.
3. `CORPUS_CONTROLS_TMP` rm-rf hazard → parent/child split.
4. NC3 stale-row record shared the missing-row file → isolated per-leg files.
