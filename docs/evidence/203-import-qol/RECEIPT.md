# 203-import-qol evidence receipt — 08/09/2026

Head frozen: 282ab77 (branch 203-import-qol) — PR #202 -> 177-library-completeness.

## Fail-first RED (pre-implementation)

- red-fail-first.log (13:32) — first red run; also caught two import-path bugs in
  the NEW tests themselves (`../tests/setup` -> `../../tests/setup`), fixed before
  implementation; 3 genuine reds visible.
- red-fail-first2.log (13:33) — complete red: interleaving falsifier + property
  model red against unmodified source. 5 red tests total across both logs:
  1. resume busy guard (useOpenPdf), 2) store success=false authority
     (session-flow), 3) shell success=false failure UI (session-restore),
  2. continuous-lease/interleaving (usePdfDropSession), 5) seeded command model.

## GREEN (post-implementation, single targeted turn under /tmp/lectrice-heavy-gate.lock)

- targeted-final-replay.log (13:46:05-13:46:13, acquired after library202 released;
  released immediately after): 11 files, 78 tests passed, exit 0, 7.31s.
- lint.log: 0 errors (96 pre-existing warnings, none introduced).
- typecheck.log: clean (tsc --noEmit exit 0).

## Packaged lane

- packaged-run-interrupted-1343.log + NOTE — interrupted by coordinator before any
  assertion: ran ahead of the required targeted replay and pointed CARGO_TARGET_DIR
  at the QA204 worktree target (shared-target violation). No result implied.
- Pending: one packaged library-completeness replay AFTER QA's warm #200 replay
  releases the lock, using ONLY this worktree's own target. The runner extension
  (documents-count pin + dropDbCounts receipt) is in this head.

## Corrections from capable plan check — all applied before freeze

1. One continuous lease (no release/re-acquire gap) + falsifier at the old boundary.
2. Single success=false decision in the store authority; hook consumes rejection.
3. Reuse existing native OS-drop actor (dragon-drop + xdotool) — extended, not
   pre-declared missing. SessionMenu failure coverage: no onSessionRestored, no
   document opened.
