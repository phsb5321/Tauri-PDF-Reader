# Implementation Plan: User Config File (`config.toml`)

**Spec**: [spec.md](./spec.md) · **Slice 1 branch**: `148-config-file`
**Created**: 2026-08-16

## Architecture placement

The config file is resolved and parsed in **Rust**, at startup, before the
WebView is created. It is not a frontend concern: `render.hw_acceleration` must
be known *before* the WebView exists (see `src-tauri/src/hw_accel.rs`), and the
frontend has no filesystem authority under the Tauri capability model.

Hexagonal placement, following the existing layout:

```
src-tauri/src/config/            # NEW — the config module (slice 1)
  mod.rs                         # public surface: Config, load(), LoadOutcome
  schema.rs                      # the 17-key typed schema, serde defaults/aliases
  paths.rs                       # dirs::config_dir() + LECTRICE_CONFIG override
  diagnostics.rs                 # warnings + span-carrying errors (file:line:col)
  migrate.rs                     # schema_version migrations on raw toml::Value
  template.rs                    # --generate-config commented template
```

`config` is a **leaf module**: it depends on `serde`/`toml`/`dirs` only, never on
`db`, `commands`, or `tauri::State`. That keeps it unit-testable without a
database, a Tauri context, or a display.

### Data flow (slice 1)

```
startup (lib.rs run())
  └─ config::load()                    → LoadOutcome { config, warnings, error }
       ├─ paths::resolve()             → LECTRICE_CONFIG ?? dirs::config_dir()/lectrice/config.toml
       ├─ absent                       → Config::default(), no file written
       ├─ read + toml::from_str::<toml::Value>()
       ├─ migrate::apply(&mut value)   → schema_version 0/absent → current
       └─ serde_ignored::deserialize() → Config + unknown-key warnings
  └─ warnings/errors → tracing::warn!/error! (one line per finding)
  └─ Config stored in Tauri state; exposed to the frontend by ONE new
     read-only command `config_get_effective`
```

The frontend's existing settings stores keep working unchanged: slice 1 makes
the config file **seed** the effective values at startup. Demoting SQLite to
data-only (removing the write paths) is slice 2 — doing both at once would make
the diff unreviewable and un-revertible.

### Why the effective config is exposed as one command

The frontend already loads settings via `settingsGetAll()`. Slice 1 adds
`config_get_effective` rather than rewriting that path: the stores call it at
boot and use it as their initial value, which is one call site per store and a
one-line revert. Rewriting `settingsGetAll` to be config-backed is slice 2's
job, together with the write-path removal.

## Key technical decisions

| Decision | Choice | Rationale |
|---|---|---|
| Parse target | `toml::Value` first, then `serde_ignored::deserialize` into `Config` | Migrations must run on the raw shape, before typing. |
| Unknown keys | collect paths via `serde_ignored`, emit `tracing::warn!` | Never `deny_unknown_fields` (spec rule). |
| Error location | `toml::de::Error::span()` mapped to line/col by counting newlines in the source | The `toml` crate gives a byte span; the module converts it to `file:line:col`. |
| Parse failure policy | fall back to **built-in defaults** for the whole file, and say so loudly | A half-applied config is worse than a default one: the user cannot predict which half. |
| Defaults | `#[serde(default = "...")]` per field, one `Default` impl that is the single source | `--generate-config` and the tests read the same defaults; they cannot drift. |
| Naming | TOML uses `snake_case` (`follow_along`), mapped to the existing camelCase SQLite keys at the boundary | TOML convention; the SQLite key strings are an implementation detail of the old store. |
| `schema_version` | `u32`, current `1`; absent ⇒ treated as `1` | A file written today needs no version line to keep working. |

## Testing strategy (slice 1)

| Tier | Tool | What it proves |
|---|---|---|
| Golden fixtures | `insta` snapshots | A representative file parses to exactly the expected `Config`; the `--generate-config` template snapshot cannot drift silently. |
| Broken-file directory | one `.toml` per failure mode + assertions | Each error message names **the key** AND **the line**. Type error, bad enum value, wrong array element type, malformed syntax. |
| Unknown keys | fixture with typo'd key | App still parses; the warning names the full dotted path. |
| Round-trip | `proptest` | `Config → toml::to_string → parse` is the identity for arbitrary valid configs. |
| Migration | fixtures per version | A `schema_version = 0` (or absent) file migrates to current and deserializes. |
| Defaults ≡ template | unit test | Parsing the `--generate-config` output yields `Config::default()` (SC-005). |
| Path resolution | unit test with env override | `LECTRICE_CONFIG` wins; XDG fallback is used otherwise; absent file yields defaults and creates nothing. |

Comment-preservation tests belong to slice 2 (there is no writer in slice 1).

## Dependencies added (slice 1 only)

```toml
toml = "0.8"            # parse + spans
serde_ignored = "0.1"   # unknown-key warnings
# dirs = "6.0.0"        # ALREADY a dependency — no change
```

`toml_edit`, `notify-debouncer-mini`, `schemars`, `insta`+`proptest` beyond dev
usage are deliberately deferred: `toml_edit` and `notify-debouncer-mini` have no
call site until slices 2 and 3, and adding an unused dependency is exactly the
kind of thing the alignment gate should catch.

`insta` and `proptest` are added as **dev-dependencies** in slice 1 because the
tests above use them.

## Risks

| Risk | Mitigation |
|---|---|
| A user's existing SQLite settings silently stop being honoured | Slice 1 does **not** remove the SQLite path; the file *seeds* startup values. The demotion is slice 2, announced in the spec and the PR body. |
| `dirs::config_dir()` differs on macOS (`~/Library/Application Support`) | Documented in the template header; `LECTRICE_CONFIG` is the escape hatch. Linux is the primary target. |
| Config parse cost at startup | One file read of a ~2 KB file; measured in the startup test, not assumed. |

## Slice 1 definition of done

- `cargo test --features test-mocks` green, including the new config tests.
- `cargo clippy -- -D warnings` and `cargo fmt --check` clean.
- Frontend untouched except the one boot-time call site per affected store.
- PR body states the key list and the two-writers decision.
- CI green; exact-head different-family review; squash-merge.
