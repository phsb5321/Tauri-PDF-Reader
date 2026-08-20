# Data Model: Fleet Alignment Recovery

This feature introduces delivery evidence only. It does not change Lectrice's application database, stores, settings, or user data.

## 1. NorthStarJourney

Represents one packaged first-reader run.

| Field | Constraint |
|---|---|
| `source_sha` | Full immutable commit SHA; equals `accepted_main_sha` in the final receipt |
| `platform_scope` | Exact supported test environment; Linux/X11/WebKitGTK for this recovery |
| `profile_id` | Unique hermetic profile identity for the whole journey |
| `fixture_id` | Deterministic PDF and narration fixture identities/digests |
| `started_at`, `finished_at` | Timestamped execution bounds |
| `steps` | Ordered `JourneyStep` records; all required steps occur exactly once or fail |
| `artifacts` | Logs/receipts that contain no credential or private corpus |
| `result` | `pass` or `fail`; no `skipped-green` state |

### JourneyStep

Required order:

1. `fresh_profile`
2. `open_pdf`
3. `no_key_setup_visible`
4. `start_narration`
5. `mutate_acknowledged_state`
6. `normal_close_process_ended`
7. `relaunch_new_process`
8. `resume_same_document_page`
9. `highlight_present`

Each step records public actor action, deterministic oracle observation, elapsed bound where relevant, and failure reason. Observer instrumentation may inspect state but never act for the reader.

## 2. WorkDisposition

Represents the exclusive classification of a recovery item.

| Field | Constraint |
|---|---|
| `item_id` | Stable PR, audit row, spec slice, branch, or immutable tip identity |
| `observed_sha` | Full SHA when the item has code/commit identity |
| `category` | Exactly one of `north-star-blocking`, `worthwhile-post-release-polish`, `duplicate`, `stale` |
| `evidence` | Immutable refs and runnable/structural evidence; prose title alone is invalid |
| `owner` | One accountable role |
| `next_action` | Reversible action or explicit no-action |
| `falsifier` | Concrete observation that would change the category |
| `preservation_state` | `not-required`, `local-only`, `remote-preserved`, or `merged-content-preserved` |
| `terminal_state` | `open`, `merged`, `closed-with-reason`, or `preserved-only` |

### State transitions

```text
observed -> classified -> preserved (when needed) -> reconciled -> terminal
```

`classified -> reconciled` is forbidden while `preservation_state=local-only`.

## 3. TargetedFixEligibility

Represents a decision that a failed north-star scenario may be repaired without a new feature specification.

| Field | Required truth |
|---|---|
| `failed_scenario` | Names one existing north-star acceptance step and exact failing receipt |
| `root_cause_scope` | One smallest shared cause, not symptom-specific patches |
| `fail_before` | Executable failing evidence on the pre-fix exact head |
| `pass_after` | Same evidence passing on the fixed exact head |
| `new_user_outcome` | `false` |
| `new_dependency` | `false` |
| `persisted_data_change` | `false` |
| `authority_or_security_widening` | `false` |
| `single_owner_worktree` | `true` |
| `normal_gates_retained` | `true` |

Any false/missing required truth makes the item `requires-new-spec`; eligibility never marks the implementation accepted.

## 4. RecoveryReceipt

Tracked machine evidence stored only in the receipt child commit `R`.

| Field | Constraint |
|---|---|
| `schema_version` | Pinned integer understood by the oracle |
| `program_id` | `lectrice-alignment-recovery` |
| `accepted_main_sha` | Full SHA `A`; all non-receipt repository work and exact-head acceptance are complete here |
| `receipt_commit_parent` | Full SHA; MUST equal `accepted_main_sha` when validated at `R` |
| `receipt_envelope` | Sorted explicit list of files permitted in `A..R` |
| `spec_artifacts` | Paths/digests for 079 spec, plan, tasks, analysis evidence, and ten-prompt assertion |
| `dispositions` | Complete `WorkDisposition` set or immutable referenced artifact |
| `journey` | NorthStarJourney result bound to `A` |
| `checks` | Required check names, run IDs, exact head SHA, conclusions |
| `reviews` | Independent-review provenance and disposition, bound to exact heads |
| `state_refs` | Repository/vault state references and observed revisions |
| `generated_at` | Timestamp after `A` acceptance and before `R` creation |

### Two-phase invariant

At `R`:

```text
HEAD^ == receipt.accepted_main_sha
receipt.receipt_commit_parent == receipt.accepted_main_sha
changed_paths(HEAD^..HEAD) == receipt.receipt_envelope
```

The receipt does not contain `R`'s SHA. This avoids an impossible self-hash while proving that the only change after accepted main `A` is the enumerated receipt envelope.

## 5. AnalysisEvidence

Read-only Spec Kit analysis result retained with the 079 landing or cited in its PR.

| Field | Constraint |
|---|---|
| `spec_sha256`, `plan_sha256`, `tasks_sha256` | Digest of analyzed files |
| `requirements_total` | Explicit FR/SC count |
| `tasks_total` | Parsed task count |
| `coverage` | Every buildable requirement mapped to task IDs |
| `critical`, `high` | Must both be zero before implementation |
| `constitution_issues` | Must be empty |
| `generated_at` | Date-verified timestamp |

## Relationships

- One `RecoveryReceipt` references one accepted `NorthStarJourney` at `A`.
- One receipt covers many `WorkDisposition` records and at most the targeted-fix eligibility records actually used.
- `AnalysisEvidence` gates tasks but does not authorize a product landing.
- The recovery oracle validates all entities; no entity can mark itself accepted.
