# Tasks 013 — Library Store Query Tests

- [x] T001 Worktree `013-library-store-tests` off origin/main (7c5de09).
- [x] T002 Inspect `library-store.ts` (getFilteredDocuments + selectors, 0% covered) + `Document` schema for fixtures.
- [x] T003 Add `src/__tests__/unit/library-store.test.ts` — 12 tests (search, 3 sorts + fallbacks, lastOpenedAt-wins, no-mutation, selectors); explicit `Document` map typing.
- [x] T004 Verify: `pnpm install` + `pnpm exec vitest run library-store` (12 pass) + `pnpm typecheck` (clean).
- [x] T004b Codex r1 MAJOR fix: added discriminating recent-sort test (lastOpenedAt wins over createdAt) + mixed-case filePath query.
- [ ] T005 Codex adversarial review (round 2) -> `.claude/reviews/013-*`.
- [ ] T006 Update `docs/agent-backlog-state.md`.
- [ ] T007 Commit on `013-library-store-tests` (no push; pnpm on PATH for the husky hook).
