# Alignment Recovery — Branch & Reconciliation Ledger

Recovery-side ledger for spec `079-fleet-alignment-recovery`. The delivery ledger stays
`docs/agent-backlog-state.md`; this file carries preservation, containment, disposition and
task evidence. **It never claims a verdict about the commit that carries it.** `A` is **not
frozen** and **no receipt exists yet**: when T022 freezes `A`, T024/T025 will record it in
`docs/alignment-recovery-receipt.json` at a receipt-only child `R` with `R^ == A`. Until
then there is no bound accepted head, and nothing here supplies one.

Every row below is a command result, run in a dedicated feature worktree
(`tauri-pdf-reader-079-backlog-reconcile`) on 20/08/2026. A PR body, title, task label or
model verdict is not evidence and none is used as such.

## 1. Preservation (T001 correction input, re-verified)

The refs are remote branches — `refs/heads/preserve/20260820-*` **on the remote**, which is
`refs/remotes/origin/preserve/20260820-*` locally. Running the local form against
`refs/heads/` returns 0 and means nothing.

```bash
$ git ls-remote --heads origin 'refs/heads/preserve/20260820-*' | wc -l
29
```

| Snapshot (20/08/2026) | Count |
|---|---|
| ~17:4x | 25 |
| ~18:0x, after the §2 orphan was preserved | 26 |
| 18:29 | 27 |
| **18:45, latest re-measure** | **29** |

Composition, measured rather than described (`comm` of the preserve names against the tip
inventory `/tmp/lectrice-local-only-tips-20260820.tsv`):

- **All 19 inventory tips have a preserve ref** — `comm -13` returns nothing.
- The contract's baseline of 23 = those 19 **including `151-card-fold`, which is inventory
  row 17** (an earlier draft of this table double-counted it) + `122-dl2-close-owned`,
  `125-contrast-aa`, `143-fix-targetdir` + the deleted local `145-home-ui`.
- The six beyond that baseline, each added as a head reached terminal or in-flight state:
  `079-alignment-implementation`, `079-alignment-implementation-final`,
  `080-goal-speckit-enforcement`, `080-goal-speckit-enforcement-reopened`,
  `156-contrast-oracle-false-green`, `158-north-star-journey-local`.

**Every count here is a point-in-time snapshot of a live graph, not a steady state.** Seats
are pushing while this runs, so a bare number without its timestamp is not a fact. What is
invariant is the ordering: a tip is preserved *before* anything reconciles it — the
work-disposition contract's falsifier, not a courtesy.

## 2. Complete local-ref enumeration and remote containment (T002)

Enumerated **dynamically over `refs/heads`**, not over named worktrees — 17 worktrees exist
and a worktree-scoped scan is exactly what produced the false three-tip report the contract
corrects.

```bash
$ git for-each-ref --format='%(refname:short)%09%(objectname)' refs/heads |
  while IFS=$'\t' read -r br sha; do
    n=$(git for-each-ref --contains "$sha" --format='%(refname)' refs/remotes/origin | wc -l)
    printf '%s\t%s\t%s\n' "$br" "${sha:0:8}" "$n"
  done > /tmp/scan.tsv
$ echo "branches=$(wc -l < /tmp/scan.tsv)  zero-container=$(awk -F'\t' '$3==0' /tmp/scan.tsv | wc -l)"
branches=62  zero-container=1
$ awk -F'\t' '$3==0 {print "  "$1"  "$2}' /tmp/scan.tsv
  158-north-star-journey  c85ae761
$ grep -P '^079-alignment-implementation\t' /tmp/scan.tsv
079-alignment-implementation	1cfe931a	1
```

Each row is `branch<TAB>tip<TAB>count-of-remote-refs-containing-it`; a `0` is an
unpreserved tip. Two scans were run and **the graph moved between them** — that is the
finding, not noise:

| Scan (20/08/2026) | Branches | Uncontained tip |
|---|---|---|
| ~17:5x | 62 | `079-alignment-implementation` @ `3878643`, 5 commits ahead of `origin/main`, clean worktree |
| 18:29 | 62 | `158-north-star-journey` @ `c85ae76` (`test(079): compose first-reader journey`) |
| **18:45, latest** | 62 | **none — `zero-container=0`, 62 of 62 contained** |

- The first orphan was preserved at `origin/preserve/20260820-079-alignment-implementation`;
  by 18:29 that branch had **advanced to `1cfe931a`** and is contained by
  `refs/remotes/origin/079-alignment-implementation` (its seat pushed it).
