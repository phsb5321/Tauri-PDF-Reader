# Spec 266-residual — Sonar gate to zero on faeb7d2

## User Scenarios & Testing (completed)

**Primary story:** after PR211 landed (`faeb7d2`), the post-merge Sonar analysis still
counted 4 new-code violations (2 exposed by the new-code window moving, 2 from the
residual complexity budget). This slice clears them so the gate reports
`new_violations = 0` with no exclusions, ignores, or threshold edits.

**Verification:** touched suites + karaoke-sync green; fuzz seed 20260915 green;
typecheck 0; lint 0 errors; hooks green; required CI green; post-merge Sonar OK.

## Context

- prosody-plan.ts:25 S7781 — regex `/_/gu` → plain `"_"`.
- prosody-plan.ts:134 S7780 — `String.raw` for the RegExp template (interpolation kept).
- PerformanceSettings.tsx S3358 — `formatSynthesisSlots` helper (nested ternary newly
  inside the new-code window after PR211's edit).
- useTtsWordHighlight.ts S3776 18→≤15 — success path moved to a sync closure (zero added
  suspension); the stop block stays inline because an async helper yields a microtask
  even when idle, which measurably broke karaoke-sync resurrection ordering.

## Out of scope

All-history issues, any product behavior change, Rust/Swift analysis.
