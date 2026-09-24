# Plan

## Technical Context

The open mutex lives in `src/stores/document-store.ts`
(`beginOpenTransaction`, added in #185): a module-level
`openTransactions`/`openGeneration` pair, fail-fast — a second caller gets
`null` and every caller renders
`OPEN_BUSY: Wait for the current PDF to finish opening.` into the store
`error` (`useOpenPdf.ts:208,252,305`, `usePdfDropSession.ts:125`).
`PdfViewer.tsx:937` short-circuits `if (error) return <full-screen error div>`
regardless of a loaded document, and `:906-925` returns a skeleton whenever
`isLoading` — so any open attempt hides the current canvas.
`ReaderView.tsx` already renders a dismissible `library-error-banner`
(role=alert) for the store error. Codes double as control-flow signals:
`HASH_MISMATCH` substring routes reauthorization (`useOpenPdf.ts:123,335`),
`isScopeDenial` classifies scope errors. `openAuthorizedPath` returns the
import pair with `deferCommit` (B1 repair) — the visible commit is already a
single point. Baseline `adf01e2`.

## Smallest integration sequence

1. `document-store.ts` — make `beginOpenTransaction()` ALWAYS succeed and
   return `{ generation, isSuperseded, release }`. Every acquisition bumps
   `openGeneration` (the newest transaction owns the store); a stale lease's
   `release()` is a no-op; `isLoading` stays true until the LIVE lease
   releases. The transaction primitive (one live lease, mirrored `isLoading`)
   is preserved; only refusal becomes supersession.
2. New `src/lib/user-message.ts` — `friendlyError(message)`: strips a leading
   `CODE: ` prefix (internal code) and returns the friendly remainder;
   identity for already-friendly strings.
3. `useOpenPdf.ts` — `openPdf`/`openDroppedPdf`/`resumeDocument` acquire the
   lease (never refused) and pass it through `openAuthorizedPath` and
   `reauthorizeAccess`; supersede checks: after the dialog returns, before any
   import read, and at the single visible-commit point (`showInReader`). A
   superseded transaction returns silently — no `setError`, no commit. All
   `setError` call sites go through `friendlyError` (codes stay on thrown
   errors for routing).
4. `usePdfDropSession.ts` — drop the `DROP_BUSY`/in-flight guard: a second
   drop acquires the lease (superseding), the superseded transaction rolls
   back its created session silently and never calls `onError`/`onSessionCreated`.
   `isImporting` clears only for the live lease. `DROP_INVALID` copy becomes
   friendly; the `DROP_FAILED:` prefix is dropped (`friendlyError`).
5. `PdfViewer.tsx` — render gate becomes: empty state when nothing loaded and
   idle; skeleton only when `isLoading && !pdfDocument`; full-screen error
   only when `error && !pdfDocument`. With a document loaded, the canvas
   stays; the store error surfaces through the existing ReaderView banner.
6. Tests (same commit as behavior — the repo's #108 trap): rewrite the
   `OPEN_BUSY`/`DROP_BUSY` assertions as supersede assertions; rework the
   property command model to latest-wins; add the render-gate + no-raw-code
   test.
7. Speed-of-light audit of the user-perceived loops — recorded in the
   deliverable report only (roadmap backlog).

## Provenance / gates

Authored by the P0 code seat (DeepSeek v4 pro) of the Lectrice wave
2026-09-23. vm103 CI is down (hardware): local gates
`pnpm lint && pnpm typecheck && pnpm test` are the evidence; the PR queues
behind the merge shepherd. Revert path: one `git revert` of the squash-merge.
