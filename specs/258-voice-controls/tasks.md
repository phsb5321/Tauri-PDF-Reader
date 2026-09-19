# 258 — Tasks

Task ids added at landing so the branch-bound harness policy can read them;
wording and state are the frozen worker's own.

- [x] T258-1 Verify write root (35801daa, branch 258-voice-controls, clean).
- [x] T258-2 Read current AiVoiceSelector + hook/store/data contract + usage sites.
- [x] T258-3 Author `AiVoiceSelector.tsx`: useId per instance, optgroup provider
      grouping, strict value binding + placeholder, truthful
      error/loading/empty states, pending-only busy, store-truth outcomes.
- [x] T258-4 Author `AiVoiceSelector.css`: token-based states, focus-visible,
      pending/disabled feedback, reduced-motion, narrow-width shrink.
- [x] T258-5 Author scoped synthetic test (8 checks; hook mocked to the production
      resolve-void contract; scoped locators).
- [x] T258-6 p16 corrections r1: resolve-void contract (no Promise-success claim),
      unique dual-mount ids, strict value binding + placeholder.
- [x] T258-7 p16 state-precedence corrections: connecting visible while
      uninitialized; error precedence over empty; visible error text beside
      populated selector (backs aria-invalid); +2 matching tests (10 total).
- [x] T258-8 p16 16:50 readback applied: precedence block verified present in source
      (connecting/errorMessage declared before both uses); empty-case fixture
      pinned all-connected; store-error test pins allConnected (no fixture
      leak). 10 checks.
- [x] T258-9 Freeze hashes + single READY to 251 (herdr-prompt).
- [ ] T258-10 251 slot: run scoped check + Sol exact-head review (not this seat).
- [ ] T258-11 Repairs: none granted until a failing receipt (max 2 measured).
