# Feature 075 — User simulation gate

## Goal

Make agent-operated, packaged-app user simulation and seeded stateful fuzzing a
required, reproducible completion contract for Lectrice features.

## Requirements

- **FR-001:** Codex must discover a repository-scoped Lectrice user-gate skill.
- **FR-002:** The actor must use only public UI/accessibility interactions.
- **FR-003:** Deterministic assertions, not the actor's prose, decide pass/fail.
- **FR-004:** Stateful fuzz failures must retain a seed and shrinkable trace.
- **FR-005:** The existing packaged Tauri harness must remain the native runner;
  missing native prerequisites must fail rather than skip. Bridge-driven lanes
  that act through `window.__E2E__` are integration diagnostics, never native
  user-journey gate evidence.
- **FR-006:** The first PR-fast model must fuzz navigation bounds and the
  stop-before-navigation contract over sequential user actions.
- **FR-007:** Evidence must identify the build, environment, fixture, actions,
  assertions, logs, artifacts, resource observations, and replay command.
- **FR-008:** Every fuzz run must emit a versioned, typed replay trace containing
  the model revision, seed, run budget, initial state, ordered actions, failing
  assertion (when any), minimized failing trace, and an exact non-LLM replay
  command. The runner must accept the recorded seed and action path.

## Acceptance

`pnpm test:fuzz` passes with its default seed and with an explicitly supplied
seed/run budget. `pnpm test:user-gate` composes fuzzing with the actor-compliant
native-play lane and fails if its native prerequisites are absent. The existing
critical-loop lane remains a retained bridge-driven integration diagnostic; it
must be refactored to public UI/keyboard actions with observer-only prelaunch
fixture setup before it can return to the user-gate contract. Skill validation
passes. A failing trace is retained and replayable without an LLM.

This slice deploys the reusable contract and first model. A feature without its
own public native journey remains blocked; this slice does not declare every
existing Lectrice feature covered.
