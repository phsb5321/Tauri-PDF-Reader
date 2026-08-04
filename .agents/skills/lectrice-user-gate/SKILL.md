---
name: lectrice-user-gate
description: Gate a Lectrice feature through seeded model fuzzing and a packaged Tauri user journey. Use when implementing, reviewing, or declaring complete any user-visible reader, library, navigation, persistence, TTS, settings, accessibility, or window behavior; also use for E2E, fuzz, soak, anomaly, and release-readiness work in this repository.
---

# Lectrice User Gate

Keep the agent that operates the app separate from the deterministic verdict.
Read [references/gate-contract.md](references/gate-contract.md) before changing a
journey, its oracle, or its evidence format.

## Run the gate

1. Confirm the repository root ends in `-NNN-slug`; create an isolated worktree
   before any mutation.
2. Map every changed user-visible behavior to a named journey and observable
   role/name/state assertion. Do not use CSS coordinates as the only contract.
3. Run the smallest deterministic tests first, then `pnpm test:fuzz`.
4. Build the packaged app and run the affected native WebdriverIO specification.
   Use `pnpm test:user-gate` only when both current native lanes are applicable.
5. Operate only through visible/accessibility controls. The observer may inspect
   logs, IPC, process health, and test fixtures, but must not perform an action
   for the actor.
6. Record the seed and action trace. Replay a discovered failure without an LLM
   before diagnosing it; retain the original failure even when replay is flaky.
7. Treat a missing driver, display, fixture, selector, or oracle as `BLOCKED`.
   Never convert an unrun journey into a pass.

## Commands

```bash
pnpm test:fuzz
FC_SEED=20260801 FC_NUM_RUNS=2000 pnpm test:fuzz
pnpm test:e2e
pnpm test:e2e:native
pnpm test:user-gate
```

The current native TTS lane is a deterministic replay, not proof that every
changed feature has an agent journey. Add a black-box spec for the affected
feature or report the exact missing public seam.

## Finish

Report the journey, build identity, seed, replay command, assertions, artifacts,
and anomaly observations. Completion requires deterministic checks plus the
packaged-app journey; an agent's visual opinion is never the verdict.