- `158-north-star-journey` @ `c85ae76` was contained by **no** remote ref at 18:29 — an
  active seat's in-flight T023 work, seconds old, not abandoned. By 18:45 it was preserved
  (`origin/preserve/20260820-158-north-star-journey-local`) and the scan was clean.

Both are **active sibling seats' work**. Their worktrees were not touched, and **no content
classification is recorded for either** — containment is a graph fact; disposition needs
diff and owner evidence from the lane that owns them. A single-shot enumeration is
therefore a snapshot with a timestamp, never a standing "0 orphans" guarantee; the durable
requirement is that nothing reconciles a tip that is not preserved *at that moment*.

### Tree equality — only where whole-tree identity is the right test

```bash
$ git diff --quiet 03aca59 6594d40; echo $?
0
```

Column values use the receipt schema's exact tokens (`category`, `preservation_state`,
`terminal_state` enums; `observed_sha` 40-hex) so a T024 receipt can copy them without
translation. Justification lives in the evidence column, never inside a state token.

| item_id | observed_sha | immutable_evidence | category | owner | next_action | falsifier | preservation_state | terminal_state |
|---|---|---|---|---|---|---|---|---|
| `122-dl2-close-owned` | `6594d40a8120d0ae66f304e24ace69aec1170141` | `git diff --quiet 03aca59 6594d40` → exit **0**: tree-identical to PR #125's squash | `duplicate` | Graph | none; do not replay | any file differing between `03aca59` and `6594d40` | `remote-preserved` | `preserved-only` |
| `125-contrast-aa` | `26939d9f405771926ba1236405f261778bd4013d` | **`git diff ecefd016 26939d9` → 0 lines, `git diff --quiet` exit 0**: byte-identical to PR #123's squash `ecefd016` | `duplicate` | Graph | none; do not replay | `git diff ecefd016 26939d9f` becomes non-empty | `remote-preserved` | `preserved-only` |

### Stale-base 143 — combined patch-id / range-diff, never whole-tree identity

**Correction.** An earlier revision of this section compared `git diff 17bfa6a 8745d17`
against the branch and reported the combined patch-ids as *differing*. That comparison is
wrong: its squash-side range carries six intervening merged PRs, so it measures the branch's
feature patch against "feature + six unrelated merges". The accepted spec baseline states
the equality from **the shared pre-feature base**, and measured that way it holds exactly:

```bash
$ git diff 17bfa6a 143-fix-targetdir | git patch-id --stable   # branch feature patch
e4e065676d0d449a4dfeaf7c01eebc38a34855e4 0000000000000000000000000000000000000000
$ git diff 8745d17^ 8745d17 | git patch-id --stable            # squash's own patch
e4e065676d0d449a4dfeaf7c01eebc38a34855e4 0000000000000000000000000000000000000000
```

**The combined feature patch-ids are equal** — `e4e065676d0d449a4dfeaf7c01eebc38a34855e4` on
both sides — confirming the spec's classification rather than contradicting it. The raw
whole-tree delta is 25 files, which is expected on a stale base and is explicitly not a
falsifier. Corroborating per-file evidence:

- **9 of the 10 files** `143-fix-targetdir` touches are **byte-identical to `origin/main`**:
  `.github/workflows/packaged-user-gate.yml`, `flake.nix`, `scripts/e2e-toolchain.sh`,
  `src/__tests__/integration/e2e-fixture-path-contract.test.ts`,
  `src/__tests__/integration/wdio-app-path-contract.test.ts`, `src/e2e-bridge.ts`,
  `src/services/pdf-service.e2e-seam.test.ts`, `src/services/pdf-service.ts`,
  `wdio.conf.mjs`.
- The tenth, `docs/agent-backlog-state.md`, is the branch's own checkpoint commit `3c5a421`,
  superseded by iteration #71 in this PR. The patch-id equality above already covers the item;
  this file is called out only so nobody reads "9 of 10" as a gap.
