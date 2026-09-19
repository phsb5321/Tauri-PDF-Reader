# Tasks — 257 page controls

Task ids added at landing so the branch-bound harness policy can read them;
wording and state are the frozen worker's own.

- [x] T257-1 Read COMMON.md + p18.md; verify locked worktree at `35801daa`.
- [x] T257-2 Trace `usePageNavigation` + baseline `PageNavigation`; confirm double
      dispatch, parseInt acceptance, same-page re-fire, draft survival bugs.
- [x] T257-3 Implement deliberate draft policy in `PageNavigation.tsx` (safe-integer
      full-string parse, single commit funnel, clamped-target guard, Escape
      cancel, store+document sync invalidation, exact a11y name restored).
- [x] T257-4 Token-only CSS: focus-visible parity, reduced-motion, width, narrow clamp.
- [x] T257-5 Scoped `PageNavigation.test.tsx` (12 scenarios incl. p16 corrective
      acceptance cases, signed-input policy mark, LECT-130 gap left unaccepted).
- [x] T257-6 spec.md / plan.md / tasks.md (this set) + reports/DELIVERY.md.
- [ ] T257-7 251 serialized slot run of the scoped check (BLOCKED until grant).
- [ ] T257-8 Exact-head Codex Sol review (GLM-authored), then lead-gated sequencing.
