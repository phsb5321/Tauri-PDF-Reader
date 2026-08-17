# CI Runner Ops — vm103 (self-hosted GitHub Actions)

> Verified live 30/07/2026 via the browser-automation tab's ssh ground truth
> (the Lectrice tab made three "stuck runner" misdiagnoses that this doc exists
> to prevent).

## The runner

- **Name:** `tauri-pdf-reader-runner-vm103` (labels: `self-hosted, Linux, X64, vm103, tauri-pdf-reader`)
- **Host:** vm103 / hostname `githu-runner` / LAN `192.168.1.113` (reach via `ProxyJump` — NOT on Tailscale directly)
- **Topology:** Proxmox guest on node `home302server` (cluster: home301/302/303). The "GithubNode" guest.
- **Concurrency:** **single-slot** — drains the queue _serially_. This is the load-bearing fact.

## What "busy:true / 0 in-progress" actually means

It is **NOT a wedge.** It is a **transient job-transition window** between GitHub's view of the queue (`gh run list --status in_progress`) and the runner's local state. Three back-to-back false alarms in this project's history were all this pattern. Before escalating:

1. **Apply the 5-min falsifier test.** Wait 5 min, re-check. If a job completes (or a new one starts), the runner is healthy — do nothing.
2. **The hard-wedge threshold is: >15 min with NO local `Runner.Worker` process AND no new job pickup.** Below that, it's serial-queue draining.

## How to verify ground truth before acting

The GitHub Actions API (`gh api .../actions/runners`, `gh run list`) **lags** the actual runner state. The authoritative check is local on vm103:

```bash
# ssh to vm103 (via ProxyJump from the Dokku VM or hypervisor)
ssh -J notroot@100.99.218.39 notroot@192.168.1.113   # or however your topology routes
# Find the active Runner.Worker process + what it's running:
ps -ef | grep -iE 'Runner.Worker|Runner.listener' | grep -v grep
journalctl -u actions.runner.phsb5321-Tauri-PDF-Reader.tauri-pdf-reader-runner-vm103.service --since "10 min ago" | tail -30
# The journal will say "Running job: <name>" if a real job is in flight.
```

If a `Runner.Worker` process is alive + the journal shows a "Running job" line within the last 5 min, the runner is healthy — **do not restart** (would kill the in-flight job, e.g. Contract Tests ~8-10 min long).

## When to actually restart (the only condition)

Hard-wedge: **>15 min with no `Runner.Worker` process AND no new job pickup AND queue is non-empty.**

```bash
# On vm103:
sudo systemctl restart actions.runner.phsb5321-Tauri-PDF-Reader.tauri-pdf-reader-runner-vm103.service
```

Reversible — the runner re-registers on startup + picks up the queue.

## Red "Frontend Checks" is usually the cache upload, not a test

Check the timestamps before you read a single line of the diff. The job carries
`timeout-minutes: 10`, the vitest suite finishes in about 90 seconds, and the
rest of the wall clock belongs to the post-job `actions/cache` step uploading
the pnpm store. That upload does not merely run slow — it **stalls**:

```
21:28:50  Sent 543146203 of 677363931 (80.2%), 1.0 MBs/sec
   …      (byte counter identical for eight minutes)
21:36:40  Sent 543146203 of 677363931 (80.2%), 1.1 MBs/sec
21:37:01  ##[error]The operation was canceled.
```

`The operation was canceled` reads like someone hit the button. Nobody did; the
job hit its own 10-minute wall while blocked on a stalled upload. It killed
PR #51 and PR #53 on 31/07/2026, and both were diagnosed as code failures first.

It presented as **intermittent** — the same branch passed Frontend Checks in
2m12s an hour earlier — which is why it read as unrelated PRs going randomly red
rather than as one clean break. **Re-run the job. Do not touch the code.** Note
that it could not reliably clear itself: a save that never finishes writes no
cache entry, so the next run misses, tries to save, and stalls in the same place.

