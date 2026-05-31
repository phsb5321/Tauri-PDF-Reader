# Spec 020 — Persist fs Scope Across Restart (S2)

## Problem

S2 follow-up from Spec 008. Lectrice opens a PDF via the Tauri v2 dialog
`open()`, which auto-grants `fs_scope().allow_file(pickedPath)` at runtime — but
that grant is **in-memory and non-persistent**. After an app restart the grant
is gone, so reopening a library document via `readFile(originalPath)` fails
(the path is no longer in the fs scope). The library "reopen last document" UX
is therefore broken across restarts.

## Decision

Add `tauri-plugin-persisted-scope` (2.3.5) to the builder, **after**
`tauri_plugin_fs::init()` (it must hook the fs plugin's scope). On shutdown it
serializes the fs plugin's current allowed patterns to a local app-data file;
on the next launch it restores them, so previously-opened files remain
readable and the library reopens them without re-prompting.

### Scope-safety (hard rule: do not widen Tauri scopes)

The plugin persists the fs plugin's *existing* `allowed_patterns()` — the static
`$APPLOCALDATA/**` (already granted in `capabilities/default.json`) plus the
per-file runtime grants the user already triggered via `dialog.open()`. It
introduces **no new or broader pattern**, so the effective scope is unchanged
across restarts. Static fs scope and asset scope (`tauri.conf.json` `scope: []`)
are untouched. Codex-confirmed.

## Scope

- `src-tauri/Cargo.toml` — add `tauri-plugin-persisted-scope = "2"` (+ lockfile).
- `src-tauri/src/lib.rs` — `.plugin(tauri_plugin_persisted_scope::init())` after `fs::init()`.

No capability permission entry (plugin registers no commands). No frontend
change. No network/telemetry.

## Verification

- Build (nix-shell): `cargo fmt --check` clean; `cargo clippy --all-targets
  --features test-mocks -- -D warnings` clean; `cargo test --features test-mocks
  -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 resolves vs tauri 2.9.5.
- Codex adversarial review: VERDICT PASS, no BLOCKER/MAJOR
  (`.claude/reviews/020-persisted-scope.md`). One MINOR (comment accuracy) fixed.
- **REMAINING (manual, GUI):** restart-reopen behavioral test — open a PDF from
  an arbitrary path, quit, relaunch, reopen from the library; confirm it opens
  without re-prompting (fails without this plugin). Not run here (needs
  file-picker interaction); documented per the loop's "ship narrowest safe +
  document remaining task" allowance.

## Rollback

Revert the commit (drops the dep + the builder line). Library reopen returns to
its pre-020 behavior (works within a session; needs re-pick after restart). No
data/migration impact; an existing `.persisted-scope` file becomes inert.

## Checklist

- [x] Hexagonal boundaries: N/A (builder wiring only).
- [x] No direct `invoke()`: N/A.
- [x] Tauri capability/scope impact: no widening (persists existing patterns).
- [x] Secrets/privacy: local-only scope file; no network/telemetry; plugin
      self-forbids fs access to its own state file.
- [x] Offline behavior: unaffected (improves it — reopen without re-pick).
- [x] Frontend tests: N/A (no frontend change).
- [x] Backend tests: full backend suite passes with the plugin added.
- [x] Build/bundle smoke: cargo fmt/clippy/test green in nix-shell.
- [x] Accessibility impact: none.
- [x] Rollback: documented above.
- [x] Codex review: PASS.
- [ ] **Restart-reopen GUI behavioral test — REMAINING (manual).**
