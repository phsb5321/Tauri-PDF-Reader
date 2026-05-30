# Tasks 015 — TTS Store Tests

- [x] T001 Worktree `015-tts-store-tests` off origin/main (7c5de09).
- [x] T002 Inspect `tts-store.ts` (pure chunk-queue state machine, 0% covered) + `TtsInitResponse`/`VoiceInfo` shapes.
- [x] T003 Add `src/__tests__/unit/tts-store.test.ts` — 21 tests (rate clamp, init mapping, queue ops, setCurrentChunk branches, navigation bounds, selectors, reset).
- [x] T004 Verify: `pnpm install` + `pnpm exec vitest run tts-store` (21 pass) + `pnpm typecheck` (clean).
- [x] T005 Codex review (acceptable, no BLOCKER/MAJOR) → added discriminating tests for its MINORs (nextChunk middle, unknown-id, out-of-range, selector true+false).
- [ ] T006 Update `docs/agent-backlog-state.md`.
- [ ] T007 Commit on `015-tts-store-tests` (no push; pnpm on PATH for the hook).
