# 258 — Tasks

- [x] Verify write root (35801daa, branch 258-voice-controls, clean).
- [x] Read current AiVoiceSelector + hook/store/data contract + usage sites.
- [x] Author `AiVoiceSelector.tsx`: useId per instance, optgroup provider
      grouping, strict value binding + placeholder, truthful
      error/loading/empty states, pending-only busy, store-truth outcomes.
- [x] Author `AiVoiceSelector.css`: token-based states, focus-visible,
      pending/disabled feedback, reduced-motion, narrow-width shrink.
- [x] Author scoped synthetic test (8 checks; hook mocked to the production
      resolve-void contract; scoped locators).
- [x] p16 corrections r1: resolve-void contract (no Promise-success claim),
      unique dual-mount ids, strict value binding + placeholder.
- [x] p16 state-precedence corrections: connecting visible while
      uninitialized; error precedence over empty; visible error text beside
      populated selector (backs aria-invalid); +2 matching tests (10 total).
- [x] p16 16:50 readback applied: precedence block verified present in source
      (connecting/errorMessage declared before both uses); empty-case fixture
      pinned all-connected; store-error test pins allConnected (no fixture
      leak). 10 checks.
- [x] Freeze hashes + single READY to 251 (herdr-prompt).
- [ ] 251 slot: run scoped check + Sol exact-head review (not this seat).
- [ ] Repairs: none granted until a failing receipt (max 2 measured).
