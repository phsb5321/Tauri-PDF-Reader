# Tasks 203 — Import transaction slice

- [ ] T1 Fail-first tests: interleaving (deferred createSession), success=false
      fail-closed (hook), success=false fail-closed (store), resume busy guard,
      seeded command model (seed 20260908) — capture red evidence.
- [ ] T2 `document-store.ts`: `beginOpenTransaction` try-lock + generation release.
- [ ] T3 `useOpenPdf.ts`: hold transaction across `openPdf` / `openDroppedPdf` /
      `resumeDocument`; add resume OPEN_BUSY guard.
- [ ] T4 `usePdfDropSession.ts`: post-import transaction hold; success=false →
      SESSION_RESTORE_FAILED throw (rollback preserved).
- [ ] T5 `session-store.ts`: fail closed on `success=false` before state commit.
- [ ] T6 Targeted green run (heavy-gate lock, single fork) + lint + typecheck.
- [ ] T7 Evidence (docs/evidence/203-\*, red+green receipts), reports/import.md,
      commit/push, stacked PR vs `177-library-completeness`, notify coordinator
      (exact SHA + journey), fleet-intel row.
