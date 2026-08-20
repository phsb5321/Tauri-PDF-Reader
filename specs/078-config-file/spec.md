# Feature Specification: User Config File (`config.toml`)

**Feature Branch**: `148-config-file` (slice 1); spec dir `078-config-file`
**Created**: 2026-08-16
**Status**: Slice 1 in implementation
**Input**: Pedro: "I want to configure Lectrice from a FILE, like I configure Neovim / AwesomeWM / WezTerm."

## Problem

Every Lectrice setting lives in SQLite behind the Settings UI. There is **no user
config file at all**. A NixOS user cannot own the configuration declaratively:
`home-manager`'s `xdg.configFile` has nothing to write to, settings cannot be
version-controlled, and reproducing a machine means clicking through a GUI.

## Decision: TOML, not Lua (settled — do not re-litigate)

The format is **TOML**. The reasoning, from the SOTA survey:

- Every recent deliberate choice in this space moved **away from executable
  config**: Alacritty migrated YAML → TOML in v0.11, Ghostty ships flat
  `key = value`, Helix is TOML, Zathura uses a flat `zathurarc`.
- The apps that kept Lua — Neovim, AwesomeWM, WezTerm — did so because their
  config **is a program** (autocmds, layout algorithms, event handlers).
- Lectrice has ~17 scalar settings, **none algorithmic**. Lua would be
  over-engineering: a new runtime, a sandbox question, and a config that cannot
  be statically analysed or machine-edited.
- A declarative TOML file composes perfectly with `home-manager`
  (`xdg.configFile."lectrice/config.toml"`), which is how the target user wants
  to own it.

### Location and lifecycle (settled)

| Decision | Value | Rationale |
|---|---|---|
| Path | `$XDG_CONFIG_HOME/lectrice/config.toml` via `dirs::config_dir()` | NOT `app_config_dir` — that couples the path to the Tauri bundle identifier (`com.lectrice.reader`). The user's config path must be stable and predictable, independent of packaging. |
| Override | `LECTRICE_CONFIG=/path/to/file.toml` | Testing, multi-profile, and `nix run` experiments. |
| Absent file | Built-in defaults, **no file is created** | A config file the app wrote is a file the user did not write. Creating it on first run would fight `home-manager` (which owns a read-only symlink) and would present the user with a file they never chose. |
| Template | `--generate-config` prints a fully commented template to stdout | The user redirects it where they want: `lectrice --generate-config > ~/.config/lectrice/config.toml`. |

### The two-writers problem (settled — the hard part)

Two writers to one setting is the failure mode this feature must not create. The
resolution is **not** a precedence scheme (file-wins / db-wins / last-write-wins
are all unexplainable to a user the moment they disagree):

1. **The FILE is the single source of truth for SETTINGS.**
2. **SQLite is demoted to DATA only** — highlights, reading progress, recent
   files, TTS audio cache metadata, collections. These are data the user
   produces, not configuration the user authors.
3. **The Settings UI becomes a comment-preserving writer of the file** (via
   `toml_edit`), so a hand-edited, commented, hand-ordered file survives a UI
   toggle. The UI edits the same file the user edits.

This keeps one authority per class of state, so no precedence rule is ever
needed.

### Robustness rules (settled)

| Rule | Mechanism | Why |
|---|---|---|
| Unknown keys **warn**, never fail | `serde_ignored` | Never `deny_unknown_fields`: one typo (or a key from a newer version) must not brick the config. |
| Type errors name the key **and** `file:line:col` | `toml` crate spans | "invalid type: string, expected boolean" with no location is a bad error. |
| Schema evolution | top-level `schema_version` + migrations on raw `toml::Value` **before** deserialization | Migrating typed structs cannot express a shape change. |
| Field evolution | `#[serde(default)]` everywhere, `#[serde(alias = "old_name")]` for renames | An old file must keep working. |
| Secrets | **never** in the config file | The ElevenLabs API key is entered at runtime and is not persisted today; it stays that way. A config file is version-controlled and world-readable in a Nix store. |

