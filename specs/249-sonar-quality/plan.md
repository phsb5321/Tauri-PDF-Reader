# Plan 249 — Scope-preserving quality refactor

## Technical Context

Use the seven existing modules, not a competing engine/store or new dependency. Replace assertion syntax with typed querySelector/known DOM types; set the same data-theme through dataset; lift nested status conditions into named local values and a status-class lookup. Extract provider-activation finalization without changing its getState snapshot or generation guard. Split bounded speech processing into meaningful chunk-boundary selection and oversized-sentence splitting, preserving null-as-failure propagation across the entire request.

Checks: existing selection, tts-tracking, connection-store/provider-switch, initialization/persistence/state-machine and settings suites; add whole-request rejection, Unicode boundary and theme regression cases. Run serially only in an announced bounded stopped-reader slot, retaining failures and restoring unchanged225 on every exit. Native packaged PR-fast and different-family review are separate gates.

## Workflow limitation

The installed speckit-make driver still requires Anthropic generation and retired Terra evaluation. It must not be launched or relabelled for this OpenAI-authored slice. These manual branch-bound artifacts do not certify that incompatible pipeline. Retain executable validators plus an actual different-family gate; do not edit global workflow machinery under this source-only authority.

## Risk and reversal

Highest-risk seams: fail-closed chunk aggregation and stale provider finalization. Preserve existing ordering and test the real public functions/hooks. Keep PR205's four overlapping source files unchanged. A landed source-only slice is reversible by one ordinary revert PR; no deployment is included.
