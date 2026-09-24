# Open instantly — latest-wins opening, no raw codes, no canvas clobber (294)

## User Scenarios & Testing

### US1 — A new open supersedes the one in flight (P0)

Opening a second PDF while another is still opening SUPERSEDES the in-flight
transaction: the older import is aborted (its visible commit is dropped), the
new one proceeds immediately, and the reader lands on the NEWEST request.
There is no busy error, no queue, and no visible wait. The #185 data-integrity
guarantee holds: only the latest transaction may commit to visible reader
state; a superseded import may still land a durable library row (the B1
contract already blesses durable rows — a re-drop reuses the known row), but
it never touches the screen, the page, or the session. When the superseded
request is a native-dialog open, the dialog result is silently discarded
after it returns (true cancellation of a modal native dialog is not possible
from JS; the silent-discard path is the fallback the defect contract names).

### US2 — Errors never clobber a loaded document (P0)

A full-screen "Error Loading PDF" (or loading skeleton) appears ONLY when no
document is loaded. When a document is loaded, a failed open/import surfaces
as the existing dismissible banner (`library-error-banner`, role=alert) and
the canvas keeps showing the current document — same document, same page.
The screenshot's failure — toolbar shows "Redes de Computadores 6a Edicao,
page 1/1153" while the canvas shows the error — is impossible after this
slice.

### US3 — Internal codes never reach a user-visible string (P0)

`OPEN_BUSY`, `DROP_BUSY`, `DROP_INVALID`, `DROP_FAILED`, `OPEN_CANCELLED`,
`WRONG_DOCUMENT`, `PDF_HASH_MISMATCH` (and the session codes surfaced through
the drop flow) never appear in the error banner, a drop status message, or any
other rendered string. Codes remain on THROWN errors (internal control-flow
signal: `HASH_MISMATCH` routing, scope-denial detection) and are stripped by a
single boundary helper (`friendlyError`) at every point a message crosses into
user-visible territory.

### US4 — Drop latest-wins, silent supersede, silent rollback (P1)

A second PDF dropped while a drop-session transaction is in flight supersedes
it: the first transaction silently rolls back its created session (no error
toast, no success banner) and the second becomes the live transaction. Invalid
drops (non-PDF, multi-file) still refuse before any mutation, now with
friendly copy and no code prefix.

### US5 — Speed-of-light audit (P1, record only)

After US1–US4, audit the user-perceived latency loops (open, page nav, zoom,
search, play/narration start, settings) and record latency source + proposed
fix per loop in the deliverable report. No further code in this slice; the
items become roadmap backlog.

## Acceptance

- `src/hooks/useOpenPdf.test.ts` — new oracle: a second open while one is in
  flight supersedes it (second wins, first aborted, NO error set, store error
  never contains `OPEN_BUSY`); the `OPEN_BUSY`-asserting cases at :174/:190/
  :252 are replaced, not kept.
- `src/hooks/usePdfDropSession.test.ts` — new oracle: second drop supersedes
  (first rolls back its session silently, no `DROP_BUSY`/`DROP_FAILED` noise);
  :250's busy assertion replaced.
- `src/hooks/usePdfDropSession.property.test.ts` — seeded command model
  reworked to the latest-wins world: at most one transaction COMMITS,
  superseded transactions roll back silently, `isLoading` mirrors the live
  lease, and the no-busy / no-raw-code invariants hold after every op.
- New `src/__tests__/ui/pdf-viewer-error-gate.test.tsx` — render-gate oracle:
  error with no document → full-screen error; error with a loaded document →
  canvas view stays, banner carries friendly copy; no rendered string matches
  `/^[A-Z_]+: /`.
- `pnpm lint && pnpm typecheck && pnpm test` green (evidence pasted in PR).

## Boundaries

- Frontend only: `src/stores/document-store.ts`, `src/hooks/useOpenPdf.ts`,
  `src/hooks/usePdfDropSession.ts`, `src/components/PdfViewer.tsx`, new
  `src/lib/user-message.ts`, and the four test files above. No `invoke()`
  outside `src/adapters/tauri`; domain imports unchanged; eslint boundaries
  untouched.
- TTS-side error codes (`TTS_TEXT_BOUND`, `TTS_PAGE_NOT_READY`, …) live in a
  different store/flow and are out of scope — recorded in the speed-of-light
  audit backlog.
- Backend (Rust) unchanged: the mutex never was a backend guard; the backend
  session-restore authority keeps its role.
- vm103 CI is down (hardware): PR opens to queue behind the merge shepherd;
  no CI-green claim.
