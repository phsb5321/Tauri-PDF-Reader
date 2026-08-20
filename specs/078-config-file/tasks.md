# Tasks: User Config File (`config.toml`)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Slice 1 tasks are `T0xx`. Later slices are listed so the boundary is explicit
and nobody re-plans them mid-slice.

## Slice 1 — read-only config (branch `148-config-file`)

| ID | Task | File | Done when |
|---|---|---|---|
| T001 | Add `toml`, `serde_ignored` deps; `insta`, `proptest` dev-deps | `src-tauri/Cargo.toml` | `cargo build` resolves; no unused dep |
| T002 | Path resolution: `LECTRICE_CONFIG` override, else `dirs::config_dir()/lectrice/config.toml` | `config/paths.rs` | unit test covers both branches + absent file |
| T003 | Typed schema for the **17 enumerated keys**, `#[serde(default)]` on every field, one `Default` impl | `config/schema.rs` | `Config::default()` equals the documented defaults |
| T004 | Diagnostics: unknown-key warnings (`serde_ignored`) and span→`file:line:col` errors | `config/diagnostics.rs` | error string contains key + line + col |
| T005 | `schema_version` migration hook operating on raw `toml::Value` before deserialization | `config/migrate.rs` | absent/`0` version migrates to `1` |
| T006 | `load()` orchestration: absent ⇒ defaults + **no file created**; parse error ⇒ defaults + loud error | `config/mod.rs` | `LoadOutcome` carries config + warnings + error |
| T007 | `--generate-config`: commented template covering all 17 keys | `config/template.rs` | parsing the template yields `Config::default()` |
| T008 | Wire into startup; expose effective config to the frontend via one read-only command | `src-tauri/src/lib.rs`, `commands/config.rs` | app boots with file values applied |
| T009 | Golden fixtures + `insta` snapshots | `src-tauri/tests/fixtures/config/*.toml` | full file and partial file snapshots |
| T010 | Broken-file directory: type error, bad enum, bad array element, malformed syntax | `src-tauri/tests/fixtures/config/broken/*.toml` | each asserts the message names key AND line |
| T011 | `proptest` round-trip `Config → toml → Config` | `src-tauri/tests/config_roundtrip.rs` | identity holds |
| T012 | Migration fixtures | `src-tauri/tests/fixtures/config/migrations/*.toml` | v0 and versionless files load |
| T013 | Docs: README section + the divergence follow-up note | `README.md`, spec | user can find the path and the template command |

### Slice 1 explicitly EXCLUDES

- Any writer of the file (no `toml_edit`).
- Any watcher / hot reload (no `notify-debouncer-mini`).
- Removing the SQLite settings write path (that is the slice 2 demotion).
- Comment-preservation tests (nothing writes comments yet).

## Slice 2 — comment-preserving UI writer

| ID | Task |
|---|---|
| T101 | Add `toml_edit`; writer that mutates a parsed document in place |
| T102 | Settings UI commands write through the writer, not SQLite |
| T103 | Demote SQLite to data-only: remove settings write path, keep highlights/progress/cache |
| T104 | Comment-preservation test: hand-written comments, key order, formatting survive a UI toggle |
| T105 | Read-only file (home-manager symlink) ⇒ actionable error, not a crash |

## Slice 3 — hot reload

| ID | Task |
|---|---|
| T201 | `notify-debouncer-mini`, 150 ms debounce |
| T202 | Apply only on successful parse; keep the previous config on a parse error |
| T203 | Self-write guard so the UI writer does not trigger its own reload |
| T204 | Test: edit file → settings change without restart; broken edit → old config retained |
