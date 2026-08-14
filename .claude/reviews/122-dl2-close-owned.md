# Adversarial review — 122-dl2-close-owned (round 2, Codex)

**Reviewer:** Codex (OpenAI-lineage, `auto` lane with `avoidFamily=chinese-frontier`)
— family-diverse against the DeepSeek generator. Read-only judge, repo-aware.
**Date:** 13/08/2026 (2026-08-13 20:04 BRT)
**Scope:** `946bca6` (autosave fast-close revert fix) + `6177f1e` (highlights
create-flush + shared-queue hardening) + the round-1 hardening `b4e116b`
(groq round is recorded in that commit's body).

## Verdict as returned: CHANGES REQUIRED

3 MAJOR / 2 TEST-GAP. **Two MAJORs accepted and fixed (fail-first), one rejected
(out-of-branch, pre-merged #113 code), both TEST-GAPs closed.**

| Finding                                                                                                                                                                                                                                                             | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR — an interleaved background `flushImmediately` join can consume the failure record before the close flush that joined the SAME failing flush reads it (the record reset was unconditional in `flushImmediately`)                                              | **ACCEPTED** — the reset now only runs when the call joined NOTHING (`joinedFlush === null`); a joiner never clears the record another joiner still needs. Fail-first: `an interleaved BACKGROUND flush cannot consume the failure a close flush joined` was RED pre-fix (the background join cleared the flag, the close flush resolved) / GREEN post-fix                                                                                                                     |
| MAJOR — the background requeue of a failed create/update blindly overwrites a NEWER entry for the same id enqueued while the write was in flight (e.g. a delete superseding a failing create) — the user's delete is lost, the stale retry resurrects the highlight | **ACCEPTED** — the requeue now only applies when the map still holds the SAME attempt (`current === undefined                                                                                                                                                                                                                                                                                                                                                                  |     | current.timestamp === pending.timestamp`); newer intent always wins. Fail-first: `a failed create's requeue does not overwrite a delete enqueued while it was in flight` was RED pre-fix (delete never landed, create retried over it) / GREEN post-fix |
| MAJOR — native close-ack listener-registration race: backend emits `app-close-requested` before the spawned task registers `app-close-ack` (src-tauri/src/lib.rs, merged in #113)                                                                                   | **REJECTED as blocking; recorded** — out of branch scope (the file predates this branch). The falsifier ("flushes immediately resolve") is only reachable in a mock harness: in production the ack requires an IPC round-trip (ms-scale) while the tokio spawn + `listen` registration completes in the same tick as the emit, and the 3s timeout bounds the worst case to a delay, never data loss. Handed to the orchestrator as a backlog hardening item for a future slice |
| TEST-GAP — close-flush UI test uses immediately-resolving writes; does not prove the ack waits for an in-flight write                                                                                                                                               | **CLOSED** — hook-level ordering was already pinned in `useAutoSave.test.ts` (`close flush awaits the in-flight write and drains the latest dirty snapshot`, deferred promises); the UI seam now has `does NOT acknowledge until the in-flight position write lands` (deferred `library_update_progress`, ack asserted absent mid-flight, present after resolve)                                                                                                               |
| TEST-GAP — cross-instance test only counts a create call; does not prove instance B's close flush JOINS instance A's in-flight write                                                                                                                                | **CLOSED** — `one instance's close flush JOINS the other instance's in-flight write, not just its queue` (A's create deferred, B's propagating flush asserted unsettled until A resolves)                                                                                                                                                                                                                                                                                      |

## Evidence

- Fail-first: the two MAJOR regression tests were RED against `b4e116b` before
  the fix (`Tests 2 failed | 7 passed (9)`, both failures exactly the two new
  tests) and GREEN after (`9 passed (9)`).
- Close surface: `useHighlightPersistence.test.ts` 9/9, `useAutoSave.test.ts`
  6/6, `close-flush.test.tsx` 3/3 — 17/17 across the three suites.
- `tsc --noEmit` exit 0; `eslint` on the three touched files 0 errors; prettier
  clean.
- Machine-load caveat: the full 1052-test suite flakes under this host's
  ~260 load average (different failure sets per run, unrelated files green in
  isolation — e.g. `AudioExportDialog.test.tsx` 31/31); the CI runner (vm103,
  serial) is the authoritative full-suite gate for this PR.

## Revert

`git revert <squash>` — useHighlightPersistence.ts (guarded clear + requeue
guard), useHighlightPersistence.test.ts (+3 tests), close-flush.test.tsx
(+1 ordering test), this record, the backlog entry.