## The schema — enumerated from settings that ACTUALLY exist today

Read from `src/stores/settings-store.ts`, `src-tauri/src/db/migrations.rs`,
`src-tauri/src/commands/settings.rs`, `src/domain/rendering/types.ts`, and
`src/stores/ai-tts-store.ts`. No key here is invented.

### Source 1 — SQLite `settings` table (key/value, JSON-encoded values)

| Existing key | TOML path | Type | Default (today) |
|---|---|---|---|
| `theme` | `appearance.theme` | `"light" \| "dark" \| "system"` | `"system"` |
| `highlight.defaultColor` | `highlight.default_color` | hex string | `"#FFEB3B"` |
| `highlight.colors` | `highlight.colors` | array of hex string | `["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"]` |
| `tts.rate` | `tts.rate` | float, 0.5–3.0 (clamped in store) | `1.0` |
| `tts.voice` | `tts.voice` | string \| null | `null` |
| `tts.followAlong` | `tts.follow_along` | bool | `true` |
| `telemetry.analytics` | `telemetry.analytics` | bool | `false` |
| `telemetry.errors` | `telemetry.errors` | bool | `false` |
| `render.qualityMode` | `render.quality_mode` | `"performance" \| "balanced" \| "ultra"` | `"balanced"` ⚠️ |
| `render.maxMegapixels` | `render.max_megapixels` | integer, validated 8–48 on write | `24` ⚠️ |
| `render.hwAccelerationEnabled` | `render.hw_acceleration` | bool | `true` |
| `render.debugOverlayEnabled` | `render.debug_overlay` | bool | `false` |

### Source 2 — SQLite `cache_settings` table

| Existing key | TOML path | Type | Default (today) |
|---|---|---|---|
| `max_size_bytes` | `cache.max_size_bytes` | integer (bytes) | `5368709120` (5 GiB) |
| `eviction_policy` | `cache.eviction_policy` | `"lru"` | `"lru"` |

### Source 3 — `localStorage` (zustand `ai-tts-storage`, persisted preferences)

| Existing key | TOML path | Type | Default (today) |
|---|---|---|---|
| `selectedVoiceId` | `ai_tts.voice_id` | string \| null | `"21m00Tcm4TlvDq8ikWAM"` |
| `speed` | `ai_tts.speed` | float, 0.5–4.5 (clamped) | `1.0` |
| `autoPageEnabled` | `ai_tts.auto_page` | bool | `true` |

**17 config keys total.**

### ⚠️ Pre-existing divergence found while enumerating (recorded, not fixed here)

Two render defaults disagree between backend and frontend **on main today**:

- `render.qualityMode`: Rust `RenderSettings::default()` = `"balanced"`,
  TS `DEFAULT_RENDER_SETTINGS` = `"ultra"`.
- `render.maxMegapixels`: Rust default = `24`, TS default = `0` — and the Rust
  write path rejects anything outside `8..=48`, so the TS default `0` can never
  be persisted.

The config file must have exactly ONE default per key. **Slice 1 adopts the Rust
defaults** (`"balanced"`, `24`), because the Rust reader is the process that
resolves config at startup and the Rust value is what actually survives a write.
Reconciling the TS constants is out of scope for this feature and is filed as a
follow-up.

### Explicitly NOT config (stays SQLite = DATA, or stays out entirely)

- `lastCleanShutdown` — crash-detection state the app writes, not user config.
- highlights, documents, reading progress, `tts_cache_metadata`, collections.
- **ElevenLabs API key** — a secret, entered at runtime, not persisted today.

## User Scenarios & Testing

### User Story 1 — Own the config declaratively (Priority: P1) — SLICE 1

