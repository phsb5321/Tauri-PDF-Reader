# Feature Specification: Fleet Alignment Recovery

**Feature Branch**: `079-fleet-alignment-recovery`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Freeze the Lectrice user outcome, rank every current item against it, and give the Foundry fleet executable acceptance, ownership, sequencing, and a narrow targeted-fix exemption."

## Problem and North Star

Lectrice has a published Linux release and strong evidence for individual journeys, but current work is being selected from UI findings, divergent local tips, and open pull requests without one accepted product contract. That makes polish look equivalent to reader-blocking work and lets stale branch state compete with current user evidence.

The product north star is:

> A first-time reader can open a PDF, start narration, close Lectrice normally, restart it without losing acknowledged reading data, and resume the same document from the saved place.

UI polish is subordinate unless executable evidence shows that it removes a blocker in this journey. “No data loss” covers the library record, the current reading page, and a highlight after Lectrice has confirmed its creation; it does not make the session-only ElevenLabs key persistent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete the first-reader loop (Priority: P1)

A first-time Linux reader starts with an empty Lectrice profile, opens a real PDF through a visible control, starts narration, closes the application normally, restarts it, and resumes the same book at the saved page with acknowledged reading data intact.

**Why this priority**: This is the smallest complete expression of Lectrice's purpose. Work that cannot improve or protect this loop cannot outrank a failure in it.

**Independent Test**: Run one packaged, hermetic, public-control journey on an exact source revision. The journey starts from an empty profile, opens a PDF, starts deterministic narration through the shipped application boundary, changes reading data, performs a normal window close that ends the process, relaunches, and resumes the same document at the persisted page with the acknowledged highlight present.

**Acceptance Scenarios**:

1. **Given** a fresh Linux profile with no library entries, **When** the reader uses the visible empty-state or toolbar action to choose a valid PDF, **Then** the reader surface shows that PDF and its page controls.
2. **Given** an open PDF and the deterministic narration fixture, **When** the reader activates the public Play control, **Then** narration crosses the application boundary and the spoken-word state advances.
3. **Given** an open PDF whose page changed and whose highlight creation was acknowledged, **When** the reader closes the window normally before deferred writes could hide a loss, **Then** the application process ends and both values are durable.
4. **Given** the prior close completed, **When** the reader relaunches Lectrice and activates the public resume control, **Then** the same PDF opens on the persisted page and the highlight remains available.
5. **Given** a fresh profile has no ElevenLabs key, **When** the reader reaches a narration affordance, **Then** Lectrice gives an honest, visible, actionable setup path rather than a silent no-op; after the deterministic fixture supplies the supported provider boundary, the same public Play action starts narration.
6. **Given** no live ElevenLabs credential or network is available, **When** acceptance runs, **Then** the deterministic fixture proves the internal narration path and the result is explicitly scoped; it does not claim live-provider quality or availability.

---

### User Story 2 - Choose work by reader value (Priority: P2)

The product owner and orchestrator can inspect every active pull request, audit item, and preserved local tip and assign exactly one disposition based on whether it blocks the first-reader loop.

**Why this priority**: A frozen outcome only changes delivery if it deterministically ranks the queue and prevents duplicate or stale work from consuming the single CI lane.

**Independent Test**: Compare the recovery inventory with the live open-pull-request list and the branch-graph report; every in-scope item has one category, an owner, a next action, and a falsifiable exit condition.

**Acceptance Scenarios**:

1. **Given** an item with executable evidence that a north-star step fails, **When** it is triaged, **Then** it is classified `north-star blocking` and sequenced before polish.
2. **Given** an item that improves Lectrice but the north-star journey still passes without it, **When** it is triaged, **Then** it is classified `worthwhile post-release polish`.
3. **Given** two items whose accepted outcomes and evidence are materially the same, **When** both are triaged, **Then** one is classified `duplicate`, with its unique commits preserved before closure.
4. **Given** an item based on superseded facts or a tip that cannot safely apply to current main, **When** it is triaged, **Then** it is classified `stale`, preserved, and not implemented without a fresh specification.
5. **Given** PR #147 and PR #152 at the 20/08/2026 baseline, **When** they are ranked, **Then** each is `worthwhile post-release polish`: #147 improves home-surface contrast and its oracle, while #152 keeps library-card metadata inside the fold; neither is required to open, narrate, close, restart, or resume.

---

### User Story 3 - Recover delivery without losing work (Priority: P3)

The Foundry fleet can reconcile divergent tips and execute one bounded slice at a time without losing commits, letting one role judge its own work, or turning a targeted defect repair into an unplanned feature.