Runner-side tuning does not fix it. `pnpm store prune` on vm103 reclaimed only
about a quarter (1.5 GB → 1.05 GiB, `Removed 1704 packages`); what is left is
genuinely referenced by the dependency tree, so the tarball stays in the
hundreds of megabytes and the stall stays possible.

**Fixed on `main` by PR #52 (`3bcbf3d`, 31/07/2026): the pnpm cache step is
gone.** The runner is _persistent_ and its store lives at
`~/.local/share/pnpm/store`, outside the workspace — so it survives
`actions/checkout`'s clean and is already warm on the next run. The GitHub cache
round-trip was uploading a directory that never needed restoring. Frontend
Checks takes **1m17s** with the step removed.

**Do not assume the class is closed.** #52 removed the _pnpm_ cache; the two
Rust jobs still cache — `ci.yml:125` (Backend) and `:186` (Contract Tests) — and
what they cache is `~/.cargo/registry`, `~/.cargo/git` **and `src-tauri/target`**,
a multi-gigabyte directory, so their upload is considerably larger than the pnpm
store's ever was. Their walls are `timeout-minutes: 15` and `10`. A red Backend
Checks that dies at almost exactly 15 minutes with every substantive step green
in the log is this same failure wearing a different job name: re-run it, do not
read the diff. The "a persistent runner already has it on disk" argument applies
to the cargo caches at least as strongly — but `src-tauri/target` _is_ inside
the workspace, so unlike the pnpm store it does not survive `actions/checkout`,
and removing that cache is a real trade against cold Rust rebuilds rather than
the free deletion #52 was. Measure before copying the fix across.

## Why the queue stacks (and why that's fine)

Each push to `main` (merge) triggers multiple workflows:

