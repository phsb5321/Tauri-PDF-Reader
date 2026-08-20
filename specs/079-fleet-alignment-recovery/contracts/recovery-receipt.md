# Contract: Two-Phase Recovery Receipt

## Purpose

Bind the accepted Lectrice recovery state to immutable evidence without the impossible requirement that a tracked receipt contain the SHA of the commit containing itself.

## Commit model

```text
... -> A -> R
```

- `A` (`accepted_main_sha`): all non-receipt Lectrice work, backlog reconciliation, exact-head checks, north-star journey, and independent review are complete.
- `R`: one receipt-only child whose first parent is `A`.

The receipt lives at `R` and records `A`, not `R`.

## Required receipt shape

The Control slice will encode and schema-validate this contract as JSON without adding a new dependency.

```json
{
  "schema_version": 1,
  "program_id": "lectrice-alignment-recovery",
  "accepted_main_sha": "<40 lowercase hex A>",
  "receipt_commit_parent": "<same A>",
  "receipt_envelope": [
    "docs/alignment-recovery-receipt.json"
  ],
  "spec_artifacts": [],
  "dispositions": [],
  "journey": {},
  "checks": [],
  "reviews": [],
  "state_refs": [],
  "generated_at": "<RFC3339>"
}
```

The envelope may include another explicitly named receipt/schema file only if the accepted 079 plan/tasks name it before `A` is frozen. Wildcards and directories are forbidden.

## Oracle assertions at `R`

1. `HEAD` has exactly one first parent available to the validator.
2. `git rev-parse HEAD^` equals both `accepted_main_sha` and `receipt_commit_parent`.
3. `git diff --name-only HEAD^..HEAD`, sorted bytewise, equals `receipt_envelope`, sorted bytewise.
4. Every referenced check/review/journey head equals `accepted_main_sha` or an explicitly identified prerequisite PR head.
5. North-star journey result is `pass`, all required steps are present once and ordered, and source SHA equals `A`.
6. Required 079 artifacts and ten Pi prompts are present; Constitution hash equals the pre-init value recorded in 079.
7. Every in-scope work item has one valid disposition and preservation precedes reconciliation.
8. Repository and vault state references are present and do not assert an open state contradicted by their observed authority.

## Forbidden claims

- `receipt_sha == HEAD`
- a placeholder/amend loop intended to discover the receipt's own SHA
- model-authored `done`/`ALLOW` in place of executable evidence
- untracked `/tmp` paths as the only receipt
- credentials, API keys, private PDF content, or raw pairing/session capability data

## Bounded falsifiers

The oracle test must independently demonstrate non-zero exit for at least:

- wrong `accepted_main_sha`;
- an extra non-envelope path in `A..R`;
- missing/failed north-star step;
- open #152 or missing disposition;
- missing Pi prompt or changed Constitution hash;
- stale repository/vault state reference.

Fixtures use temporary repositories and synthetic JSON; they never mutate live PR, branch, application, or vault state.

## Reversal

A receipt defect is reversed with one normal revert PR for `R`. Accepted main `A` and its product evidence remain intact.