**Why this priority**: The current interruption is operational rather than a missing reader feature. Recovery must preserve evidence and restore trustworthy sequencing before more UI work lands.

**Independent Test**: Starting from the recorded main and graph baseline, follow the ownership and sequencing contract; all unique tips remain reachable, each landing has an independent gate, the open recovery pull requests reach a deliberate terminal state, and durable state points to the accepted exact revision.

**Acceptance Scenarios**:

1. **Given** local and remote tips differ, **When** reconciliation begins, **Then** every unique commit is recorded and preserved before any close, delete, or branch operation.
2. **Given** multiple ready slices and one serialized CI lane, **When** work is sequenced, **Then** one writer/worktree and one pull request advance at a time in north-star order.
3. **Given** a failure in a named north-star acceptance scenario, **When** a targeted fix meets every exemption rule below, **Then** it may repair that failure without a new feature specification while retaining normal test, review, and merge gates.
4. **Given** a proposed fix adds product behavior, widens authority/security, changes persisted data, adds a dependency, or cannot show a fail-before/pass-after acceptance, **When** the exemption is evaluated, **Then** it is refused and the work requires its own specification.

### Edge Cases

- A pull request may be green against an old base while its head no longer represents the local tip; head identity and graph preservation precede product disposition.
- A squash-merged branch may appear unmerged by ancestry. GitHub merge state plus tree/patch evidence, not ancestry alone, decides duplication.
- A cancelled, zero-step, or infrastructure-killed check is not evidence that product acceptance failed; it remains non-green until a replacement exact-head run passes.
- A packaged journey that closes a window but leaves the process alive cannot prove close-time durability.
- A fixture can prove Lectrice's narration wire and state transition but cannot prove ElevenLabs availability, voice quality, or credentials.
- The absence of a key on a fresh profile is an expected prerequisite state, not acceptance by itself: a silent/dead setup path is north-star blocking; a visible setup path plus successful configured/fixture Play satisfies the automated contract. Credential-free offline narration is a separate post-release outcome.
- A stale SAVE-STATE or backlog entry is evidence of drift, not authority over current repository and release facts.
- A tracked receipt cannot truthfully contain the SHA of the commit that contains that receipt. Acceptance therefore uses an immutable parent `A` and a receipt-only child `R`, never a self-referential `receipt SHA == HEAD` claim.
- Subjective visual preference cannot promote an item to `north-star blocking` without an executable failure in the north-star journey.

## Sequence Deviation — 20/08/2026

PR #147 was squash-merged as `6b3fa9eaeb68ccc24b99d520df4a16d6dd02828c` at 15:39 BRT, before this required 079 contract landing. This breached the intended “contract first” sequence. Its exact remote head `511f70dce5010b51ff8a7fff7a7f133f89f751c9` had Product/QA ALLOW and green checks, so recovery accepts the landing and forbids revert churn solely to recreate ordering. This 079 branch must incorporate `6b3fa9e` through a normal branch update before merge. #152 was also refreshed early to head `2c525f9606b8322d7792ef4a47e89d510a860922` on the new main; it remains OPEN/UNSTABLE and MUST NOT merge before 079 and exact refreshed re-measurement.

The breach changes the remaining order, not the north star or classifications: merge 079 → verify the complete-ref preservation inventory → refresh and re-measure #152 on a base containing `31b47c1` and `6b3fa9e` → exact-head north-star acceptance → oracle receipt and state reconciliation.

### Complete-ref correction

