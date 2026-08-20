# When a change needs a spec directory

`specs/` holds one directory per feature, named `NNN-slug`. The speckit scripts
resolve a feature as exactly that — `get_feature_dir() { echo "$1/specs/$2"; }`
in `.specify/scripts/bash/common.sh:84` — so anything else in `specs/` is
occupying the namespace rather than living in it.

This file exists because the numbers stopped matching: spec directories end at
`055`, pull requests are past `65`, and nine landings in between have no spec of
their own. That gap was either a rule nobody wrote down or a chain nobody ran.
It was mostly the former. Here is the rule.

## Executable boundary

`tools/harness-policy.sh` is the single implementation. Pi settlement, `make
harness-check`, `pnpm harness:check`, Husky, `scripts/verify.sh`, and the existing
required Alignment Gate all call it. A branch touching product code across at
least three changed files must be named `NNN-slug` and carry non-template
`specs/NNN-slug/{spec,plan,tasks}.md`. The count includes committed branch work,
working changes, and untracked files, so committing before settlement or
splitting work across commits does not bypass it.

In a Pi process the same command also requires the current seat's durable goal.
It never blocks tools: `pi goal set "<measurable outcome>"` remains the recovery
command. Ordinary human shells and CI have no Pi seat identity, so they enforce
the branch-bound specification half only.

## Needs a spec directory

Anything that changes what the application does for the person using it:

- new user-visible capability or surface
- a behaviour change in an existing flow (what the reader shows, plays, saves)
- a data-model or persistence change that outlives one session
- anything a user could notice and describe without reading the source

The chain for these is `/speckit.specify` → `.clarify` → `.plan` → `.tasks` →
`.implement`, and the artifacts land in the diff.

## Legitimately spec-less

Work whose whole description is its diff, where a spec would be a transcription
of the pull request:

- **CI and quality-gate repair** — a check is red, or is measuring the wrong
  thing, and the fix restores the signal
- **Test infrastructure and ratchets** — new tests over existing behaviour,
  coverage floors, contract gates. These add no behaviour to specify
- **Documentation and backlog state** — including this file
- **Mechanical refactors with no behaviour delta** — a type moved onto the
  generated surface, an import rewritten, a rename. The test suite is the
  specification, unchanged before and after
- **Dependency bumps and build configuration**

A spec-less pull request still carries the full description in its body and
still passes `verify_gate`. Spec-less means no `specs/NNN-slug/`, not less rigour.

### The disqualifier

None of the labels above survive contact with a behaviour change. The test is
mechanical, not a judgement call:

> If the pull request adds or edits a test **to describe behaviour the
> application did not have before**, it is not spec-less, whatever else it is
> called.

A refactor that is genuinely mechanical leaves the existing suite passing
unchanged — that is what makes it mechanical. New tests over _existing_
behaviour are the "test infrastructure" class and stay spec-less; a new test
that would have failed before the change is the definition of a behaviour delta,
and no label removes it. Reviewers check this by reading the test diff, not the
label.

This is deliberately the same evidence a reviewer already has to look at, so it
costs nothing to apply and cannot be satisfied by assertion.

## What actually happened to #56–#65

| PR  | Class                                        | Correct?                                                |
| --- | -------------------------------------------- | ------------------------------------------------------- |
| #56 | `feat(library)` — relocating a moved book    | **No** — user-visible behaviour, should have had a spec |
| #57 | sonar: stop indexing the test root as source | Yes — gate repair                                       |
| #58 | docs: record the merge train                 | Yes — documentation                                     |
| #59 | sonar: native semantics + command contracts  | Yes — gate repair                                       |
| #60 | sonar: quality-gate conditions (CLOSED)      | Yes — gate repair, superseded                           |
| #61 | contracts: return-shape guard                | Yes — test infrastructure                               |
| #62 | db-init coverage + floor ratchet             | Yes — test infrastructure                               |
| #63 | bindings gate against the Rust command list  | Yes — test infrastructure                               |
| #64 | ratchet the 63 untyped registered commands   | Yes — test infrastructure                               |
| #65 | session commands onto the typed surface      | Yes — mechanical refactor, no behaviour delta           |

One miss in ten, and it is named rather than backfilled: writing a spec for #56
today would be fiction dated after the fact, and the behaviour it added is
already covered by tests. The rule starts applying forward.

## `specs/018-*` does not exist

`017-domain-coverage-tests` is followed by `019-coverage-ratchet`. No branch, no
pull request and no commit references an `018`. The number was skipped, not
lost — nothing to recover.

## `specs/054-reader-redesign/` is a half-run, on purpose

It holds `design-spec.md`, `direction-choice.md`, `product-facts.md`,
`research/` and `design-demos/`, and has no `spec.md`, `plan.md` or `tasks.md`.
That is the shape of a chain stopped at a decision point rather than one that
failed: `direction-choice.md` presents three reader directions and the choice is
Pedro's. `/speckit.specify` cannot be run against an unmade decision without
inventing the answer.

Compare `055-kokoro-offline-voice/`, which has `spec.md` + `plan.md` +
`tasks.md` + `decision.md` — the conforming shape. `054` reaches it when the
direction is picked, and not before.

## `specs/044-tauri-pdf-reader/`

The bootstrap spec of the whole project — `spec.md`, `plan.md`, `tasks.md`,
`research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/` —
sat loose in `specs/` root from `bea256b Initial commit` until 2026-08-01. Its
own `spec.md` line 3 says `**Feature Branch**: 044-tauri-pdf-reader` and its
`tasks.md` points at `/specs/044-tauri-pdf-reader/` as its input, so the
directory it now occupies is the one it always named. Nothing was rewritten; the
files were moved with `git mv`.