- `git range-diff 17bfa6a..143-fix-targetdir 17bfa6a..8745d17` lists six commits present only
  on the squash side — `b98bb97` (#144), `f63818e` (#142), `f4316ef` (#145), `b4b7404` (#150),
  `7904fa6` (#149), `6191228` (#146) — plus an author-identity difference in the one paired
  commit (`cd91cf3` ↔ `8745d17`). Those merges are exactly what the *wrong* comparison was
  measuring.

| item_id | observed_sha | immutable_evidence | category | owner | next_action | falsifier | preservation_state | terminal_state |
|---|---|---|---|---|---|---|---|---|
| `143-fix-targetdir` | `64248ad61cb13d7ec4798f4c5dcd8d757d13ca30` | combined feature patch-ids equal (`e4e0656…55e4` both sides, above); corroborated by 9/10 files byte-identical to `origin/main` | `duplicate` | Graph | none; do not replay onto main | a common-base combined patch-id or range-diff that no longer matches the #143 squash patch (a raw whole-tree delta is **not** a falsifier) | `remote-preserved` | `preserved-only` |

### Sibling-worktree dirt — independent classification blockers (unclassified by design)

Read-only scan; nothing was staged, committed, cleaned or removed in another seat's worktree.

| Worktree | Uncommitted |
|---|---|
| `-117-dl2-close` | 1 untracked (`src/__tests__/ui/dl2-instrument.test.tsx`) |
| `-121-cover-pipeline` | 1 untracked (`docs/evidence-121-cover-pipeline.md`) |
| `-122-dl2-close-owned` | 2 untracked (evidence/plane-prep notes) |
| `-125-contrast-aa` | 1 untracked (`EVIDENCE-125-CONTRAST.md`) |
| `-142-native-dialogs` | 2 untracked (native-dialog probe + runner) |
| `-155-anchor-concurrency` | **3 modified tracked files** (`packaged-gate-trust-anchor.yml`, `tools/check-packaged-gate-trust-anchor.mjs`, its fixture) |

Untracked and modified files are reachable from no ref, so preservation refs do **not** cover
them. They remain open classification blockers owned by their seats.

### #147 × #152 merge-tree

`git merge-tree --write-tree --name-only 6b3fa9e fe4725a9` → **exit 0**, tree
`968b132ae94c5760fe4e3e22f20c201f8b4d971b`, no conflict paths. **#152 was not closed for a
merge conflict** — it was closed on its own acceptance harness (§3).

## 3. #152 — refresh containment and terminal state (T015, T016, T017)

| Item | Evidence |
|---|---|
| Early refreshed head `2c525f96` | `git merge-base --is-ancestor 6b3fa9e 2c525f96` → **contains #147's squash** |
| Final exact head `fe4725a9` | `git merge-base --is-ancestor ed0e838 fe4725a9` → exit **0**: its base is `ed0e838`, which *was* `origin/main` when it was closed, so it was **not behind at close time** and needed no further update. `git rev-list --count fe4725a9..origin/main` → **2** today: main has since advanced by #157 `6294ed1` and #156 `4548cef` |
| Terminal state | **CLOSED** 20/08/2026 19:54:19Z, per T017's "merge **or** close with the failed-harness reason". T017 also requires green exact-head checks and independent review before that decision; **this lane did not observe review evidence** and does not certify that half — the recorded basis for the close is the harness result below |
| Preserved topology | measured, not assumed: `gh pr view 152 --json headRefOid` → `fe4725a9e6b09992f4e62c97579782b2ceb2b9c6`; `git rev-parse origin/151-card-fold` → the **same** SHA, and `git for-each-ref --contains fe4725a9` returns `refs/remotes/origin/151-card-fold`. The pre-refresh tip `f2609fc` is at `origin/preserve/20260820-151-card-fold`. Both the closed head and the pre-refresh tip are remote-preserved |
| #152 disposition | item_id `151-card-fold` · observed_sha `fe4725a9e6b09992f4e62c97579782b2ceb2b9c6` · category `worthwhile-post-release-polish` · owner QA · next_action re-specify against a current base if the fold behaviour is still wanted · falsifier a `card-fold-verify.sh` dual PASS at `fe4725a9` · preservation_state `remote-preserved` · terminal_state `closed-with-reason` |

**T016 is NOT marked complete, and the numbers below are attributed, not asserted.** The
closing seat *reports* that `scripts/card-fold-verify.sh` at `fe4725a9` gave `single` PASS
(light/dark, 1200 and 640) and `dual` FAIL before theme/width completion — both cards ending
at `y=745` against a grid fold ending at `y=699`, so `visible.length` was 0
(`e2e/card-fold-verify.e2e.mjs:186`). **This lane did not run it and does not vouch for those
values**; their only surviving provenance is a PR comment, which the work-disposition
contract excludes as immutable evidence. They are recorded as the stated reason for the
close, nothing more. Closing T016 needs QA's artifact-backed re-run at the exact head.

## 4. Task status recorded by this lane

| Task | State | Basis |
|---|---|---|
| T002 | **done** | §2 — three timestamped scans (last: 18:45, `zero-container=0`, 62 of 62); each uncontained tip found was preserved *before* anything reconciled it, which is the invariant the task protects. Containment is asserted **with its timestamp**, never as a standing property, plus tree/patch-id/range-diff results, dirt inventory, merge-tree |
| T007 | **done** | `docs/agent-backlog-state.md` iteration #71 — #147's pre-079 merge `511f70d` → `6b3fa9e`, the accepted post-merge oracle finding and no-revert decision, and #152's early refresh to `2c525f96` while OPEN/UNSTABLE |
| T015 | **done** | §3 containment measurements |
| T016 | **open** | §3 — needs QA's artifact-backed re-run, not a PR comment |
| T017 | **open** | §3 records the terminal state and preserved heads, but T017 also requires green exact-head checks **and independent review** before the close decision. This lane did not observe review evidence, so it does not check the box — same rule as T016 |
| T018 | **done** | `docs/agent-backlog-state.md` iteration #71 — gaps #2/#5/#6, spec 078 slices 2–3, credential-free Kokoro, each with class + falsifier |
| T019 | **done — vacuous at this head** | No north-star fix is proposed at this head, so there is no candidate to evaluate and **no `TargetedFixEligibility` record is claimed or pre-granted**. T019 must be re-run against any future fix proposal, which must satisfy every field (`failed_scenario`, `root_cause_scope`, `fail_before`, `pass_after`, `new_user_outcome=false`, `new_dependency=false`, `persisted_data_change=false`, `authority_or_security_widening=false`, `single_owner_worktree=true`) before it may skip a spec |
| T020 | **done** | Iteration #71 — live open-PR state, classifications, ownership, sequence deviation, next priority, written before `A` is frozen |
| T028 | **done** | §5 |
| T029 | **done** | §5 |
| T030 | **done** | §5 |
| T031 | **done** | §5 |

T003–T006 (schema, fixtures, oracle, negative-control run) belong to Control; T008 (seat goal
identifiers) and T022–T027 (freeze, journey, receipt, oracle at `R`) are not this lane's and
are deliberately left unmarked here.

## 5. Polish gates (T028–T031)

| Task | Command | Result |
|---|---|---|
| T030 | `sha256sum .specify/memory/constitution.md` | measured `408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951`; the value recorded in `tasks.md` T030 is `408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951` — **byte-equal** |
| T030 | `find .pi/prompts -maxdepth 1 -name 'speckit.*.md' \| wc -l` | **10** |
| T031 | `git diff --name-only ed0e838^..ed0e838` | every path under `.pi/`, `.specify/`, or `specs/079-fleet-alignment-recovery/`; **zero** paths outside those three |
| T029 | `check-prerequisites.sh --json --require-tasks --include-tasks` | exit **0**; `AVAILABLE_DOCS` = research, data-model, contracts/, quickstart, tasks |
| T028 | content review of this file and `docs/agent-backlog-state.md` | **no** credential, API key, private PDF content, pairing/session capability data, or model transcript prose. Scope stated exactly: both files do contain developer worktree paths of the form `~/Documents/Code/personal/tauri-pdf-reader-*` and the contract-named `/tmp/lectrice-local-only-tips-20260820.tsv` — the same convention every existing entry in the delivery ledger uses. Those are repository locations, not profile/session data, and none carries a secret. `docs/alignment-recovery-receipt.json` does not exist yet, so no claim is made about it |

## 6. Open, owned elsewhere

1. **T016** — QA re-run of `scripts/card-fold-verify.sh` at `fe4725a9`, or an explicit
   decision that a closed slice needs no artifact.
2. **Sibling-worktree dirt** (§2) — six worktrees, unreachable from any ref.
3. **`079-alignment-implementation`** (now `1cfe931a`, remotely contained) and
   **`158-north-star-journey`** (`c85ae76`, uncontained at the 18:29 scan) — active seats'
   in-flight work, unclassified pending diff/owner evidence from those lanes. Re-run the §2
   scan immediately before any reconciliation; do not treat its counts as durable.
4. **T022–T027** — freeze `A`, exact-`A` journey and checks, receipt at `R`, oracle run,
   `fleet-intel verify`. Nothing in this file substitutes for any of them.
