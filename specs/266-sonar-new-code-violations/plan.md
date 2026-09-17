# Plan — 266-sonar-new-code-violations

## Technical Context (completed)

- Stack: TypeScript 5.6 + React 18.3 + Vitest (frontend slice only; no Rust changes).
- Branch `266-sonar-new-code-violations` off `182b136`; single quality PR; husky hooks
  enforce lint-staged/prettier/tsc on every commit.
- Sonar rules are enforced by the scanner, not eslint; no `sonar.issue.ignore.*`,
  quality-gate, or workflow edits are permitted (honest fixes only).
- `<output>` has the implicit `status` role, so `getByRole("status")` queries keep working;
  static contract test `native-html-semantics.test.ts` gains the ParagraphActionOverlay
  fieldset/legend rows.
- Complexity refactors are pure-equivalence closure/helper extractions; decision order is
  preserved exactly (verified per function during the edit).

## Execution Constitution

- Spec-kit governance: mandatory (15-file product-adjacent slice).
- Implementation: pB (this seat); validators: vitest/fuzz/lint/typecheck/harness/CI/Sonar.
- Resource-conscious: single-fork vitest, bounded timeouts, sequential heavy commands.

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
