# Spec 203 — Import transaction: fail-closed restore + shared open-mutex lifetime

Branch: `203-import-qol` (stacked on `177-library-completeness` @ 951c342, PR #178)
Issue: phsb5321/Tauri-PDF-Reader#185 — follow-ups 1 and 3 only (bounded slice).
Out of scope: #184 filesystem scope; library/shelf CSS; cockpit/zoom; backend permissions; `.github`; receipt schemas; #185 follow-up 2 (Toolbar accessible title — library worker's CSS scope, communicated 08/09/2026, not needed by this slice).

## Problem

Two holes in the drop-to-session transaction, both recorded by the #177 final review:

1. **`SessionRestoreResponse.success === false` is ignored everywhere.** The backend
   `session_restore` returns `success=false` as a _valid_ response (not an `Err`),
   but `session-store.restoreSession` commits `activeSession` without looking at it,
   `usePdfDropSession.handleDrop` proceeds to `onSessionCreated` (reader swaps to the
   new document, success toast) and `SessionMenu` proceeds to open the session's
   document. A failed restore looks exactly like a successful one.
2. **The shared open mutex releases before the transaction is complete.** The open
   mutex is the document-store `isLoading` flag guarded at entry by `openPdf` /
   `openDroppedPdf` (OPEN_BUSY). `openDroppedPdf` releases it in its `finally` when
   the import ends — but `handleDrop` still has to run `createSession` →
   `restoreSession` → `onSessionCreated`. A rapid second public action in that
   window (Ctrl+O, library resume) re-opens a different document while the drop
   transaction is still mid-flight: the reader ends on the wrong document under the
   newly activated session. `resumeDocument` (library/session resume) has **no**
   busy guard at all today, so it interleaves even mid-import.

## Hypothesis (accepted diagnosis, #185)

The current lock releases before the import/session transaction is complete, so a
rapid second public action can race its completion; shared transaction lifetime plus
success validation eliminates this without a new queue abstraction.

## Fix

Single shared authority per concern, no queue abstraction:

- **Open mutex lifetime** (`src/stores/document-store.ts`): add
  `beginOpenTransaction(): (() => void) | null` — a fail-fast try-lock on a module
  counter that mirrors `isLoading`. `null` = busy (existing OPEN_BUSY semantics,
  preserved byte-for-byte for existing tests). Acquire sets `isLoading: true`;
  release clears it when the count reaches 0. `reset()` zeroes the counter
  (generation token guards stale releases).
- **Entry points** (`src/hooks/useOpenPdf.ts`): `openPdf`, `openDroppedPdf`,
  `resumeDocument` each hold one transaction for their whole body (dialog and
  reauthorization included). `resumeDocument` gains the missing busy guard
  (OPEN_BUSY + `false`) — this extends the mutex across library/session resume.
- **Drop transaction** (`src/hooks/usePdfDropSession.ts`): after the import phase
  (already mutex-protected by `openDroppedPdf`), `handleDrop` re-acquires the
  transaction in the same microtask chain (no event handler can run between the
  release and the re-acquire) and holds it across `createSession` →
  `restoreSession` → `onSessionCreated`, releasing in `finally`.
- **Fail closed on success=false** (`src/stores/session-store.ts`, the shared
  restore authority): `restoreSession` throws
  `SESSION_RESTORE_FAILED: …` _before_ committing `activeSession`/`missingDocuments`,
  sets the store error, and clears `isRestoring`. Callers traced:
  - `usePdfDropSession` → existing catch rolls back the created session and
    surfaces `DROP_FAILED: SESSION_RESTORE_FAILED: …` (error banner, role=alert).
  - `SessionMenu.handleRestoreSession` → existing catch; the store error renders in
    `.session-menu__error`; `onSessionRestored` never fires, so the shell never
    opens a document and the reader keeps its current document/progress.
  - `ReaderView.handleSessionRestored` → unreachable on failure (propagates through
    the two callers above).

Retry state: the reader stays on the current document, the broken session is rolled
back, and the error names the code — re-dropping the PDF retries the whole
transaction.

## User Scenarios & Testing

### User Story 1 — a failed session restore must never look like success (P1)

A reader drags a PDF whose session restore fails on the backend (a valid
`success=false` response). Today the reader is swapped to the new document with a
success toast. After this slice the reader stays exactly where it was, the broken
session is removed, and an explicit `SESSION_RESTORE_FAILED` error surfaces
(banner in the drop flow, `.session-menu__error` in the Sessions menu).

**Why P1:** a false-success silently files reading progress under a session that
cannot be restored — data-integrity adjacent, and the reader has no way to know.

**Independent test:** store-level `restoreSession` rejection + shell test (no
document opened, error visible) + drop-flow rollback assertion.

### User Story 2 — rapid actions cannot interleave an import transaction (P1)

A reader drops a PDF; while the import's session create/restore is still in
flight, they click a library row (or Ctrl+O). Today `resumeDocument` has no busy
guard and the drop mutex releases before the transaction completes, so the second
action lands a different document under the just-activated session. After this
slice one lease spans the whole transaction and every public open holds it for
its body: the second action is refused with OPEN_BUSY/DROP_BUSY and can retry.

**Why P1:** the wrong-document-under-wrong-session race is exactly the class of
progress corruption the reader's transaction model exists to prevent.

**Independent test:** deferred-promise interleaving falsifier at the old
release/re-acquire boundary + seeded command model (seed 20260908).

### User Story 3 — packaged drop journey pins document rows (P2)

The packaged valid/invalid OS-drag journey must pin the documents-table count
(2 legacy + 1 dropped; invalid drop adds none), not only sessions/members —
#185 follow-up 5's observer concern, realized in the existing
`e2e-library-completeness.sh` runner receipt.

**Why P2:** completes the packaged evidence so a rejected drop provably mutates
no table.

**Independent test:** runner assertions + `dropDbCounts` receipt block.

### Edge Cases

- Restore resolves `success=false` with `missingDocuments` non-empty → still
  fails closed; missing-document reporting only happens on real success.
- Busy refusal during the drop overlay → reader sees DROP_BUSY/OPEN_BUSY, can
  retry after the transaction settles; no queue, no silent drop.
- Direct `openDroppedPdf` callers (not the drop flow) still get the self-acquire
  busy guard and unchanged OPEN_BUSY error.

### Requirements

- **FR-1:** `session-store.restoreSession` MUST reject with `SESSION_RESTORE_FAILED`
  when `SessionRestoreResponse.success === false`, before committing
  `activeSession`/`activeSessionId`/`missingDocuments`, and set the store error.
- **FR-2:** the shared open mutex MUST be held from import start through
  `onSessionCreated` for the drop flow — one continuous lease, no
  release/re-acquire gap.
- **FR-3:** `openPdf`, `openDroppedPdf`, and `resumeDocument` MUST hold the open
  lease for their whole body; `resumeDocument` MUST refuse while busy (OPEN_BUSY).
- **FR-4:** the drop flow MUST consume the authority's rejection and roll back
  the created session, surfacing `DROP_FAILED: SESSION_RESTORE_FAILED`.
- **FR-5:** the packaged runner MUST pin documents/sessions/members counts for
  valid and invalid OS drags.

### Success Criteria

- Five fail-first tests red before the fix, green after (interleaving falsifier,
  store authority, shell failure UI, resume guard, seeded property model).
- All pre-existing targeted tests stay green; no assertion weakened.
- `pnpm lint`, `pnpm typecheck`, and the bounded targeted Vitest run pass.

## Acceptance (executable)

1. **Fail-first deferred-promise interleaving test** (`usePdfDropSession.test.ts`):
   with `createSession` held on a deferred promise, a concurrent `resumeDocument`
   (real `useOpenPdf`, real document store) is refused with OPEN_BUSY and never
   loads bytes; after resolution the drop transaction completes normally. Red
   before the fix, green after.
2. **success=false fail-closed** (`usePdfDropSession.test.ts`): restore resolving
   `{ success: false }` → no `onSessionCreated`, created session deleted, explicit
   `DROP_FAILED: SESSION_RESTORE_FAILED` error. Red before, green after.
3. **Shared restore authority** (`session-flow.test.ts`): store `restoreSession`
   with `success=false` rejects, `activeSession` stays `null`, error set.
4. **Resume busy guard** (`useOpenPdf.test.ts`): resume while the store is busy →
   `false` + OPEN_BUSY + no bytes loaded. Red before, green after.
5. **Seeded command-model coverage** (`usePdfDropSession.property.test.ts`): model
   of the transaction (drop / drop-while-busy / restore-fail / success) with seed
   `20260908`; invariants: at most one transaction in flight; session never active
   after `success=false`; invalid drops mutate nothing.
6. Existing assertions preserved: OPEN_BUSY race test on `openDroppedPdf`,
   DROP_BUSY single-drop test, session rollback test, session-flow restore tests
   (`success: true` paths), session-restore shell test.
7. `pnpm lint`, `pnpm typecheck`, targeted Vitest (single fork) green.

## User gate (lectrice-user-gate)

Unit/model tests above + packaged valid/invalid OS-drag DB counts (documents as
well as sessions/members) require the native OS-drop actor in the packaged app.
No JS-dispatched drop events may substitute for the OS drop seam. **If the native
OS-drop actor is not available to this seat, the packaged slice is BLOCKED** —
recorded in `reports/import.md`, journey handed to QA (`lectrice-qa-204`), never
skipped-green.
