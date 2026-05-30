# Checklist 015 — TTS Store Tests

- [x] **Hexagonal boundaries** — test-only under `src/__tests__/`.
- [x] **No direct `invoke()`** — store is pure; no IPC.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — synthetic chunk fixtures; no keys/paths.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — 21 tests pass; `pnpm typecheck` clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only.
- [x] **Accessibility impact** — none (covers the native-TTS rate clamp + chunk navigation).
- [x] **Coverage** — covers a previously-0% store; threshold unchanged (009 owns the gate).
- [x] **Rollback** — `git revert` (test-only).
- [x] **Codex review** — acceptable, 0 BLOCKER/MAJOR; MINOR coverage gaps closed with discriminating tests.
