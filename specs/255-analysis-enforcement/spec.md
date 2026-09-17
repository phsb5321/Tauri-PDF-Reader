# Feature Specification: Analysis enforcement — truthful coverage results

**Feature Branch**: `255-analysis-enforcement`

**Created**: 15/09/2026

**Status**: Targeted checks and documentation gate passed; normal hooks, CI and delivery pending

**Input**: Pedro requires the vault's analysis integrations to be enforced and perfect results to be pursued without hiding maintained source or weakening checks.

## User Scenarios & Testing

### User Story 1 — A failed analysis cannot report success (Priority: P1)

As a maintainer requesting the strict coverage check, I need its result to reflect the analyzer's result so that failed or absent analysis cannot be accepted as a passing quality check.

**Why this priority**: The existing warning fallback converts analyzer failure into success. Removing that false signal is a small independently deliverable prerequisite to honest score improvement.

**Independent Test**: Execute the repository's actual strict-check command against controlled successful, failing and unavailable analyzers. Compare the pre-fix and candidate source with the same regression. This proves command behavior, not the application's actual coverage percentage.

**Acceptance Scenarios**:

1. **Given** a successful analyzer, **when** the strict check runs, **then** the check succeeds and passes the unchanged strict-coverage arguments to that analyzer.
2. **Given** an analyzer that returns failure status17, **when** the strict check runs, **then** status17 is returned rather than converted into a warning and success.
3. **Given** the analyzer is unavailable, **when** the strict check runs, **then** the command fails with the missing-command result and cannot invoke unrelated real tools.
4. **Given** the previous warning fallback is restored, **when** the regression runs against that source, **then** the regression fails; a clean candidate must pass the same expectations.

### User Story 2 — Normal verification catches reintroduced masking (Priority: P2)

As a maintainer using the existing test workflow, I need the same regression to run through ordinary test discovery rather than remain an optional standalone demonstration.

**Why this priority**: A manually demonstrated check is not sufficient integration if normal development never runs it.

**Independent Test**: Run the existing verification-receipt test suite and confirm that its new strict-coverage case and its three existing receipt cases all pass.

**Acceptance Scenarios**:

1. **Given** the candidate is in the normal test tree, **when** the verification-receipt suite runs, **then** it executes the same strict-coverage regression and retains all existing receipt checks.
2. **Given** the subprocess fails, hangs or is terminated, **when** the wrapper runs, **then** the wrapper fails instead of presenting a successful verification result.

### Edge Cases

- Missing tooling, unexpected analyzer arguments and a changed warning fallback must fail the regression.
- A subprocess error, signal or timeout must not be mistaken for an ordinary successful exit.
- Synthetic checks must not inherit credentials or accidentally resolve an installed real analyzer.
- Temporary test state must be confined to newly created owned directories and cleaned without touching shared state.
- A passing synthetic check must never be reported as actual100% application coverage or full-stack perfection.

## Requirements

### Functional Requirements

- **FR-001**: The strict coverage entrypoint MUST preserve success and propagate analyzer failure or absence.
- **FR-002**: The fix MUST preserve the existing strict threshold, analyzer arguments, source scope and coverage denominator.
- **FR-003**: The regression MUST execute the actual repository command, not a rewritten command that could drift independently.
- **FR-004**: Ordinary test discovery MUST execute that regression while retaining the existing receipt tests.
- **FR-005**: Tests MUST discriminate successful, failed and absent analysis, with bounded subprocess execution and explicit abnormal-exit rejection.
- **FR-006**: Checks MUST use the authorized serialized slot while reader225 is live; no hooks, source mutation, provider calls or activation may be inferred from a check result.
- **FR-007**: Evidence MUST retain the original failures, source identities and correction history. The exhausted2/2 source-repair budget MUST NOT reset during documentation completion or ordinary qualification.
- **FR-008**: Completion MUST distinguish authored, checked, independently reviewed, committed, CI-green and merged states. This slice MUST NOT claim complete analysis-stack integration or perfect scores.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The same three-case regression rejects pre-fix source and accepts the candidate, with success, status17 and missing-command outcomes preserved exactly.
- **SC-002**: All four ordinary verification-receipt tests pass; none of the existing three tests is removed or weakened.
- **SC-003**: All three reviewed code-file hashes remain bound to the executed candidate; documentation-only completion does not change them.
- **SC-004**: The branch passes its real documentation/policy check and required normal hooks, independent review and protected CI before a merge claim.
- **SC-005**: Every authorized local execution leaves reader225 restored unchanged, with its restoration receipt retained.

## Assumptions and Scope Boundaries

- This is the first bounded code slice of a larger analysis-quality campaign. The campaign targets zero unresolved actionable findings, maximum defined ratings,100% maintained executable-source coverage and0% unintended duplication; its measured gap matrix remains in `reports/DELIVERY.md`.
- Those campaign targets do not describe current results or change existing CI ratchet floors in this slice. No source exclusion, issue dismissal, rule suppression or baseline reset is authorized to manufacture a score.
- The already-applied native CodeQL rule23477091 is separately reviewed configuration, limited by GitHub's PR-diff semantics. It is not proof of zero legacy findings, a planted-violation test or a pre-merge Sonar gate.
- Fresh main already requires Clippy. No duplicate Clippy fix, application behavior change, workflow edit, shared Sonar/profile change or new dependency belongs here.
- Reader/playback work and the252 native-cache logging blocker remain outside this slice.249 helpers must be preserved when inheriting main.