- `CI` (Frontend + Backend + Contract Tests + Alignment Gate + Knip + type-coverage + Coverage)
- `sonar` (single scan job)
- `CodeQL` (runs on GitHub-hosted, not vm103 — finishes fast, doesn't count)

vm103 processes them **serially** (1 slot). A merge that triggers 2 CI runs + 1 sonar = ~25-35 min total drain time. Stacking multiple merges = proportionally longer. **This is expected**, not a bug.

## Mitigations (future work, Pedro-gated)

- **Add a second runner** (parallel slot) — would 2× throughput.
- **Auto-cancel superseded runs** on push to main (GitHub setting) — would drop the queue depth.
- **Post-container-restart hook** on Dokku/Proxmox to regenerate nginx upstreams (related but different — the home301server SonarQube 502 from earlier this session was a stale-upstream variant of this class).

## scars / lessons

1. **The `busy:true / 0 in-progress` API state ≠ wedge.** Verify via local `Runner.Worker` + journal before any restart call.
2. **The 5-min falsifier test catches transient job-transition windows.** Apply before escalating.
3. **Single-concurrency serial draining is normal** — the queue length is proportional to recent merges, not a wedge indicator.
4. **`##[error]The operation was canceled.` in Frontend Checks means the job timed out, not that a human cancelled it.** Read the last timestamp before the error and compare it to when the tests finished; an eight-minute gap of identical `Sent …` lines is the cache upload, not your diff.
5. **Cancel superseded runs by hand.** `ci.yml` has no `concurrency` group, so pushing to a branch queues a _second_ run rather than replacing the first, and on a one-slot runner the stale one is charged real minutes ahead of the live one. `gh run cancel <id>` on the run whose `headSha` no longer matches the PR head.

## Contract Tests `cancelled` with every step green — 16/08/2026

Same family as the Frontend Checks stall above, on the **restore** side. Run
`31928286378` at `3da0320` reported `cancelled` while every single step,
including `Run contract tests` and all post steps, reported success:

```
Set up runner            2m56s
Cache cargo registry     5m39s   <- restore of ~/.cargo + src-tauri/target
Run contract tests         59s
everything else            ~36s
                         ------
                         10m10s  against timeout-minutes: 10
```

The first attempt on the same SHA is a **separate, unresolved** event: its
`Run contract tests` step is recorded as `failure`, and its logs are already
gone (`BlobNotFound`), so the cause cannot be established either way. What is
known is that the suite passes locally at that exact SHA (62 tests, 6 binaries,
exit 0) and that the rerun's test step passed — which rules out a deterministic
failure, not a flaky test or a one-off environment fault. If it recurs with
logs intact, read them; do not assume this section explains it.

**For the `cancelled`-with-everything-green shape, do not read the diff.** The
wall went to 20 minutes first, which bought one green run and no more: on run
`31934817394` both Rust jobs died *inside* the cache step — Contract Tests
failed mid-restore at ~6 min, and Backend Checks ran 20 minutes and was
cancelled with **no steps recorded at all**.

So the cargo cache is now **gone** from both Rust jobs. `~/.cargo/registry`,
`~/.cargo/git` and the target dir all live in `$HOME` on a persistent runner
and already survive between jobs; `src-tauri/target` needed caching only
because it sat inside the workspace that `actions/checkout` cleans. Both jobs
now set `CARGO_TARGET_DIR=$HOME/ci-cargo/lectrice/target`, which removes the
reason to cache it. Same move as #52's pnpm-store deletion.

The directory is named `target` deliberately: `runner-gc.sh` prunes
directories named `target` idle for >6h, so a quiet week reclaims the disk
while a busy one keeps the artifacts warm. An in-use directory has a fresh
mtime and is not a candidate. If Rust CI ever starts rebuilding from scratch
every run, check whether that GC pass is firing between runs before suspecting
the workflow.

## CodeQL "Unable to locate executable file" — root-caused 15/08/2026

The symptom is a red `Analyze (javascript-typescript)` whose only error is:

```
##[error]Unable to download and extract CodeQL CLI: Unable to locate executable
file: …/_work/_tool/CodeQL/2.26.3/x64/codeql/codeql
```

It is **not** a workflow, permissions, or network problem, and re-running alone
only fixes it until the next cleanup pass. The host timer
`runner-cleanup.service` pruned the runner tool cache per file:

```bash
find "$d/_tool" -mindepth 1 -mtime +30 -delete   # the defect
```

A tool cache stores `<tool>/<version>/<arch>` beside a 0-byte
`<arch>.complete` marker the runner writes at install time, while the extracted
payload keeps its **upstream** mtimes — the CodeQL CLI ships files months older
than the install. So the prune deleted a tool installed minutes earlier, and
left behind precisely what `-delete` cannot remove: the directories, plus the
fresh marker. The cache then reads as installed and has no executable, and
every later run fails identically. Observed shape: `x64/codeql/` holding only
`java/ javascript/ qlpacks/ tools/`, no binary.

This is the same trap the script's own header documents for `_temp` (pnpm,
01/08/2026) — age is evidence of nothing for a reused or upstream-dated install.

**Fixed host-side** (`/usr/local/sbin/runner-cleanup.sh`): age the `.complete`
marker, the one file whose mtime really is install time, and evict marker and
payload together so a survivor cannot lie about what is cached. Falsifier run
on vm103 before deployment: a fresh install with a 2024-dated payload survives
(marker and binary both), and a genuinely 60-day-old install is reclaimed
whole, marker included — 4/4. After clearing the corrupt cache the CodeQL job
went green and the binary is present.

Reversal: `/usr/local/sbin/runner-cleanup.sh.bak-20260815`.

If it recurs: check `find _tool -name '*.complete'` against the presence of the
binary. A marker whose payload is missing means the install was deleted after
it completed — a post-install eviction of some kind, not a failed download.
This prune was one such deleter; a manual `rm` or filesystem damage leaves the
same shape, so confirm the deleter before blaming the timer again.

## Runner cleanup log rotation — resolved 15/08/2026