Pedro writes `~/.config/lectrice/config.toml` by hand (or through
`home-manager`'s `xdg.configFile`), starts Lectrice, and the app comes up with
those settings applied.

**Independent Test**: write a file setting `appearance.theme = "dark"` and
`tts.rate = 1.5`, start the app, observe dark theme and rate 1.5 without
touching the Settings UI.

**Acceptance Scenarios**:

1. **Given** no config file exists, **When** the app starts, **Then** every
   setting takes its built-in default and **no file is created**.
2. **Given** a config file setting a subset of keys, **When** the app starts,
   **Then** the named keys are applied and unnamed keys keep their defaults.
3. **Given** `LECTRICE_CONFIG` points at a file, **When** the app starts,
   **Then** that file is used and the XDG path is ignored.
4. **Given** a file containing `[tts] ratee = 1.5` (typo), **When** the app
   starts, **Then** the app starts normally, the setting keeps its default, and
   a warning names the unknown key `tts.ratee`.
5. **Given** a file containing `[tts] rate = "fast"`, **When** the app starts,
   **Then** the error names the key **and** the line/column, and the app falls
   back to built-in defaults rather than starting half-configured.
6. **Given** any state, **When** the user runs `--generate-config`, **Then** a
   commented template covering all 17 keys with their real defaults is printed
   to stdout, and that output parses back cleanly.

### User Story 2 — Settings UI writes the file, comments survive (Priority: P2) — SLICE 2

**Not in slice 1.** The UI writes through `toml_edit`; a hand-written comment,
key order, and formatting survive a UI toggle.

### User Story 3 — Hot reload (Priority: P3) — SLICE 3

**Not in slice 1.** `notify-debouncer-mini` at 150 ms; apply only on a
successful parse; keep the previous config on a parse error; guard the
self-write reload loop.

## Slice boundaries

| Slice | Scope | Branch |
|---|---|---|
| **1 (this PR)** | **Read-only**: resolve path, parse at startup, apply to settings, warn on unknown keys, honest errors with line/col, `schema_version` + migration hook, `--generate-config`. **No UI writer, no hot reload.** | `148-config-file` |
| 2 | Comment-preserving UI writer (`toml_edit`); SQLite demoted to data. | later |
| 3 | Hot reload (debounced watcher, parse-error retention, self-write guard). | later |

## Success Criteria

- **SC-001**: A user can set any of the 17 keys in a file and see it applied at
  startup, with no Settings-UI interaction.
- **SC-002**: A file with an unknown key still starts the app; the key is named
  in a warning.
- **SC-003**: A file with a type error produces a message containing the key,
  the line, and the column.
- **SC-004**: With no file present, no file is created anywhere on disk.
- **SC-005**: `--generate-config` output round-trips: parsing it yields exactly
  the built-in defaults.

## Decisions forced by the exact-head review (17/08/2026)

The different-family adversarial gate on `b804b47` returned ALLOW with findings
that changed the design, not just the code:

1. **A wrong key in an error message is worse than no key.** The key-recovery
   heuristic must be conservative: anything that could be misread — text inside
   a `"""`/`'''` multi-line string, an array element that looks like a table
   header (`["a", "b"],`), a half-quoted fragment (`"aa` from `"aa=bb",`) —
   yields no key rather than a guess. The position is always reported, so the
   user is never left without a location.
2. **The frontend seed may not write `undefined`.** zustand shallow-merges, so
   an `undefined` in the patch overwrites a stored value. The seed filters its
   patch locally instead of relying on the Rust serializer emitting every field
   (an invariant invisible at the TypeScript boundary). `tts.voice`'s explicit
   `null` is a real value and survives.
3. **A future `schema_version` is reported, not silently run.** The keys this
   build understands still apply; the user is told the file came from a newer
   Lectrice.
4. **Migration notes are their own warning variant.** Reusing the "clamped"
   variant would let slice 2's writer misclassify them.
5. **The error reporter must not panic.** A span landing mid-codepoint would
   have panicked while formatting the message — a bad config crashing the app.

## Out of scope

- Per-document overrides; keybinding configuration (no keybinding registry
  exists to bind to); theming beyond the existing three-value `theme`; any
  secret material.
