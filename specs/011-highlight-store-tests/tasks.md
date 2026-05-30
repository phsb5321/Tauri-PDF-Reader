# Tasks 011 — TTS Highlight Store Tests

- [x] T001 Worktree `011-highlight-store-tests` off origin/main (7c5de09).
- [x] T002 Inspect `tts-highlight-store.ts` (Zustand state machine, 0% covered) + `WordTiming` shape + test conventions.
- [x] T003 Add `src/__tests__/unit/tts-highlight-store.test.ts` — 15 tests (actions, guards, selectors).
- [x] T004 Verify: `pnpm install` + `pnpm exec vitest run tts-highlight-store` (15 pass) + `pnpm typecheck` (rc=0).
- [x] T004b Strengthen per Codex r1: assert resume re-anchor formula via stubbed `performance.now`; add pause-guard (playbackStartTime null) + subscription-based updateCurrentWord no-op tests.
- [ ] T005 Codex adversarial review (round 2) -> `.claude/reviews/011-*`.
- [ ] T006 Update `docs/agent-backlog-state.md`.
- [ ] T007 Commit on `011-highlight-store-tests` (no push; commit with pnpm on PATH so the husky hook runs).
