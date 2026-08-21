# Feature Specification: Goal and Spec Kit Enforcement

**Feature Branch**: `080-goal-speckit-enforcement`
**Created**: 20/08/2026
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Work stays anchored to a durable outcome (Priority: P1)

As the project owner, I need every agent-authored Lectrice change to retain a durable goal so that role drift is caught before work is reported complete.

**Independent Test**: Start an agent-authored check without a goal and observe a refusal that names the recovery command; set the goal and observe that the same check proceeds.

### User Story 2 — Broad changes carry a complete specification chain (Priority: P1)

As the project owner, I need broad user-visible changes to carry specification, plan, and task artifacts for their own feature so that an unrelated historical spec cannot authorize new work.

**Independent Test**: A branch with three or more changed files including product code fails without its matching three-artifact chain, still fails with a partial chain, and passes with the complete chain.

### User Story 3 — One policy works at every delivery boundary (Priority: P2)

As a contributor, I need the same decision from the agent harness, a Make target, the package runner, the commit hook, local verification, and pull-request alignment checks so that choosing a different entry point cannot bypass policy.

**Independent Test**: Invoke each supported entry point against the same negative-control branch and observe the same refusal class.

## Requirements

### Functional Requirements

- **FR-001**: Agent-authored Lectrice work MUST refuse successful settlement when the current seat has no durable goal, without blocking the command that sets that goal.
- **FR-002**: A change touching product code and crossing the configured file threshold MUST require `spec.md`, `plan.md`, and `tasks.md` under the specification directory matching the feature branch.
- **FR-003**: Existing unrelated specification directories and partial/template artifacts MUST NOT satisfy the gate.
- **FR-004**: Documentation-, test-, and infrastructure-only changes MAY remain specification-less when they do not alter product code.
- **FR-005**: Targeted changes below the threshold MUST remain eligible for the documented lightweight path.
- **FR-006**: Repeated unchanged failures MUST terminate in an explicit escalation record rather than an infinite continuation loop or an implicit pass.
- **FR-007**: The repository MUST expose one executable policy through Make, the package runner, the commit hook, local verification, pull-request alignment, and the Pi harness.
- **FR-008**: A deterministic negative control MUST prove that broad work without the complete branch-bound chain is rejected.

### Success Criteria

- **SC-001**: The negative control rejects a broad no-spec change and a partial-spec change, then accepts a complete branch-bound chain.
- **SC-002**: Goal-less settlement is refused while `pi goal set` remains executable.
- **SC-003**: A committed branch diff cannot evade the specification gate by leaving the worktree clean.
- **SC-004**: PR #152 is rejected until it either becomes a targeted change or carries a complete matching Spec Kit chain.
