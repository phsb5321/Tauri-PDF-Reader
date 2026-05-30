# Checklist 013 — Library Store Query Tests

- [x] **Hexagonal boundaries** — test-only under `src/__tests__/`.
- [x] **No direct `invoke()`** — pure derivation tested; async IPC actions out of scope.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — synthetic Document fixtures; no real paths/keys.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — 11 new tests pass; `pnpm typecheck` clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only.
- [x] **Accessibility impact** — none.
- [x] **Coverage** — covers a previously-0% store; threshold unchanged (009 owns the gate).
- [x] **Rollback** — `git revert` (test-only).
- [x] **Codex review** — 2 rounds → pass; r1 MAJOR (recent-sort not discriminating) fixed; 0 unresolved.
