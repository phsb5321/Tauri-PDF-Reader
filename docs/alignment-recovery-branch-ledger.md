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

`$ git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/preserve/20260820-*' | wc -l`

| Snapshot (20/08/2026) | Count |
|---|---|
| ~17:4x, first scan | 25 — the contract's 23 plus `20260820-151-card-fold` and `20260820-080-goal-speckit-enforcement-reopened`, added as #152/#155 reached terminal state |
| ~18:0x, after the §2 orphan was preserved | 26 |
| **18:29, latest re-measure** | **27** |
| Tip inventory input | `/tmp/lectrice-local-only-tips-20260820.tsv`, 19 tips (+122/125/143 and deleted local 145) |

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
| **18:29** | 62 | `158-north-star-journey` @ `c85ae76` (`test(079): compose first-reader journey`) |

- The first orphan was preserved at `origin/preserve/20260820-079-alignment-implementation`;
  by 18:29 that branch had **advanced to `1cfe931a`** and is contained by
  `refs/remotes/origin/079-alignment-implementation` (its seat pushed it).
- `158-north-star-journey` @ `c85ae76` was contained by **no** remote ref at 18:29 — an
  active seat's in-flight T023 work, seconds old, not abandoned.

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

| item_id | observed_sha | Test + result | category | owner | falsifier | preservation_state | terminal_state |
|---|---|---|---|---|---|---|---|
| `122-dl2-close-owned` | `6594d40` | `git diff --quiet 03aca59 6594d40` → exit **0** ⇒ tree-identical to PR #125's squash | `duplicate` | Graph | any file differing between `03aca59` and `6594d40` | preserved (`origin/preserve/20260820-*`) | not replayed; content on main |
| `125-contrast-aa` | `26939d9` | common-base `44a95d62`; combined patch-ids `2e3eb5e10f7c` (branch) ≠ `0e9800dc79a3` (`6b3fa9e`) ⇒ **not** equivalent | `stale` — its premise (pre-#147 contrast approach) is superseded by the merged `6b3fa9e` + #156 repair, and no accepted equivalent outcome is claimed for its unique content | Graph | equal combined patch-ids, or a file in it with no accepted equivalent on main, would move it out of `stale` | preserved | closed to replay; re-specify rather than resurrect |

### Stale-base 143 — combined patch-id / range-diff, never whole-tree identity

```bash
$ git merge-base 143-fix-targetdir 8745d17
17bfa6a7…
$ git diff 17bfa6a 143-fix-targetdir | git patch-id --stable
e4e065676d0d449a4dfeaf7c01eebc38a34855e4 0000000000000000000000000000000000000000
$ git diff 17bfa6a 8745d17 | git patch-id --stable
971873117e6fddef89675b49d1c286114a826ca0 0000000000000000000000000000000000000000
```

The combined patch-ids **differ** and the raw whole-tree delta is 25 files — both expected on
a stale base, and neither proves anything on its own. The discriminating evidence is per-file
identity plus the range-diff:

- **9 of the 10 files** `143-fix-targetdir` touches are **byte-identical to `origin/main`**:
  `.github/workflows/packaged-user-gate.yml`, `flake.nix`, `scripts/e2e-toolchain.sh`,
  `src/__tests__/integration/e2e-fixture-path-contract.test.ts`,
  `src/__tests__/integration/wdio-app-path-contract.test.ts`, `src/e2e-bridge.ts`,
  `src/services/pdf-service.e2e-seam.test.ts`, `src/services/pdf-service.ts`,
  `wdio.conf.mjs`.
- The tenth, `docs/agent-backlog-state.md`, is the branch's own checkpoint commit `3c5a421`.
  **No equivalence is claimed for it** — it is a backlog checkpoint, this PR supersedes its
  content, and neither tree nor patch equivalence was measured for that one file.
- `git range-diff 17bfa6a..143-fix-targetdir 17bfa6a..8745d17` lists six commits present only
  on the squash side — `b98bb97` (#144), `f63818e` (#142), `f4316ef` (#145), `b4b7404` (#150),
  `7904fa6` (#149), `6191228` (#146) — and, for the one paired commit
  (`cd91cf3` ↔ `8745d17`), an author-identity difference in the metadata block. Those
  intervening merges are what the combined patch-id difference measures.

| item_id | observed_sha | category | evidence | owner | falsifier | preservation_state | terminal_state |
|---|---|---|---|---|---|---|---|
| `143-fix-targetdir` | `64248ad` | `duplicate` **for its nine source files only** | 9/10 files byte-identical to `origin/main`; range-diff attributes the residual to six intervening merges + author identity | Graph | any of the nine differing from main, or a range-diff commit that is neither paired nor an intervening merge | preserved | not replayed; the doc-checkpoint file is superseded here, not proven equivalent |

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
| Preserved topology | `origin/151-card-fold` (exact PR head) + `origin/preserve/20260820-151-card-fold` (pre-refresh tip) |

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
| T002 | **done** | §2 — 62/62 tips contained after preservation, tree/patch-id/range-diff results, dirt inventory, merge-tree |
| T015 | **done** | §3 containment measurements |
| T016 | **open** | §3 — needs QA's artifact-backed re-run, not a PR comment |
| T017 | **done** | §3 terminal state + preserved heads |
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
