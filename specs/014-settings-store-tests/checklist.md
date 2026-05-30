# Checklist 014 — Settings Store Tests

- [x] **Hexagonal boundaries** — test-only under `src/__tests__/`.
- [x] **No direct `invoke()`** — Tauri IPC mocked; store actions tested via state.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — synthetic values; no real keys/paths; no live IPC.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — 15 tests pass; `pnpm typecheck` clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only.
- [x] **Accessibility impact** — none (covers the TTS-rate clamp that bounds the speed control).
- [x] **Coverage** — covers a previously-0% store; threshold unchanged (009 owns the gate).
- [x] **Rollback** — `git revert` (test-only).
- [x] **Codex review** — PASS, 0 BLOCKER/MAJOR; MINOR coverage gaps addressed by 4 added tests.
