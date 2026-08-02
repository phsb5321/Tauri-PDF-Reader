# Tasks 077 — Session-only provider secret

## Audit and ownership

- [x] T001 Orchestrator captured Product/Quality audit receipts and emitted
      `OPS-PARITY-AUDITED` before mutation.
- [x] T002 Orchestrator created the canonical isolated 077 worktree from
      `origin/main` and seeded SpecKit plus the durable owner map.
- [x] T003 Engineer feasibility audit recorded current integration seams,
      Gitleaks 8.30.1 CLI caveat and consolidation constraints.
- [x] T004 Engineer confirms sole-writer receipt and exact implementation paths.

## User Story 1 — session-only key

- [x] T010 [US1] Add a RED targeted test that hydrates a version-0
      `ai-tts-storage` canary and proves the current code leaks it.
- [x] T011 [US1] Add a RED targeted test that setting a current key serializes
      it while non-secret preferences remain persistable.
- [x] T012 [US1] Record every mocked settings/SQLite persistence call and prove
      the canary occurs zero times without adding backend/schema work.
- [x] T013 [US1] After setting the key, hydrate a fresh production store and
      prove `apiKey === null`, zero auto-initialization and re-entry-required UI.
- [x] T014 [US1] Add the minimal versioned migration/current partialization that
      strips legacy keys and excludes current keys; make reset session-honest.
- [x] T015 [US1] Run the storage tests GREEN; record exact counts/exits.
- [x] T016 [US1] Add RED raw-storage cases for a missing version and current
      version 1 with an injected key; both fail only on retained canary bytes.
- [x] T017 [US1] Canonicalize every successful hydration through Zustand's
      wrapped persistence action without exposing the key or looping hydration.
- [x] T018 [US1] Run the repaired persistence and final targeted tests GREEN;
      record exact counts, raw-byte evidence and exits.
- [x] T019 [US1] Plant malformed canary bytes RED, then remove the corrupt entry
      on hydration error while retaining safe defaults and zero initialization.

## User Story 2 — accessible remote boundary

- [x] T020 [US2] Add a RED component test for visible/provider-specific
      PDF-text egress disclosure, field association, stable control names/state,
      password-masked default, zero calls before Connect/on cancel, and exactly one
      call under rapid duplicate Connect submission.
- [x] T021 [US2] Add the minimum disclosure and accessible control semantics;
      rename ambiguous input clearing without claiming backend disconnection.
- [x] T022 [US2] Prove the visibility control changes both input type and its
      accessible pressed/state value.
- [x] T023 [US2] Run the component test GREEN; record exact counts/exits.

## Verification and review

- [x] T030 Run targeted ESLint on changed TS/TSX/tests.
- [x] T031 Run `pnpm typecheck`.
- [x] T032 Run only the two targeted test files with one worker/fork.
- [x] T033 Run formatting and `git diff --check`; commit locally, do not push.
- [x] T034 Product re-reviews acceptance at the immutable SHA.
- [x] T035 Quality checks canary discrimination, no false privacy claim and no
      forbidden workflow/sync/backend scope.
- [x] T036 Save a different-family verdict bound to exact base/head/diff. Stop
      if unavailable; do not relabel Sol/Terra as independent.
- [x] T037 Orchestrator owns PR/CI/merge only after T034–T036 are clean.

## Deferred, not completed

- [ ] T100 `[pending] Pedro`: authorize any future workflow change.
- [ ] T101 `[pending] Pedro`: authorize Notes/repo sync activation or a new
      repo/token/service/secret proposal.
- [ ] T102 Next local control slice: current-CLI Gitleaks config plus synthetic
      canary; use Gitleaks 8.30.1 `dir`/`git`, not removed `protect` syntax.
