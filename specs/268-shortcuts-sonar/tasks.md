# Tasks 268 — shortcuts Sonar fix

- [x] T268-1 Read the Sonar findings on the 262 merge (`typescript:S1874` at
      `KeyboardShortcuts.tsx:27`, `typescript:S2301` at `:37`) and the coverage
      failure (`ReferenceError: window is not defined` from
      `useAnnounce.tsx:156`).
- [x] T268-2 Replace the deprecated platform read and the boolean-driver
      parameter; update the 262 test to stub the user agent.
- [x] T268-3 Track and cancel the announcement frame on unmount; add the
      teardown assertion.
- [x] T268-4 Executed: 8/8 (262 suite), 21/21 (announce suite), lint 0 errors,
      typecheck clean, `pnpm test:coverage` exit 0, negative control 10 failed /
      11 passed with the cancel removed.
- [ ] T268-5 CI green on this head, then squash-merge; verify the post-merge
      Sonar gate reports `new_violations = 0`.
