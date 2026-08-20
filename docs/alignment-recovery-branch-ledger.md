# Alignment Recovery — Branch & Reconciliation Ledger

Recovery-side ledger for spec `079-fleet-alignment-recovery`. The delivery ledger stays
`docs/agent-backlog-state.md`; this file carries preservation, containment, disposition and
task evidence. **It never claims a verdict about the commit that carries it** — the accepted
head `A` is bound only by `docs/alignment-recovery-receipt.json` at the receipt-only child
`R` (`R^ == A`). Freezing `A` is T022 and is not done here.

Every row below is a command result, run in a dedicated feature worktree
(`tauri-pdf-reader-079-backlog-reconcile`) on 20/08/2026. A PR body, title, task label or
model verdict is not evidence and none is used as such.

## 1. Preservation (T001 correction input, re-verified)

| Fact | Result |
|---|---|
| `origin/preserve/20260820-*` refs at first scan | 25 (the contract's 23 plus `20260820-151-card-fold` and `20260820-080-goal-speckit-enforcement-reopened`, both added as #152/#155 reached terminal state) |
| After the orphan below was preserved | **26** |
| Tip inventory input | `/tmp/lectrice-local-only-tips-20260820.tsv`, 19 tips (+122/125/143 and deleted local 145) |

The set is not static: every terminal PR and every reopened head added a preservation ref
before reconciliation touched it. That ordering — preserve, then reconcile — is the
work-disposition contract's falsifier, not a courtesy.

## 2. Complete local-ref enumeration and remote containment (T002)

Enumerated **dynamically over `refs/heads`**, not over named worktrees — 17 worktrees exist
and a worktree-scoped scan is exactly what produced the false three-tip report the contract
corrects.

```bash
git for-each-ref --format='%(refname:short)%09%(objectname)' refs/heads | while IFS=$'\t' read -r br sha; do
  git for-each-ref --contains "$sha" --format='x' refs/remotes/origin | head -1
done
```

| Measurement | Result |
|---|---|
| Local branches enumerated | **62** |
| Remotely contained on first scan | 61 |
| **Orphan found (no remote ref contained it)** | `079-alignment-implementation` @ `3878643`, 5 commits ahead of `origin/main`, working tree clean |
| Orphan after preservation | contained by `origin/preserve/20260820-079-alignment-implementation`; **re-scan: 0 orphans / 62 of 62 contained** |

The orphan is an **active sibling seat's** in-progress north-star implementation. Its worktree
is untouched, and **no content classification is recorded for it here** — containment is a
graph fact; disposition requires diff and owner evidence that belongs to that seat's lane.

### Tree equality — only where whole-tree identity is the right test

| Branch | Merged squash | Test | Result |
|---|---|---|---|
| `122-dl2-close-owned` @ `6594d40` | `03aca59` (PR #125) | `git diff --quiet` | **TREE-IDENTICAL** — duplicate, no replay |
| `125-contrast-aa` @ `26939d9` | `6b3fa9e` (PR #147) | common-base combined patch-id | branch `2e3eb5e10f7c` ≠ squash `0e9800dc79a3` → **not equivalent**; preserved, never replayed, and not claimed as a duplicate |

### Stale-base 143 — combined patch-id / range-diff, never whole-tree identity

Common base `17bfa6a`. Combined patch-ids **differ** (branch `e4e065676d0d`, squash
`971873117e6f`) and the raw whole-tree delta is 25 files — both expected, and neither proves
anything on its own. The discriminating evidence is per-file identity plus the range-diff:

- **9 of the 10 files** `143-fix-targetdir` touches are **byte-identical to `origin/main`**:
  `.github/workflows/packaged-user-gate.yml`, `flake.nix`, `scripts/e2e-toolchain.sh`,
  `src/__tests__/integration/e2e-fixture-path-contract.test.ts`,
  `src/__tests__/integration/wdio-app-path-contract.test.ts`, `src/e2e-bridge.ts`,
  `src/services/pdf-service.e2e-seam.test.ts`, `src/services/pdf-service.ts`,
  `wdio.conf.mjs`.
- The tenth is `docs/agent-backlog-state.md` — the branch's own checkpoint commit `3c5a421`,
  superseded by iteration #71.
- `git range-diff 17bfa6a..143-fix-targetdir 17bfa6a..8745d17` attributes the combined-patch
  difference to six intervening merged PRs present only on the squash side (#144, #142, #145,
  #150, #149, #146) plus an author-identity difference — not to missing feature content.

**Classification:** the 143 feature patch is fully contained on main; the raw combined
patch-id difference has a named, non-content cause. Topology preserved regardless.

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
| Final exact head `fe4725a9` | base `ed0e838` (the 079 contract merge); also contains `6b3fa9e`. Not behind — no further update was required |
| Terminal state | **CLOSED** 20/08/2026 19:54:19Z, per T017's "merge **or** close with the failed-harness reason" |
| Preserved topology | `origin/151-card-fold` (exact PR head) + `origin/preserve/20260820-151-card-fold` (pre-refresh tip) |

**T016 is NOT marked complete.** The `scripts/card-fold-verify.sh` run at `fe4725a9` was
executed by the closing seat and reports `single` PASS (light/dark, 1200 and 640) and `dual`
FAIL before theme/width completion — both cards ending at `y=745` against a grid fold ending
at `y=699`, so `visible.length` was 0 (`e2e/card-fold-verify.e2e.mjs:186`). That result is
recorded here for continuity, but its only surviving provenance is a PR comment, which the
work-disposition contract explicitly excludes as immutable evidence. Marking T016 done needs
QA's artifact-backed re-run at the exact head; this lane does not self-certify another lane's
executable gate.

## 4. Task status recorded by this lane

| Task | State | Basis |
|---|---|---|
| T002 | **done** | §2 — 62/62 tips contained after preservation, tree/patch-id/range-diff results, dirt inventory, merge-tree |
| T015 | **done** | §3 containment measurements |
| T016 | **open** | §3 — needs QA's artifact-backed re-run, not a PR comment |
| T017 | **done** | §3 terminal state + preserved heads |
| T018 | **done** | `docs/agent-backlog-state.md` iteration #71 — gaps #2/#5/#6, spec 078 slices 2–3, credential-free Kokoro, each with class + falsifier |
| T019 | **done — `requires-new-spec` by default** | No north-star fix is proposed at this head, so no `TargetedFixEligibility` record is claimed. The exemption is not pre-granted: any future candidate must satisfy every field (`failed_scenario`, `root_cause_scope`, `fail_before`, `pass_after`, `new_user_outcome=false`, `new_dependency=false`, `persisted_data_change=false`, `authority_or_security_widening=false`, `single_owner_worktree=true`) before it may skip a spec |
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
| T030 | `sha256sum .specify/memory/constitution.md` | `408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951` — **matches** the pre-init value recorded in 079 |
| T030 | `find .pi/prompts -maxdepth 1 -name 'speckit.*.md' \| wc -l` | **10** |
| T031 | `git diff --name-only ed0e838^..ed0e838` | every path under `.pi/`, `.specify/`, or `specs/079-fleet-alignment-recovery/`; **zero** paths outside those three |
| T029 | `check-prerequisites.sh --json --require-tasks --include-tasks` | exit **0**; `AVAILABLE_DOCS` = research, data-model, contracts/, quickstart, tasks |
| T028 | content review of this file and `docs/agent-backlog-state.md` | no credential, API key, private PDF content, live profile path, pairing/session capability data, or model transcript prose. Local absolute paths are limited to the repo worktree and the tip-inventory TSV named by the contract. `docs/alignment-recovery-receipt.json` does not exist yet, so no receipt claim is made about it |

## 6. Open, owned elsewhere

1. **T016** — QA re-run of `scripts/card-fold-verify.sh` at `fe4725a9`, or an explicit
   decision that a closed slice needs no artifact.
2. **Sibling-worktree dirt** (§2) — six worktrees, unreachable from any ref.
3. **`079-alignment-implementation`** — preserved, active, unclassified pending diff/owner
   evidence from its own seat.
4. **T022–T027** — freeze `A`, exact-`A` journey and checks, receipt at `R`, oracle run,
   `fleet-intel verify`. Nothing in this file substitutes for any of them.
