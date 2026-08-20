# Quickstart: Fleet Alignment Recovery Validation

All commands run from a dedicated feature worktree. This guide is an ordered validation contract, not authorization to mutate frozen PR #152, branches, releases, the vault, or system configuration.

## 1. Validate the 079 contract landing

```bash
# Worktree and exact base
git rev-parse --show-toplevel
git rev-parse HEAD origin/main

# Upstream Pi integration: exactly ten lifecycle prompts
test "$(find .pi/prompts -maxdepth 1 -type f -name 'speckit.*.md' | wc -l)" -eq 10

# Constitution was preserved by init
sha256sum .specify/memory/constitution.md
# expected: 408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951

# Lifecycle artifacts resolve from the active feature
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Expected: feature directory is `specs/079-fleet-alignment-recovery`; spec, plan, and tasks exist; analysis has zero CRITICAL/HIGH issue and 100% buildable-requirement task coverage.

Before this PR merges, update the branch normally onto `origin/main` containing #147 squash `6b3fa9e`; do not force-push an already shared head.

## 2. Preserve graph before reconciliation

The original worktree-scoped ledger count of three was false. Use its amended version plus `/tmp/lectrice-local-only-tips-20260820.tsv`, enumerate **every local ref**, and verify all 23 exact preservation refs:

```bash
test "$(git for-each-ref --format='%(refname)' refs/remotes/origin/preserve/20260820-* | wc -l)" -eq 23
# For every local tip, prove at least one remote ref contains it; never scan only named worktrees.
```

The 23 refs preserve the 19 TSV tips plus 122/125/143 and deleted local 145. Re-run tree equality for 122/125 and **common-base combined patch-id/range-diff** for stale-base 143; a raw 143 whole-tree delta is expected. Preservation is complete, but untracked/modified files in sibling worktrees remain independent classification blockers.

## 3. Reconcile frozen #152 only after 079

Orchestrator—not this contract landing—authorizes the server-side normal update:

```bash
gh pr update-branch 152
gh pr view 152 --json headRefOid,baseRefOid,state,mergeStateStatus
```

On the refreshed exact head:

```bash
TMPDIR=/tmp bash scripts/card-fold-verify.sh
# then poll every required check; cancelled/missing is non-green
```

Expected: all seed/theme/width combinations preserve fold and `object-fit: contain` after main includes `31b47c1` and `6b3fa9e`. A failed re-measurement blocks merge but does not promote #152 to north-star blocking unless the north-star journey also fails because of it.

## 4. Run the composed north-star actor at candidate `A`

After every non-receipt Lectrice change and repository backlog update is merged, freeze candidate `A`. The QA slice adds and runs:

```bash
TMPDIR=/tmp bash e2e/run-north-star-journey.sh
```

Required ordered observations on one hermetic profile:

1. empty library and visible Open action;
2. valid PDF rendered;
3. no-key state exposes actionable setup;
4. configured fixture Play crosses the native boundary and advances narration state;
5. page/highlight state acknowledged;
6. normal close, window gone, original process ended;
7. new process starts;
8. public Resume opens the same document/page;
9. highlight remains.

Any bridge that acts for the reader, lingering original process, skipped step, or source SHA other than `A` is failure.

## 5. Create and validate receipt-only child `R`

At accepted `A`, generate `docs/alignment-recovery-receipt.json` with `accepted_main_sha=A`, then land it as the only enumerated change in child `R`.

At `R`:

```bash
test "$(git rev-parse HEAD^)" = "$(jq -r .accepted_main_sha docs/alignment-recovery-receipt.json)"
mapfile -t actual < <(git diff --name-only HEAD^..HEAD | LC_ALL=C sort)
mapfile -t allowed < <(jq -r '.receipt_envelope[]' docs/alignment-recovery-receipt.json | LC_ALL=C sort)
printf '%s\n' "${actual[@]}" | diff -u <(printf '%s\n' "${allowed[@]}") -

bash scripts/oracle-alignment-recovery.sh
bash scripts/test-oracle-alignment-recovery.sh
```

Expected: parent equals `A`, diff equals the explicit receipt envelope, both oracle commands exit 0. The receipt never claims its own commit SHA.

## 6. Final external gate

```bash
fleet-intel verify lectrice-alignment-recovery
```

Only this executable success moves the board row through review/done. A model's “PASS”, an open PR, or a tracked receipt with an unverified parent is not completion.

## Stop conditions

Stop immediately on Constitution hash drift, prompt count != 10, an unpreserved local-only tip, #152 mutation before 079, a non-receipt path in `A..R`, a credential in an artifact, or a north-star step without a runnable oracle.
