# CI Runner Ops — vm103 (self-hosted GitHub Actions)

> Verified live 30/07/2026 via the browser-automation tab's ssh ground truth
> (the Lectrice tab made three "stuck runner" misdiagnoses that this doc exists
> to prevent).

## The runner

- **Name:** `tauri-pdf-reader-runner-vm103` (labels: `self-hosted, Linux, X64, vm103, tauri-pdf-reader`)
- **Host:** vm103 / hostname `githu-runner` / LAN `192.168.1.113` (reach via `ProxyJump` — NOT on Tailscale directly)
- **Topology:** Proxmox guest on node `home302server` (cluster: home301/302/303). The "GithubNode" guest.
- **Concurrency:** **single-slot** — drains the queue *serially*. This is the load-bearing fact.

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