The hook previously wrote `/var/log/runner-cleanup.log.tmp` before `mv`. The
runner user owns the log file but cannot create a sibling inside root-owned
`/var/log`, so every rotation emitted `Permission denied` after otherwise-green
jobs.

The vm103 host hook now writes the trimmed tail to a mode-safe `mktemp` file in
`/tmp`, streams it back through the already-writable log file, and removes the
temporary file. Live validation with a correctly scoped `RUNNER_WORKSPACE`:
`rc=0`, log `7747 → 500` lines, stderr `0` bytes, leftover temp files `0`.
Backup/reversal: `/usr/local/bin/runner-cleanup-hook.sh.bak-20260815` can be
restored atomically, then `bash -n` rerun. This is host-local runner
configuration; no application workflow or gate was weakened.

## Every PR red with "FailedToDownloadActionException" (codeload 429) — 17/08/2026

The symptom is a PR whose every job dies in `Set up job` / `Set up runner`
before any checkout, with:

```
System.Net.Http.HttpRequestException: Response status code does not indicate
success: 429 (Too Many Requests).
  ... https://codeload.github.com/step-security/harden-runner/tar.gz/...
FailedToDownloadActionException: Failed to download archive ... after 3 attempts
```

It is **not** a diff, a workflow, or a GitHub outage. The runner re-downloads
every action because the host cleanup deleted the downloaded-actions cache.

Root-cause chain: vm103's disk crossed 85% → the `>85%` branch of
`/usr/local/sbin/runner-cleanup.sh` ran `rm -rf "$W"` over the **entire**
`_work` of every idle runner, not just the repo checkouts → that wiped
`_work/_actions` (the on-disk cache of downloaded actions) → the next job had to
re-fetch every action from `codeload.github.com` → codeload rate-limits the
shared runner pool and answers `429 Too Many Requests` → every job fails before
it starts. `_work/_actions` on the tauri runner was empty, and a live `curl` of
the harden-runner tarball returned 429.

This is the fourth instance of the class the script's own header already
documents three times — "the cleanup deleted a live cache": cargo target
(17/07/2026), nix store (25/07/2026), `_temp/setup-*` pnpm cache (01/08/2026),
and the CodeQL `_tool` eviction (14–15/08/2026) is the same shape one directory
over. `_actions` is a cache whose loss costs rate-limited re-downloads, not
disk — the whale is the repo checkouts and their build targets.

**Fixed host-side** (`/usr/local/sbin/runner-cleanup.sh`): the `>85%` prune now
deletes the repo-checkout directories while **preserving** the caches:

```bash
find "$W" -mindepth 1 -maxdepth 1 -type d \
  ! -name "_actions" ! -name "_tool" ! -name "_temp" \
  -exec rm -rf {} + 2>/dev/null
find "$W/_temp" -mindepth 1 ! -path "$W/_temp/setup-*" -delete 2>/dev/null
```

The other `_`-prefixed top-level entries (`_PipelineMapping`, `_github_*`) are
not exempted and are reclaimed too — per-job bookkeeping the runner recreates,
not rate-limited caches, so only the three caches above need explicit
preservation.

Falsifier run on vm103 before deployment (fake `_work` with `_actions`, `_tool`,
`_temp/setup-*`, a big checkout dir, and a stale `_temp` file): the three caches
survive, the checkout and the stale temp file are reclaimed, and the pre-fix
`rm -rf "$W"` form fails the `_actions`-survived assertion — 6/6.

Reversal: `/usr/local/sbin/runner-cleanup.sh.bak-20260817`.

If it recurs: first `ls _work/_actions` on the runner — an empty or missing
`_actions` means some deleter wiped the downloaded-actions cache and every job
will 429 until it repopulates. Check `runner-cleanup.log` for a `disk NN%
(>85)` line in the window before the failures; that line names the prune that
fired. This prune was the deleter here, but any `rm -rf` over `_work` leaves the
same shape.
