# Spec 266 — Sonar new-code violations: gate to green

## User Scenarios & Testing (completed)

**Primary story:** as an operator of the Lectrice delivery pipeline, after this slice
merges, the next post-merge Sonar analysis on `main` reports `new_violations = 0` and the
quality gate reads OK, with no exclusions, thresholds, or rule ignores touched.

**Verification:** touched vitest suites green; seeded fuzz (FC_SEED=20260915) green;
`pnpm lint` 0 errors; `pnpm typecheck` 0; `make harness-check` PASS; required CI green;
post-merge Sonar gate OK.

## Context

The self-hosted SonarQube gate (`phsb5321_lectrice`, post-merge alarm on `main`) fails on
`new_violations = 43 > 0`. Coverage (88.3 ≥ 80) and duplication (0.13 ≤ 3) conditions pass.
All 43 issues were enumerated from the live API at 22:5x BRT 16/09/2026 on `182b136`
(1 BLOCKER, 7 CRITICAL, 21 MAJOR, 14 MINOR across 15 files).

## Requirement

Pedro requires the analysis integration enforced with a green gate, not advisory badges.
`main` must report `new_violations = 0` (quality gate OK) without exclusions, thresholds
changes, or rule ignores — honest fixes only. `sonar.issue.ignore.*` and quality-gate
threshold edits are forbidden in this slice.

## Behavior contract (pure-equivalence where applicable)

1. **Idiom fixes (behavior-preserving):** `String#replaceAll` over `#replace` with global
   regex (S7781 ×5), `String.raw` for regex literals with backslashes (S7780 ×2), flattened
   nested ternaries (S3358 ×5), optional chaining (S6582 ×2), nullish coalescing and
   unnegated conditions (S6606/S7735 ×4), character-class simplification (S6397 ×1),
   removed index reassignment (S2310 ×1), grouped `Array#push` (S7778 ×1), no object-literal
   parameter default (S7737 ×1), `toReversed`/separate reverse statement (S4043 ×1).
2. **Accessibility semantics:** `role="status"` regions become `<output>` elements
   (S6819 ×5), the `"group"` role becomes a semantic landmark/container (S6819 ×1), form
   labels gain accessible text (S6853 ×4), non-interactive listeners moved to interactive
   elements or given keyboard-accessible targets (S6847 ×1). Visible copy only gains
   minimal, factual labels; no redesign.
3. **Cognitive-complexity refactors (pure-equivalence):** extract helpers / guard clauses so
   each flagged function measures ≤15 (S3776 ×7: PdfViewer.tsx:318, AiPlaybackBar.tsx:109+386,
   usePdfDropSession.ts:80, useTtsWordHighlight.ts:291, prosody-plan.ts:476,
   speech-normalization.ts:438). No behavior change; existing tests must pass unmodified in
   their assertions.
4. **Test BLOCKER:** `verify-receipt.test.ts:52` gains at least one direct assertion
   (S2699).

## Acceptance oracles

- `pnpm exec vitest run <touched suites>` green; full fuzz set (`FC_SEED=20260915`) green;
  `pnpm lint` 0 errors; `pnpm typecheck` 0; `make harness-check` PASS.
- Next post-merge Sonar analysis on `main`: `new_violations = 0`, gate OK.
- No `sonar.issue.ignore.*`, quality-gate, or workflow changes in the diff.

## Out of scope

All-history issues (1016 open, outside the new-code period), Rust/Swift analysis, the
optional packaged matrix lanes, and any new product feature.