The first worktree-focused graph report claimed only three local-only tips. A subsequent scan over **all local refs**, not named worktrees, found 19 additional zero-remote-containing tips. Preservation is now complete: 23 exact `origin/preserve/20260820-*` refs cover those 19 plus 122/125/143 and the deleted local 145 tip. `/tmp/lectrice-local-only-tips-20260820.tsv` is the correction input; the durable implementation task must inventory every local ref and prove remote containment rather than rely on a fixed branch list. The original count of three is false and MUST NOT appear as complete coverage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The recovery contract MUST treat the complete first-reader loop—open, narrate, normal close, process end, restart, and resume without acknowledged-data loss—as the highest product priority.
- **FR-002**: The north-star acceptance MUST be executable through public reader controls in a packaged Linux application using a fresh, hermetic profile and a source revision recorded in the result.
- **FR-003**: North-star acceptance MUST prove both reading-position durability and acknowledged-highlight durability across a normal close and a new application process.
- **FR-004**: Narration acceptance MUST start from the real no-key state, prove that the user receives a visible actionable setup path, then use deterministic evidence at the application boundary to prove Play; it MUST scope out live-provider availability and subjective audio quality unless separately measured.
- **FR-005**: A north-star result MUST fail closed when the selected PDF does not open, the no-key state is silent or inescapable, Play does not cross the narration boundary after supported setup, the window or process does not end, persisted data differs after relaunch, the resume control lands on another document/page, or the result is not bound to one exact revision.
- **FR-006**: Every in-scope active item MUST have exactly one disposition: `north-star blocking`, `worthwhile post-release polish`, `duplicate`, or `stale`.
- **FR-007**: Every disposition MUST name the evidence, owner, next action, and falsifier that would change the classification.
- **FR-008**: PR #147 and PR #152 MUST remain classified as `worthwhile post-release polish` unless a packaged north-star failure demonstrates otherwise. The out-of-order #147 landing is recorded rather than reverted for sequence theater, but a later accepted exact-head review found two MAJOR false-green paths in its contrast oracle: active input/value plus enabled-submit states were not exercised, and unsupported modern computed colors were silently skipped. A post-079 targeted oracle repair MUST close both before final `A`; the token-correct CSS is not reverted. PR #152 MUST be judged only on a refreshed head containing `6b3fa9e` and re-run its card-fold/uncropped harness; its pre-`31b47c1` geometry table is not acceptance for the refreshed head.
- **FR-009**: Every local ref MUST be included in a complete-ref inventory and checked for remote containment; every zero-remote-containing tip MUST be preserved and classified before its branch/worktree can be closed or deleted. Named-worktree or fixed-branch scans are insufficient.
- **FR-010**: Recovery MUST preserve the existing Lectrice Constitution byte-for-byte unless a separate, explicit constitutional amendment is proposed under its governance rules.
- **FR-011**: Recovery MUST install and retain all ten upstream Pi Spec Kit lifecycle prompts so specification, clarification, planning, tasks, analysis, implementation, convergence, checklist, constitution, and task-to-issue workflows are available.
- **FR-012**: Delivery ownership MUST be explicit: Product owns the north star and queue classifications; Orchestrator owns sequence and the durable board row; Graph owns commit preservation; QA owns exact-head acceptance and independent findings; Control owns the deterministic recovery oracle and receipt; Knowledge owns repository/vault state reconciliation; Platform owns CI-capacity diagnosis without rewriting product verdicts.
- **FR-013**: Remaining sequencing after the recorded #147 deviation MUST be: (1) update and merge this 079 contract and Spec Kit integration; (2) preserve/classify the branch graph; (3) refresh, re-measure, and reconcile frozen PR #152 without losing unique commits; (4) run exact-head north-star acceptance; (5) generate an oracle-validated receipt and update repository/vault state; (6) move the recovery row through review only when the oracle passes.
- **FR-014**: A targeted-fix exemption MUST be limited to the smallest root-cause repair for one already-named failing north-star acceptance scenario; it MUST include fail-before/pass-after executable evidence, one owner/worktree, no new user outcome, no dependency or persisted-data change, no authority/security widening, and all normal CI, independent-review, user-gate, and merge controls.
- **FR-015**: If any FR-014 condition is absent, the work MUST receive a new specification and MUST NOT use the targeted-fix exemption.
- **FR-016**: Recovery artifacts MUST distinguish observed repository/release facts from dated or superseded notes and MUST bind claims to immutable identifiers where available.
- **FR-017**: No feature implementation is part of this contract landing; only Spec Kit integration and planning artifacts may change in the first pull request.
- **FR-018**: Final acceptance MUST use a two-phase commit invariant: the receipt records `accepted_main_sha = A`; the receipt-only commit `R` has first parent `A`; and validation at `R` proves `HEAD^ == A` and that `HEAD^..HEAD` changes only the explicitly enumerated receipt envelope. The receipt MUST NOT claim to contain its own commit SHA.

### Current Work Classification Baseline

Initial observation was `31b47c1`; live main advanced to `6b3fa9e` through the recorded #147 sequence deviation while this contract was being written.

