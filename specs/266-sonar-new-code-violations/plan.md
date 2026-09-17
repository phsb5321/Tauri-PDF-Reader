# Plan — 266-sonar-new-code-violations

Approach: single quality slice on top of `182b136`. One branch, one PR, verified by the
existing CI lanes plus the live Sonar gate after merge.

## Workflow

1. Implement per spec §Behavior contract, clustered: mechanical idioms first, then a11y
   semantics, then the seven S3776 refactors, then the test BLOCKER. Update any test that
   queries removed `role="status"` selectors to the new `<output>` element (behavior
   equivalent, same visible text).
2. After each cluster: targeted `vitest run` on touched suites (single-fork), keeping
   resource use low.
3. Final validation: `pnpm lint` (0 errors), `pnpm typecheck`, seeded fuzz
   (`FC_SEED=20260915`), `make harness-check`, husky hooks on commit.
4. Push → required CI green → squash-merge → post-merge Sonar run must report
   `new_violations = 0`.

## Risk notes

- S3776 refactors on AiPlaybackBar:386 (complexity 30) and PdfViewer.tsx:318 (25) are the
  only behavior-risk edits: extract pure helpers with identical decision order; no
  short-circuit reordering beyond equivalence.
- `<output>` default styling is inline; keep existing classes so layout is unchanged.
- Label text (S6853) must not invent product claims: use the existing control's visible
  name where present, otherwise a minimal factual label ("Narration delivery", etc.).
