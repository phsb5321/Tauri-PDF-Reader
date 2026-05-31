# Codex Adversarial Review — 020-persisted-scope (S2)

- **Date:** 2026-05-31
- **Commit reviewed:** `8a90964` (pre-amend); comment-only fix amended to `42c1ef8` (logic identical).
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `Cargo.toml`, `Cargo.lock`, `src-tauri/src/lib.rs`. Adds `tauri-plugin-persisted-scope` 2.3.5 after `tauri_plugin_fs::init()`.

## Verdict: PASS

**BLOCKER:** none. **MAJOR:** none.

Confirmed by Codex:
- **No scope widening.** Static fs scope unchanged (`capabilities/default.json` still only `$APPLOCALDATA/**`); static asset scope unchanged (`tauri.conf.json` still `scope: []`).
- **Plugin order correct** — `tauri_plugin_fs::init()` initializes before `persisted_scope::init()`.
- **Local-only / no telemetry** — the persisted scope file lives in app data; no new network path. The plugin self-forbids fs access to its own `.persisted-scope` file after fs init.
- No new capability permission needed (plugin registers no commands). No secrets, no unrelated diffs, hexagonal boundaries intact, no direct `invoke()` added.

### MINOR
1. **(FIXED)** The original `lib.rs` comment / commit message said persisted-scope persists "only the exact files the user already opened." Codex: it serializes ALL current `scope.allowed_patterns()` — the static `$APPLOCALDATA/**` plus the runtime per-file grants — not only the picked files. No effective widening (the static pattern was already allowed), but the wording was inaccurate. Corrected in commit `42c1ef8` (comment + message now say "current allowed patterns … introduces no new/broader pattern").
2. **(Informational, no action)** Asset-protocol runtime grants are NOT persisted — the plugin's asset persistence is behind its own `protocol-asset` feature, which is not enabled. Codex: "fine and safer." Lectrice loads PDFs via `readFile`, not the asset protocol, so asset persistence is not needed.

### TEST GAPS (remaining manual verification)
- **Restart-reopen behavioral test not run** (needs GUI + file-picker interaction). Exact manual test: launch Lectrice → open a PDF from an arbitrary path (e.g. `~/Documents/x.pdf`) → fully quit → relaunch → open it from the library. WITHOUT this plugin the reopen `readFile(originalPath)` fails (scope lost on restart); WITH it, the reopen succeeds. Confirm success.
- No automated state-file inspection test asserting `.persisted-scope` contains only `$APPLOCALDATA/**` + picked-file grants.

Build verification (this iteration): `cargo fmt --check` clean, `cargo clippy --all-targets --features test-mocks -- -D warnings` clean, `cargo test --features test-mocks -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 resolves against tauri 2.9.5.

Full log: `/tmp/lectrice-020-codex.log`.