| Item | Disposition | Product reason | Owner / next action | Classification falsifier |
|---|---|---|---|---|
| PR #147 — home contrast fixes plus exhaustive sweep | accepted `worthwhile post-release polish`; **MERGED out of order as `6b3fa9e`**, oracle follow-up required | CSS is token-correct and improves legibility; a later DeepSeek Pro exact-head gate found two MAJOR false-greens in the sweep (unexercised active controls; silent modern-color skips). These invalidate oracle completeness, not the product CSS. | No revert churn. After 079, one targeted test-only repair exercises active value/submit states and parses or fails closed on `color(srgb)`/`color-mix()`. | Either MAJOR remains reproducible, or the targeted repair changes product CSS instead of the oracle. |
| PR #152 — card metadata kept inside the library-grid fold | `worthwhile post-release polish` | Improves browseability; first-run Open and the resume line are separate public paths already on main. Its recorded geometry predates `31b47c1`, which inserted the cover-led resume block above the grid, so the outcome must be re-measured after refresh. | Orchestrator sequences after #147; Graph preserves tips; QA runs `scripts/card-fold-verify.sh` on the refreshed exact head. | The refreshed harness fails fold/uncropped acceptance, or the north-star journey cannot open/resume because the affected card is unusable. |
| Main `31b47c1` — empty-state Open plus cover-led resume | accepted evidence input, not active work | It closes audit gaps #3/#4 in code and unit evidence; the exact-head composed journey remains the acceptance gate. | QA includes it in the north-star exact-head run. | A public-control packaged run fails the empty-state open or resume path. |
| Audit gaps #2, #5, #6 — density, 1 px overflow, resume-bar proportion | `worthwhile post-release polish` | Measured/cosmetic or aesthetic; no demonstrated north-star failure. | Product keeps after the recovery train; require fresh measurement after #147/#152. | Fresh packaged evidence shows one blocks a north-star control or loses state. |
| Spec 078 later slices — config UI writer and hot reload | `worthwhile post-release polish` | Valuable declarative configuration work, but not required for a first-time reader to complete the loop. | Product re-ranks after recovery and current exact-head acceptance. | A north-star step is impossible without those settings being file-authored or hot-reloaded. |
| Credential-free/offline narration (spec 055 decision) | `worthwhile post-release polish` under the four-category policy | The shipped product explicitly requires an ElevenLabs key; a first reader must get an actionable setup path, but bundling a local voice is a new outcome. Spec 055 found the obvious JS path lacks the timing contract and leaves a Python/sidecar packaging cost. | Product may re-specify adoption after recovery; it does not outrank a broken current setup/Play path. | Evidence shows a supported configured reader still cannot start narration, making the current north-star path blocking rather than the offline alternative. |
| Local `145-home-ui` `9df4ba89` versus PR #147 head `511f70dc` | `duplicate` tip representation; PR #147 remains polish | Range-diff marks both feature commits equal, the five-file tree diff is empty, and local merge commits are clean unions. | **Preserved** as `origin/preserve/20260820-145-home-ui-deleted-after-147`; no content replay. | A non-empty file/tree diff or unequal patch-id appears. |
| Local `151-card-fold` `f2609fc7` versus PR #152 head `cf488dc82` | `duplicate` tip representation; PR #152 remains polish | Range-diff marks both feature commits equal and the four-file tree diff is empty. | **Preserved** as `origin/preserve/20260820-151-card-fold`; update/merge only the remote PR head after #147. | A non-empty file/tree diff or unequal patch-id appears. |
| Formerly local-only `122-dl2-close-owned` `6594d40a` | `duplicate` | Its tree is byte-identical to merged PR #125 squash `03aca597`; the reader outcome and accepted evidence are already on main. | **Preserved** as `origin/preserve/20260820-122-dl2-close-owned`; do not re-implement. | `git diff 03aca597 6594d40a` becomes non-empty. |
| Formerly local-only `125-contrast-aa` `26939d9f` | `duplicate` | Its tree is byte-identical to merged PR #123 squash `ecefd016`; its broader contrast work is already accepted on main. | **Preserved** as `origin/preserve/20260820-125-contrast-aa`; #147 is judged only on its incremental home-sweep value. | `git diff ecefd016 26939d9f` becomes non-empty. |
| Formerly local-only `143-fix-targetdir` `64248ad6` | `duplicate feature patch on stale base` | From the shared pre-feature base, the branch's combined feature patch-id equals merged PR #143 squash `8745d17e`; the whole trees differ because later main changes are absent from the stale branch. Whole-tree identity is explicitly not claimed. | **Preserved** as `origin/preserve/20260820-143-fix-targetdir`; do not replay it onto main. | A common-base combined patch-id or range-diff no longer matches the #143 squash patch; a raw whole-tree delta is expected and is not a falsifier. |
| 19 additional tips omitted by the first graph report | classification required from complete-ref inventory; preservation **complete** | `/tmp/lectrice-local-only-tips-20260820.tsv` lists every omitted local ref/SHA; all now have exact `origin/preserve/20260820-*` containment. Preservation does not itself decide duplicate versus stale. | T002 inventories and classifies all refs in the durable ledger; no cleanup before that ledger passes. | Any local tip lacks a remote-containing ref or the all-ref inventory omits a local ref. |
| Pushed `121-cover-pipeline` `6cfee0dd` | `duplicate` | Its accepted outcome landed through PR #126 squash `8ce48365`; the remote branch already preserves topology. | No replay; retain or clean only after dirty/untracked worktree proof. | A tree/outcome delta not present in #126 is demonstrated. |
| Pushed `147-home-audit` `01ec4fc7` | `duplicate` | Its audit/harness outcome landed through PR #150 squash `b4b74044`; remote topology is preserved. | No replay; later cleanup needs worktree cleanliness proof. | A content delta from #150 is demonstrated. |
| Parked `042-android-target` `f431f827` | `stale` | It is far behind current main, its flake half was superseded, and Android is outside the current Linux product claim. | Preserve remote branch; require a fresh platform spec before selecting surviving scaffolding. | A current-base, independently accepted Android objective and conflict-free patch is produced. |
| Parked `053-delivery-harness` `12c341e9` | `stale` | It is an incomplete early slice whose verify/release/packaged-gate premises have materially changed and mostly landed elsewhere. | Preserve remote branch; re-specify any demonstrably missing outcome instead of replaying the WIP. | A current-base gap matrix proves a unique unsuperseded outcome. |
| Zero-unique worktree tips `117`, `142`, `155-*` | `duplicate` commit state; uncommitted scratch is preservation-only | Their tips are merged/ancestor-equivalent, but dirty/untracked files are not commit evidence and cannot be discarded by this classification. | Do not replay commits; inventory and preserve/discard scratch through its owning lane before cleanup. | A committed or uncommitted content delta is accepted as a current product item. |

