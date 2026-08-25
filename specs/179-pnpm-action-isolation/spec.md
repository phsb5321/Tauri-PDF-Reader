# Feature Specification: Isolated pnpm Setup Contract

**Feature Branch**: `179-pnpm-action-isolation`
**Created**: 24/08/2026
**Status**: Review

## Outcome

The base-owned packaged-gate contract can authorize a follow-up workflow change that installs pnpm into a run/job-unique temporary directory, preventing another concurrent self-hosted job from replacing the binary mid-run. The unrelated local-TTS timeout retry oracle is deterministic under CI scheduling.

## User Scenarios & Testing

### User Story 1 — Stable CI toolchain (P1)

As a contributor, I can trust that a concurrent job cannot replace the pnpm binary while my required check is running.

**Independent test**: run CI and packaged jobs concurrently; each resolves pnpm 10 from its own run/job destination for the full job.

### User Story 2 — Deterministic retry oracle (P1)

As a maintainer, the local-TTS timeout test reports the actual retry behavior instead of racing an OS listener against paused Tokio time.

**Independent test**: replay the targeted test 20 times; each observes exactly two dispatch acknowledgements and no third dispatch.

## Requirements

- **FR-001** — The canonical packaged execution fixture MUST require the existing pnpm 10 pin plus a destination derived from `runner.temp`, `github.run_id`, and `github.job` for all three jobs.
- **FR-002** — The canonical trust-anchor fixture MUST require the same isolated destination for its own pnpm setup.
- **FR-003** — This authority slice MUST NOT modify an executable GitHub Actions workflow; the workflow application remains a separately gated follow-up.
- **FR-004** — Existing deep-structural comparison and negative controls MUST remain green.
- **FR-005** — The local-TTS timeout test MUST wait for each actual dispatch before advancing paused time, assert exactly one retry, and contain no wall-clock sleep.

## Success Criteria

- **SC-001** — Both canonical fixtures pass their real contract checkers.
- **SC-002** — Every packaged-gate negative control is still rejected for its intended reason.
- **SC-003** — The timeout retry test passes 20 consecutive deterministic replays and the full backend suite.
- **SC-004** — Required CI is green before merge.
