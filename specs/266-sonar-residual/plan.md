# Plan — 266-sonar-residual

## Technical Context (completed)

- Rebased follow-up to #211 on `faeb7d2`; cherry-picked the residual delta (bd00b10).
- Complexity reduction uses SYNC closures only: an async helper yields a microtask even
  on its no-op path, which shifted `speakingRef` past concurrent stop/start interleaving
  and failed karaoke-sync (caught by lint-staged related tests).
- Sonar new-code tracking re-evaluates whole files after edits, so previously "old"
  nested ternaries inside edited files enter the gate window and must also be fixed.

## Execution Constitution

- Spec-kit governance: mandatory (branch-bound chain required by the alignment gate).
- Implementation: pB; validators: vitest/fuzz/lint/typecheck/harness/CI/Sonar.

Approach: cherry-picked residual delta, validated locally, landed behind required CI;
post-merge Sonar run is the acceptance oracle.