### Key Entities

- **North-Star Journey**: The ordered reader actions, starting state, acknowledged data, close/process boundary, relaunch state, and exact source revision that define product acceptance.
- **Work Item**: A pull request, audit gap, planned slice, or genuinely unique tip with identity, evidence, disposition, owner, next action, and falsifier.
- **Evidence Receipt**: A machine-readable record that binds acceptance commands, outcomes, artifacts, checks, and review to one immutable source revision.
- **Targeted-Fix Exemption**: A constrained eligibility record for repairing one named failed acceptance without inventing a new outcome or bypassing delivery controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One packaged first-reader run completes all six boundaries—fresh profile, open, narrate, normal close/process end, relaunch, resume—with zero acknowledged highlight or reading-position loss.
- **SC-002**: 100% of open recovery pull requests and **all local refs** appear in the complete-ref inventory; every in-scope item has exactly one disposition, owner, next action, and falsifier before reconciliation.
- **SC-003**: All zero-remote-containing tips are preserved by exact remote refs; the out-of-order #147 terminal state is recorded with its exact head, squash, ALLOW, and checks; #152 reaches a deliberate terminal state only after this contract lands and complete-ref classification/re-measurement finish.
- **SC-004**: All ten Pi Spec Kit lifecycle prompts are present while the Constitution's content hash remains unchanged from the pre-initialization baseline.
- **SC-005**: Every functional requirement maps to at least one executable task, and Spec Kit analysis reports zero CRITICAL or HIGH unresolved inconsistencies before implementation starts.
- **SC-006**: The final recovery receipt names accepted main `A` and every required acceptance/check artifact at `A`, including the repaired #147 contrast oracle; at receipt commit `R`, the oracle proves `R^ = A`, the `A..R` diff is receipt-only, and all receipt assertions pass without a model-authored verdict.
- **SC-007**: Repository backlog state and vault SAVE-STATE both name the accepted main revision, open-PR reality, and next product priority after recovery.

## Assumptions

- Linux AppImage/deb is the only shipped target; macOS and Windows claims remain outside this recovery.
- The deterministic narration fixture is the accepted automated substitute for live ElevenLabs in CI; live-provider quality remains separately scoped.
- Current GitHub/repository evidence supersedes the vault SAVE-STATE dated 10/08/2026 and older backlog statements.
- CI capacity is serialized; independent slices are merged one at a time rather than fanned out.
- Branch graph evidence may refine the `duplicate` versus `stale` disposition of individual divergent tips without changing the four-category policy or north star.

## Out of Scope

- New reader, narration, configuration, platform, or visual feature code in the 079 contract landing.
- A v0.2.1 release, release tag, deployment, or live-provider credential test.
- Constitution amendments.
- Deleting worktrees/branches or mutating PR #147/#152 from this Product landing.
- Selecting a new reader redesign direction or making subjective aesthetic decisions.
