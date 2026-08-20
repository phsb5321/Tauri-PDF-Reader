# Contract: Work Disposition

Every active recovery item and genuinely unique tip has one—and only one—category.

## Categories

| Category | Admission test | Required action |
|---|---|---|
| `north-star-blocking` | Executable evidence on a current exact head shows at least one required first-reader step cannot complete or loses acknowledged state. | Sequence before polish; name failed scenario and owner. |
| `worthwhile-post-release-polish` | The change has user/evidence value, but the north-star journey passes without it. | Keep ranked after blockers; retain its own executable acceptance. |
| `duplicate` | Tree/combined-patch/outcome evidence proves accepted content already exists or another retained item supplies the same outcome. | Preserve unique topology/untracked work first, then no replay; close only with the equivalence receipt. |
| `stale` | The premise is superseded or the item cannot safely apply to current main; no accepted equivalent outcome is established. | Preserve evidence; close/re-specify instead of implementing old assumptions. |

## Required record

```text
item_id
observed_sha
category
immutable_evidence[]
owner
next_action
falsifier
preservation_state
terminal_state
```

A title, commit message, ancestry result, task label, PR body, or model verdict alone is not immutable evidence.

## Baseline dispositions

- #147: accepted post-release polish, merged out of sequence as `6b3fa9e`; no revert churn.
- #152: post-release polish, frozen pending 079; refresh and re-measure after #147.
- Local 145/151 representations: duplicate of remote PR heads.
- Formerly local-only 122/125 trees: duplicate of merged squashes. 143: duplicate **feature patch on a stale base**, proven by common-base combined patch-id/range-diff, never raw whole-tree identity. All topology is preserved remotely.
- Credential-free offline narration: post-release work; current no-key actionable setup plus configured/fixture Play remains the north-star contract.

## Targeted-fix exemption

A `north-star-blocking` item may omit a separate feature spec only when all `TargetedFixEligibility` fields in [data-model.md](../data-model.md) pass. This exemption never waives a required approval, test, review, CI, packaged user gate, or safe merge rule.

## Falsifier

The contract fails when any in-scope item has zero/multiple categories, lacks an owner/falsifier, is reconciled before local-only topology is preserved, or uses squash ancestry alone to claim unique/duplicate content.
