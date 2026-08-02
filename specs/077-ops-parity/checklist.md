# Checklist 077 — Session-only provider secret

- [x] Audit marker emitted before project mutation.
- [x] Worktree path ends in `-077-ops-parity`; main remains read-only.
- [x] Product classes the key S4 and PDF-derived text P3.
- [x] Quality/local-control gaps remain explicit and unclaimed.
- [x] Legacy version-0 payload cannot rehydrate a key.
- [x] Missing-version and current-version-1 injected-key payloads are rewritten
      as canonical version-1 raw bytes with no key.
- [x] Current persisted payload contains no key but retains safe preferences.
- [x] Mocked settings/SQLite persistence calls contain zero canary occurrences.
- [x] Fresh production-store hydration after setting a key yields null key,
      zero auto-initialization and re-entry-required UI.
- [x] Reset wording/behavior does not claim backend disconnection.
- [x] Disclosure names ElevenLabs and PDF-text egress, associated accessibly.
- [x] Key input is password-masked by default; accessible show/hide state tracks
      the actual input type.
- [x] Close/cancel/visibility cause zero initialization calls.
- [x] Rapid duplicate Connect causes exactly one initialization call.
- [x] Tests use invalid synthetic canary and mocked ports; no network/native.
- [x] No backend, schema, capability, workflow, sync, Notes or dependency diff.
- [x] Targeted lint, typecheck, tests, formatting and diff checks green.
- [ ] Product and Quality typed reviews bind the immutable head.
- [ ] Different-family typed verdict binds exact base/head/diff.
- [ ] Safe PR merged and confirmed `state=MERGED`, or honestly blocked before push.

**Rollback:** `git revert <077-squash-sha>` in one PR.

## Engineer RED/GREEN receipts

- RED storage: `pnpm exec vitest run src/__tests__/unit/ai-tts-persistence.test.tsx --pool=forks --poolOptions.forks.singleFork=true` — exit 1; 1 file, 5/5 failed. The version-0 canary rehydrated, triggered one `aiTtsInit` call, current persistence remained version 0 with four fields, reset retained the canary and fresh hydration entered the auto-init loop.
- RED component: `pnpm exec vitest run src/__tests__/ui/AiTtsSettings.test.tsx --pool=forks --poolOptions.forks.singleFork=true` — exit 1; 1 file, 3/3 failed at the absent stable visibility/form/close boundaries.
- GREEN targeted tests: `pnpm exec vitest run src/__tests__/unit/ai-tts-persistence.test.tsx src/__tests__/ui/AiTtsSettings.test.tsx --pool=forks --poolOptions.forks.singleFork=true` — exit 0; 2 files, 8/8 passed.
- Targeted ESLint on the two production and two test files — exit 0; 0 errors and 3 pre-existing `console.debug` warnings in `ai-tts-store.ts`.
- `pnpm typecheck` — exit 0.
- Targeted Prettier on all six changed files and `git diff --check` — exit 0.

## Engineer repair receipts (parent `deb7705d`)

- Product MAJOR packet SHA-256: `e3f5c494e6d86e7bbb59622bbc862aa3b9828aaa8ca39755ce8b258850a678f1`.
- RED persistence: `pnpm exec vitest run src/__tests__/unit/ai-tts-persistence.test.tsx --pool=forks --poolOptions.forks.singleFork=true` — exit 1; 1 file, 2 failed and 5 passed. Both the no-version and current-version-1 shapes hydrated to a null key with zero `aiTtsInit`, then failed because raw local storage still contained `INVALID-077-CANARY-DO-NOT-USE-PLAINTEXT-API-KEY`.
- GREEN persistence: the same command — exit 0; 1 file, 7/7 passed. Both raw shapes end as version 1 with safe preferences and zero canary across local/session/settings/SQLite evidence.
- Repair ESLint: `pnpm exec eslint src/stores/ai-tts-store.ts src/__tests__/unit/ai-tts-persistence.test.tsx` — exit 0; 0 errors and the same 3 pre-existing `console.debug` warnings.
- `pnpm typecheck` — exit 0.
- Final targeted tests: `pnpm exec vitest run src/__tests__/unit/ai-tts-persistence.test.tsx src/__tests__/ui/AiTtsSettings.test.tsx --pool=forks --poolOptions.forks.singleFork=true` — exit 0; 2 files, 10/10 passed.
- Targeted Prettier on the four repair files and `git diff --check` — exit 0.
