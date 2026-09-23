# Tasks

- [x] T294-001 `document-store.ts`: supersede-able open lease — `beginOpenTransaction()` always succeeds, returns `{ generation, isSuperseded, release }`; every lease releases its slot, only the last clears `isLoading`.
- [x] T294-002 New `src/lib/user-message.ts`: `friendlyError` strips a leading `CODE: ` prefix at the user-visible boundary.
- [x] T294-003 `useOpenPdf.ts`: latest-wins across `openPdf`/`openDroppedPdf`/`resumeDocument`/`reauthorizeAccess` — supersede checks after dialog + before import + at the visible-commit point; silent supersede (no error, no commit); all `setError` through `friendlyError`.
- [x] T294-004 `usePdfDropSession.ts`: remove `DROP_BUSY`/in-flight refusal — second drop supersedes, superseded transaction rolls back its session silently; friendly `DROP_INVALID`; drop `DROP_FAILED:` prefix; overlay reflects the latest drop transaction.
- [x] T294-005 `PdfViewer.tsx`: render gate — skeleton only when `isLoading && !pdfDocument`, full-screen error only when `error && !pdfDocument`; loaded document keeps its canvas (error via ReaderView banner).
- [x] T294-006 Rewrite `useOpenPdf.test.ts` busy cases (:174/:190/:252) as supersede assertions: second open wins, first aborted, no error set, no `OPEN_BUSY` anywhere.
- [x] T294-007 Rewrite `usePdfDropSession.test.ts` busy case (:250) + add second-drop-supersede case (silent session rollback, no busy error).
- [x] T294-008 Rework `usePdfDropSession.property.test.ts` command model to latest-wins (at most one commit; superseded transactions roll back silently; no-busy + no-raw-code invariants after every op).
- [x] T294-009 New `src/__tests__/ui/pdf-viewer-error-gate.test.tsx`: full-screen error only without a document; loaded document survives a failed open; no rendered string matches `/^[A-Z_]+: /`.
- [x] T294-010 Gates: `pnpm lint` (0 errors / 107 pre-existing warnings), `pnpm typecheck` (exit 0), `pnpm test:run` (151 files / 1437 tests) green; harness-policy PASS; PR opened with evidence; deliverable report with the perceived-delay audit table.
