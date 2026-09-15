# Plan 203 — Import transaction slice

Branch-bound: `203-import-qol`. Generator: GLM-5.3-Flash (chinese-frontier), bounded
public-code slice; external gate = Codex Sol on the frozen exact head; no merge
authority at this seat.

## Technical Context

- **Language/stack:** TypeScript 5.6+ (React 18.3, Zustand 5.x) frontend only.
  No Rust/backend changes — `session_restore`'s existing valid-response shape
  (`{ success, session, missingDocuments }`) is consumed, not altered; no
  bindings regeneration, no IPC contract change.
- **Shared state touched:** `document-store` (open mutex owner),
  `session-store` (restore authority), hooks `useOpenPdf` / `usePdfDropSession`.
- **Concurrency model:** single-threaded JS; a fail-fast counted lease
  (`beginOpenTransaction`) whose guard also honors an externally set `isLoading`
  flag so existing busy-simulation tests keep their semantics. `reset()`
  zeroes the count and bumps a generation so stale release thunks are no-ops.
- **Testing:** Vitest + Testing Library (jsdom), `@fast-check` property model,
  seeded (20260908) for deterministic replay; packaged WebKitGTK journey via the
  existing `e2e-library-completeness.e2e.mjs` dragon-drop + xdotool actor.
- **Constraints:** resource-conscious — targeted tests, one Vitest fork,
  shared heavy gate via `/tmp/lectrice-heavy-gate.lock`; no watch servers;
  no new dependencies; no queue abstraction.

## Constitution Check

- Hexagonal boundaries preserved: stores/hooks only; no adapter or domain
  changes; no direct `invoke()`.
- Fail-closed posture: `success=false` rejects before any state commit.
- No frozen receipt schema changes; runner receipt gains an additive
  `dropDbCounts` block only.
- Out of scope and untouched: #184 filesystem scope, library CSS, cockpit/zoom,
  `.github`, backend permissions.

## Sequence

1. **Fail-first tests** (red): write the four deferred/edge tests from spec.md
   §Acceptance 1–4 + seeded property test 5. Run targeted → capture red output as
   first evidence.
2. **Shared open mutex** (`document-store.ts`): `beginOpenTransaction` +
   generation-guarded release + `reset()` zeroing. Smallest possible surface; no
   queue.
3. **Entry points** (`useOpenPdf.ts`): swap `isLoading` check + `setLoading` pair
   for `beginOpenTransaction`/release in all three entries; add the missing
   `resumeDocument` guard. Error strings unchanged (`OPEN_BUSY: Wait for the
current PDF to finish opening.`).
4. **Drop transaction** (`usePdfDropSession.ts`): post-import re-acquire around
   create/restore/onSessionCreated; `success=false` → throw
   `SESSION_RESTORE_FAILED: …` (existing catch does rollback + DROP_FAILED).
5. **Shared restore authority** (`session-store.ts`): throw before committing
   state when `response.success === false`; error surfaces through the existing
   catch (store `error` + `isRestoring: false`).
6. **Green pass**: targeted Vitest single fork under `/tmp/lectrice-heavy-gate.lock`,
   then `pnpm lint` + `pnpm typecheck`. Two repair rounds max.
7. **Evidence + delivery**: docs/evidence/203-\*, reports/import.md checkpoint
   (early) + final, commit/push, stacked PR vs `177-library-completeness`,
   notify coordinator (exact SHA/journey) for the dedicated QA/gate seat and
   delivery inventory.

## Risks

- Existing tests that set `isLoading` via `setState` to simulate busy must keep
  passing → guard checks both counter and flag.
- `reset()` between tests must fully clear the mutex (generation token).
- No Rust/bindings changes → no `tauri dev` regeneration, no cargo runs needed.
