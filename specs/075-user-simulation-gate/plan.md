# Plan

1. Reuse the existing Vitest and WebdriverIO/`tauri-driver` harnesses.
2. Add only `fast-check` as a development dependency.
3. Add a repository-scoped Codex skill with a separate actor/observer contract.
4. Add a seeded command-model test for page navigation.
5. Expose focused fuzz and composed user-gate commands.
6. Emit and replay versioned typed fuzz traces, including minimized failures.
7. Validate the skill, package lock, focused model, types, and native command
   preconditions; retain native environment failures as blockers.
