# Checklist 017 — Pure-Domain Coverage

- [x] **Hexagonal boundaries** — pure domain tests under `src/__tests__/`.
- [x] **No direct `invoke()`** — domain has no IPC.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — synthetic fixtures only.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — 20 tests (3 files); full suite 506 pass; typecheck clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only.
- [x] **Accessibility impact** — none.
- [x] **Coverage** — covers 3 previously-0% pure modules (functions 53.82→56.28); stacked on 009's ratchet.
- [x] **Rollback** — `git revert` (test-only).
- [x] **Codex review** — Approve, 0 BLOCKER/MAJOR; 2 MINOR sharpeners added.
