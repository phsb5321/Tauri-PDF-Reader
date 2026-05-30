# Tasks 014 — Settings Store Tests

- [x] T001 Worktree `014-settings-store-tests` off origin/main (7c5de09).
- [x] T002 Inspect `settings-store.ts` (clamping, loadFromDatabase, reset, IPC setters) + constants.
- [x] T003 Add `src/__tests__/unit/settings-store.test.ts` — 15 tests, Tauri IPC mocked via `vi.mock`.
- [x] T004 Verify: `pnpm install` + `pnpm exec vitest run settings-store` (15 pass) + `pnpm typecheck` (clean).
- [x] T005 Codex review (PASS, no BLOCKER/MAJOR) -> added 4 tests for the noted MINOR gaps (syncToDatabase, highlight/voice setters).
- [ ] T006 Update `docs/agent-backlog-state.md`.
- [ ] T007 Commit on `014-settings-store-tests` (no push; pnpm on PATH for the hook).
