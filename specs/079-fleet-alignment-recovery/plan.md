# Implementation Plan: Fleet Alignment Recovery

**Branch**: `079-fleet-alignment-recovery` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/079-fleet-alignment-recovery/spec.md`

## Summary

Freeze the complete first-reader loop as Lectrice's ranking authority, preserve and classify every divergent tip before reconciliation, settle the current PR train without letting polish outrank a functional failure, and replace prose done-state with an exact-revision packaged journey plus deterministic recovery receipt.

The first landing is documentation/integration only: upstream Spec Kit 0.16.5 for Pi (ten prompts) plus this spec, plan, tasks, and design artifacts. Later owner-specific slices reuse the repository's existing packaged journeys and add only the missing composed north-star actor and recovery oracle/receipt. No feature code, Constitution amendment, PR #152 mutation, release, or deployment belongs in this landing.

## Technical Context

**Language/Version**: Markdown; POSIX-compatible Bash; JSON/JSON Schema where the existing repository already uses machine receipts; existing TypeScript/JavaScript packaged actor when the later QA slice composes the journey

**Primary Dependencies**: Spec Kit 0.16.5 bundled templates/integration; existing repository scripts, `git`, `gh`, `jq`, Tauri packaged-test toolchain; no new runtime dependency

**Storage**: Git-tracked specifications, contracts, scripts, JSON receipt, repository backlog; vault SAVE-STATE through its separate normal PR

**Testing**: Spec Kit prerequisite/analyze workflow; shell syntax and bounded falsifiers; existing packaged WebKitGTK/Xvfb lanes; exact-head CI; independent different-family review

**Target Platform**: Linux, matching the only published and packaged-tested Lectrice target

**Project Type**: Desktop application plus delivery-control artifacts

**Performance Goals**: One serialized heavy lane at a time; lightweight document/shell checks complete locally before CI; no duplicate CI run is queued for an unchanged head

**Constraints**: Preserve Constitution hash; no feature code in the 079 landing; no force-push/stash/shared-main edit; no branch/worktree deletion before reachability preservation; no live credential in CI; vm103 jobs serialize; `.github/workflows` and release actions remain gated

**Scale/Scope**: Two recovery PRs (#147/#152 at initial observation), a complete all-local-ref inventory with 23 preservation refs, seven delivery roles, eighteen functional requirements, one north-star journey, one two-phase receipt envelope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-design result | Evidence / constraint |
|---|---|---|
| I. Hexagonal Architecture | PASS | The first landing changes only Spec Kit and planning artifacts. Later test/oracle tasks stay at delivery boundaries; no domain/adaptor dependency is introduced. |
| II. Typed Tauri IPC, Ratcheted | PASS | No Tauri command or binding change is planned. The composed journey reuses public UI and existing fixture boundaries. |
| III. Test-First Development | PASS | New executable behavior is limited to test/oracle surfaces and has fail-before/pass-after tasks. No floor, test, or ratchet may be weakened. |
| IV. Design System Consistency | PASS | No UI implementation is in 079. Existing #147/#152 product changes retain their own token/harness gates. |
| V. State Management Patterns | PASS | No store change. The session-only key decision is preserved; offline narration is not smuggled in as recovery work. |
| VI. Verification Discipline | PASS | North-star acceptance, PR-specific harnesses, branch reachability, and recovery done-state are executable and exact-revision-bound. A model verdict cannot satisfy completion. |

**Pre-design gate**: PASS. No exception or Complexity Tracking entry is required.

## Product and Evidence Decisions

1. **Credential-required narration is current product scope.** The key is intentionally excluded from persisted preferences. A fresh profile must show an actionable setup path; configured/fixture Play must work. Persisting the key is forbidden by this recovery. Credential-free Kokoro remains post-release because spec 055 proves the JS path misses timing and leaves an unranked Python/sidecar packaging cost.
2. **#147 remains polish and its out-of-order merge is accepted, not reenacted.** Remote head `511f70d` already contained the review-requested form-control patch equivalent to local `2a0569d`; all checks and Product/QA ALLOW were green before squash `6b3fa9e`. A later exact-head DeepSeek Pro gate found two MAJOR false-green paths in the exhaustive harness—active input/submit states were not exercised, and unsupported `color(srgb)`/`color-mix()` values were silently skipped. The CSS fix is token-correct, so recovery adds a post-079 targeted oracle repair and does not revert product CSS or replay #147.
3. **#152 remains polish but its acceptance evidence is stale.** Its geometry predates `31b47c1`, which added content above the grid. After 079, update its branch normally onto main containing `6b3fa9e` and rerun the fold/uncropped harness before any terminal decision.
4. **Complete-ref preservation is done; classification still uses all refs.** The initial worktree-focused report's count of three local-only tips was false. A scan over every local ref found 19 more; 23 exact `origin/preserve/20260820-*` refs now preserve those 19 plus 122/125/143 and deleted local 145. Local 145/151 are patch-identical to their PR heads; 122/125 trees equal merged squashes; 143's **common-base combined feature patch-id** equals its squash while the stale-base whole tree differs. Future checks enumerate all refs dynamically, never a named-worktree list, and never use raw tree delta to falsify 143 patch equivalence.
5. **One composed actor is the north-star oracle.** Existing open/native-play/close/home lanes remain useful component evidence, but the final claim requires one packaged journey across all boundaries on one exact revision and profile.
6. **Targeted-fix exemption is eligibility, not authority.** A qualifying repair still gets one owner/worktree, fail-first evidence, exact-head independent review, user gate, CI, and normal merge. Any new outcome/dependency/state/authority change requires a new spec.
7. **The tracked receipt is necessarily two-phase.** A commit cannot contain its own SHA. Freeze accepted main as `A`, run acceptance at `A`, then land one receipt-only child `R` whose first parent is `A`. At `R`, the oracle proves `HEAD^ == A` and that `A..R` contains only the enumerated receipt envelope. Any `receipt SHA == HEAD` design is physically impossible and rejected.

## Recovery Sequence and Owners

| Order | Slice | Owner | Entry gate | Exit / falsifier |
|---:|---|---|---|---|
| 0 | Record #147 sequence breach | Product | `6b3fa9e` and green exact-head evidence observed | Spec/tasks name the deviation; falsified if merge/check identities differ |
| 1 | Merge 079 Spec Kit + contract | Product (this landing) | Constitution hash captured; ten prompts installed; analysis clean | PR merged on an updated base; no feature-code diff |
| 2 | Verify/classify complete-ref inventory | Graph | 23 preservation refs present | Every local ref is inventoried and remotely contained; equivalence/stale classifications are mechanically reproducible |
| 3 | Repair #147 contrast oracle false-greens | One targeted-fix writer; QA judges | 079 merged; DeepSeek Pro findings cited | Active input/value and enabled-submit states are exercised; modern computed colors are parsed or fail closed; exact harness passes |
| 4 | Refresh and re-measure frozen #152 | Orch sequences; QA judges | 079 merged; complete-ref inventory accepted; #152 still open | Exact refreshed head includes `6b3fa9e` and oracle repair; card-fold/uncropped harness and required checks pass, or item is deliberately closed with failed evidence |
| 5 | Repository/vault reconciliation | Knowledge | #152 terminal; graph disposition accepted | Lectrice backlog changes land before `A`; vault state names current accepted facts through its own PR |
| 6 | Freeze `A` and compose/run first-reader journey | QA | No further non-receipt Lectrice change pending | One packaged fresh-profile journey and required checks pass at exact `A` |
| 7 | Receipt-only child `R` + recovery oracle | Control | `A` immutable; journey/check artifacts available | Receipt records `accepted_main_sha=A`; `R^=A`; `A..R` contains only enumerated receipt files; oracle and bounded falsifier pass |
| 8 | Review/done | Orch | All declared artifacts present at `R` | `fleet-intel verify lectrice-alignment-recovery` exits 0; model prose cannot substitute |

## Project Structure

### Documentation and contracts (this feature)

```text
specs/079-fleet-alignment-recovery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recovery-receipt.md
│   └── work-disposition.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Repository surfaces used by later slices

