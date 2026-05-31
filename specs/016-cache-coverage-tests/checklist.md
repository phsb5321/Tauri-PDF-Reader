# Checklist 016 — Cache Coverage Domain Tests

- [x] **Hexagonal boundaries** — pure domain test under `src/__tests__/`.
- [x] **No direct `invoke()`** — domain has no IPC.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — none.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — ~18 tests; `pnpm typecheck` clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only.
- [x] **Accessibility impact** — none.
- [x] **Coverage** — covers a previously-0% pure module; raises coverage (no floor risk; stacked on 009's ratchet).
- [x] **Rollback** — `git revert` (test-only).
- [ ] **Codex review** — pending; no unresolved BLOCKER/MAJOR at close.
