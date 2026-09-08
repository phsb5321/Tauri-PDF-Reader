# Packaged native run — identity & provenance (08/09/2026, written 14:3x BRT)

Source identity: PR #202 head **4ac7a53** (product commit `282ab77`), branch
`203-import-qol`, base `177-library-completeness`. Head frozen; this run made no
commits.

Binary (run's own literal path, NOT copied, NOT rerun):
`/var/tmp/pi-agent-1000/f25541878b0ccdf1.1022542.d1e8dee46646/lectrice-library-completeness.SYns5R/target/debug/tauri-pdf-reader`
SHA-256: `8070854e5da990bf6bbbf4b8417ef2cc4fdb6bf59bf3100f707cc622bbbb286f`

Run root (literal): `/var/tmp/pi-agent-1000/f25541878b0ccdf1.1022542.d1e8dee46646/lectrice-library-completeness.SYns5R`
(receipt.json sha256 `1f9adfec05ef0b3f8f29d8a35adeec439522e1e24960c2193308a36ecfb7b744`,
copied here as `packaged-native-receipt.json` with drop-hover/success/active-session
screenshots; receipt written 14:28:54, run window 14:02:10–14:28:54 under
/tmp/lectrice-heavy-gate.lock.)

App DB provenance (profile dir, not copied): `/tmp/lectrice-e2e-profile.dVRmUt/com.lectrice.reader/pdf-reader.db`
(DB mtime 14:28:17 = this run's own count checks):
`documents=2 sessions=1 members=1 dropped_row(path like %legacy-readable.pdf)=1`

## Result (exact, no inference)

- WDIO journey `phase=drop`: **PASS** (`1 passing` — real OS drag, drop overlay,
  viewer, session-created status, active-session row, invalid non-PDF drag →
  DROP_INVALID banner).
- Runner gate: **EXIT 1** at MY new documents-count assertion:
  `expected exactly three document rows (2 legacy + 1 dropped; invalid drop adds
none), got 2`.
- Measured DB: documents=2, sessions=1, members=1. The journey drops the SAME
  fixture file seeded in phase 1, so the import correctly REUSES the known row
  (no new documents row — a pinned product behavior); the invalid drag added no
  row (documents stayed 2). The follow-up-5 OBSERVATION holds (invalid drop adds
  no documents row); my runner ASSERTION's expected value (3) was mis-specified
  for this journey. Test-oracle defect in the runner extension — a product
  defect is neither claimed nor excluded here.
- The runner exited BEFORE writing `dropDbCounts` into the receipt (set -e), so
  the receipt carries journey fields only; counts above come from the run's DB
  and the gate log.

## Status

- No rerun (instruction), head untouched (no commits after 4ac7a53), binary/cache
  not copied. Correcting the runner assertion is a queued one-line change that
  moves the head and therefore needs coordinator/QA authorization + re-gate.
- Packaged proof: journey PASS + gate FAIL on the mis-specified assertion,
  with full binary/run identity above — verdict authority rests with
  lectrice-qa-204 / tauri-pdf-eng, not this seat.