```text
.pi/prompts/                              # 10 upstream Pi lifecycle prompts
.specify/                                 # bundled lifecycle/scripts/templates
scripts/oracle-alignment-recovery.sh      # Control-owned deterministic done-state
scripts/test-oracle-alignment-recovery.sh # bounded shell falsifier
e2e/north-star-journey.e2e.mjs            # QA-owned composed public actor
e2e/run-north-star-journey.sh             # hermetic packaged runner
docs/alignment-recovery-receipt.json      # receipt at R, binding accepted parent A
docs/agent-backlog-state.md               # repository durable state
```

**Structure Decision**: Keep the contract in one numbered feature directory. Reuse existing repository test infrastructure; add only one composed actor and one deterministic recovery oracle in their established top-level directories. Vault state remains a separate repository/PR and is never edited from this worktree.

## Phase 0: Research Output

[research.md](./research.md) records decisions from immutable repository/release evidence, PR APIs, the branch ledger, spec 055, and the Product challenge. No unresolved clarification remains: the brief fixes the north star, the ledger fixes reachability, current release documentation fixes supported platform/provider scope, and the Constitution fixes gates.

## Phase 1: Design Output

- [data-model.md](./data-model.md) defines journey, work disposition, evidence receipt, and exemption eligibility without inventing application data.
- [contracts/work-disposition.md](./contracts/work-disposition.md) defines the four exclusive categories and falsifier requirements.
- [contracts/recovery-receipt.md](./contracts/recovery-receipt.md) defines the minimum machine receipt the Control lane later makes schema-valid.
- [quickstart.md](./quickstart.md) gives the bounded validation order and explicit stop conditions.

## Post-Design Constitution Re-check

PASS on all six principles. The design adds no production architecture, command, store, style, runtime dependency, or coverage-floor change. All user-visible claims terminate in runnable assertions. The plan preserves rather than weakens the credential boundary and delegates no self-verdict to the generator.

## Complexity Tracking

No Constitution violation or added application abstraction is proposed.
