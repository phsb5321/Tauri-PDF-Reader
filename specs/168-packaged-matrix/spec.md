# Feature Specification: Packaged Matrix Reliability

**Feature Branch**: `168-packaged-matrix`
**Date**: 2026-08-22

## Problem

The scheduled packaged acceptance matrix can report failures after the driven user journey succeeds because observers depend on undeclared host tools, one lane uses a private execution environment, and process checks assume the application binary remains inside the checkout. This makes the release signal unreliable without identifying a product defect.

## User Scenarios & Testing

### User Story 1 — Trust the packaged acceptance result (Priority: P1)

As a maintainer, I need every packaged lane to run and observe the same built application in the same declared environment so a red matrix means an actionable journey failure rather than harness drift.

**Independent Test**: Run the scheduled lane set in order and verify that each actor assertion and each observer assertion resolves using only declared inputs.

### Acceptance Scenarios

1. **Given** build output is redirected outside the checkout, **when** a lane launches and observes the app, **then** both operations identify that exact executable.
2. **Given** an observer queries persisted state between app phases, **when** the lane runs on a clean host, **then** the query executable is available from the declared environment.
3. **Given** a lane enters a nested execution environment with a different temporary-directory setting, **when** the app starts, **then** the hermetic profile remains within the accepted Linux temporary root.
4. **Given** all packaged lanes, **when** their execution environment is inspected, **then** none carries an independent package list.

## Requirements

- **FR-001**: Every packaged lane MUST use one repository-declared execution environment.
- **FR-002**: Every process observer MUST identify the same executable selected by the build and launcher, including redirected build output.
- **FR-003**: Every executable invoked by a packaged observer MUST be supplied by the declared environment rather than the runner host.
- **FR-004**: Hermetic profile creation MUST remain valid across outer and nested Linux execution contexts without touching the live user profile.
- **FR-005**: Missing executables, profiles, process identities, or actor assertions MUST fail closed.
- **FR-006**: Product behavior and persisted data formats MUST remain unchanged.

## Success Criteria

- **SC-001**: Structural contract tests reject a private lane package list, a missing observer executable, and a hardcoded process path.
- **SC-002**: Highlight create/relaunch persistence and reader navigate/relaunch persistence both pass in packaged runs.
- **SC-003**: The close journey observes the relocated application process and completes all four data-survival phases in one replay.
- **SC-004**: The exact-head scheduled matrix is green before merge.

## Out of Scope

- Product UX or persistence changes.
- Relaxing close-race timing or state-survival assertions.
- Changing workflow triggers or artifact retention policy.
