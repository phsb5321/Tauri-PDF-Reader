# Checklist 011 — TTS Highlight Store Tests

- [x] **Hexagonal boundaries** — test-only, under `src/__tests__/`; no boundary crossed.
- [x] **No direct `invoke()`** — store actions only; no IPC in the test.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — none; synthetic `WordTiming` fixtures.
- [x] **Offline behavior** — unaffected (no production code).
- [x] **Frontend tests** — 14 new tests, all pass; `pnpm typecheck` clean.
- [x] **No production code change** — test-only.
- [n/a] **Backend tests / build** — frontend-only slice.
- [x] **Accessibility impact** — none.
- [x] **Coverage** — covers a previously-0% store; threshold unchanged (009 owns the gate; bump floor when 009 merges).
- [x] **Rollback** — `git revert` (test-only).
- [ ] **Codex review** — pending; no unresolved BLOCKER/MAJOR at close.
