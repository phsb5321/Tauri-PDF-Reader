//! The user config file (`config.toml`) — slice 1: READ-ONLY.
//!
//! Lectrice reads `$XDG_CONFIG_HOME/lectrice/config.toml` (override:
//! `LECTRICE_CONFIG`) at startup and uses it as the source of truth for
//! settings. See `specs/078-config-file/spec.md` for the decision record; the
//! parts that matter when reading this code:
//!
//!   * **The file is the source of truth for SETTINGS**; SQLite is data
//!     (highlights, reading progress, cache metadata). Slice 1 makes the file
//!     *seed* the effective settings at startup; slice 2 moves the writer and
//!     retires the SQLite settings path. There is deliberately no precedence
//!     scheme — a precedence rule is unexplainable the moment two writers
//!     disagree.
//!   * **An absent file is normal.** Defaults apply and NOTHING is written:
//!     a config file the app authored is a file the user did not, and it would
//!     fight a `home-manager` symlink.
//!   * **Unknown keys warn, never fail.** One typo must not brick the config.
//!   * **A broken file falls back to defaults WHOLESALE**, loudly. Half-applying
//!     a file the parser rejected leaves the user unable to predict which half
//!     survived.
//!
//! This module is a leaf: it depends on serde/toml/dirs and nothing else in the
//! crate, so every branch below is unit-testable without a database, a Tauri
//! context or a display.

pub mod diagnostics;
pub mod migrate;
pub mod paths;
pub mod schema;
pub mod template;

use std::path::{Path, PathBuf};

pub use diagnostics::{ConfigError, Warning};
pub use schema::Config;

/// Everything one config load produced.
#[derive(Debug, Clone)]
pub struct LoadOutcome {
    /// The config to run with. Always usable: defaults when the file is absent
    /// or unreadable.
    pub config: Config,
    /// The path consulted, when there was one.
    pub path: Option<PathBuf>,
    /// True when a file was found and successfully applied.
    pub loaded: bool,
    /// Non-fatal findings (unknown keys, clamped values, migration notes).
    pub warnings: Vec<Warning>,
    /// Set when a file existed but could not be used; `config` is the defaults.
    pub error: Option<ConfigError>,
}

impl LoadOutcome {
    fn defaults(path: Option<PathBuf>) -> Self {
        Self {
            config: Config::default(),
            path,
            loaded: false,
            warnings: Vec::new(),
            error: None,
        }
    }
}

/// Resolve the config path and load it.
pub fn load() -> LoadOutcome {
    match paths::resolve() {
        Some(path) => load_from(&path),
        None => LoadOutcome::defaults(None),
    }
}

/// Load a specific file. An absent file yields defaults and creates nothing.
pub fn load_from(path: &Path) -> LoadOutcome {
    let source = match std::fs::read_to_string(path) {
        Ok(source) => source,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            // The common case for a fresh install. Not a warning: choosing not
            // to have a config file is a valid choice.
            return LoadOutcome::defaults(Some(path.to_path_buf()));
        }
        Err(err) => {
            let mut outcome = LoadOutcome::defaults(Some(path.to_path_buf()));
            outcome.error = Some(ConfigError::from_io(path, &err));
            return outcome;
        }
    };

    let mut outcome = parse(path, &source);
    outcome.path = Some(path.to_path_buf());
    outcome
}

/// Parse config source text. Split out from [`load_from`] so every branch is
/// testable without touching the filesystem.
pub fn parse(path: &Path, source: &str) -> LoadOutcome {
    let mut warnings = Vec::new();

    // 1. Untyped parse first — migrations must see the raw shape, and a syntax
    //    error should be reported before any schema question.
    let mut document: toml::Value = match toml::from_str(source) {
        Ok(document) => document,
        Err(err) => {
            let mut outcome = LoadOutcome::defaults(Some(path.to_path_buf()));
            outcome.error = Some(ConfigError::from_toml(path, source, &err));
            return outcome;
        }
    };

    // 2. Migrate the untyped document up to the current schema.
    let migration = migrate::apply(&mut document);
    for note in &migration.notes {
        warnings.push(Warning::Schema {
            detail: note.clone(),
        });
    }

    // 3. Deserialize. When nothing was migrated (the overwhelmingly common
    //    case) we deserialize from the ORIGINAL text, so error spans point at
    //    the user's own lines. A migrated document has to be re-rendered first,
    //    and its spans necessarily refer to that rewritten text — the error
    //    below says so rather than pretending otherwise.
    let (text, spans_are_original) = if migration.changed {
        match toml::to_string(&document) {
            Ok(rendered) => (rendered, false),
            Err(err) => {
                let mut outcome = LoadOutcome::defaults(Some(path.to_path_buf()));
                outcome.error = Some(ConfigError {
                    file: path.display().to_string(),
                    position: None,
                    key: None,
                    message: format!("could not apply schema migration: {err}"),
                });
                return outcome;
            }
        }
    } else {
        (source.to_string(), true)
    };

    let deserializer = toml::Deserializer::new(&text);
    let mut unknown_keys: Vec<String> = Vec::new();
    let parsed: Result<Config, toml::de::Error> =
        serde_ignored::deserialize(deserializer, |path| unknown_keys.push(path.to_string()));

    let mut config = match parsed {
        Ok(config) => config,
        Err(err) => {
            let mut error = ConfigError::from_toml(path, &text, &err);
            if !spans_are_original {
                error.message = format!(
                    "{} (position refers to the migrated document, not the file as written)",
                    error.message
                );
            }
            let mut outcome = LoadOutcome::defaults(Some(path.to_path_buf()));
            outcome.error = Some(error);
            return outcome;
        }
    };

    for key in unknown_keys {
        warnings.push(Warning::UnknownKey { path: key });
    }

    // 4. Clamp the ranges the app enforces elsewhere, reporting each clamp.
    for detail in config.clamp() {
        warnings.push(Warning::Clamped { detail });
    }

    // 5. Enforce the first local-provider trust boundary as a whitelist. This
    // is intentionally stricter than URL parsing: a denylist misses private,
    // link-local, IPv6 and credential-bearing variants.
    if config.ai_tts.provider == schema::AiTtsProvider::Local
        && config.ai_tts.local_url.as_deref() != Some(schema::LOCAL_TTS_URL)
    {
        let mut outcome = LoadOutcome::defaults(Some(path.to_path_buf()));
        outcome.error = Some(ConfigError {
            file: path.display().to_string(),
            position: None,
            key: Some("ai_tts.local_url".to_string()),
            message: format!(
                "local TTS requires the exact destination `{}`",
                schema::LOCAL_TTS_URL
            ),
        });
        return outcome;
    }

    LoadOutcome {
        config,
        path: Some(path.to_path_buf()),
        loaded: true,
        warnings,
        error: None,
    }
}

/// Emit an outcome's findings through `tracing`, once, at startup.
pub fn report(outcome: &LoadOutcome) {
    match (&outcome.error, outcome.loaded, &outcome.path) {
        (Some(error), _, _) => {
            tracing::error!("config: {error}; falling back to built-in defaults for ALL settings");
        }
        (None, true, Some(path)) => {
            tracing::info!("config: loaded {}", path.display());
        }
        (None, false, Some(path)) => {
            tracing::debug!(
                "config: no file at {} — using built-in defaults (none created)",
                path.display()
            );
        }
        (None, false, None) => {
            tracing::debug!(
                "config: no config directory on this platform — using built-in defaults"
            );
        }
        // `loaded` is only ever set together with a path, so this arm is
        // unreachable by construction; it exists to keep the match total.
        (None, true, None) => debug_assert!(false, "loaded outcome without a path"),
    }

    for warning in &outcome.warnings {
        tracing::warn!("config: {warning}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use schema::{QualityMode, Theme};

    fn path() -> &'static Path {
        Path::new("/home/p/.config/lectrice/config.toml")
    }

    #[test]
    fn a_missing_file_yields_defaults_and_creates_nothing() {
        let dir =
            std::env::temp_dir().join(format!("lectrice-config-absent-{}", std::process::id()));
        let target = dir.join("config.toml");
        let _ = std::fs::remove_dir_all(&dir);

        let outcome = load_from(&target);

        assert_eq!(outcome.config, Config::default());
        assert!(!outcome.loaded);
        assert!(outcome.error.is_none());
        assert!(
            !target.exists(),
            "loading must never create the config file (SC-004)"
        );
        assert!(!dir.exists(), "loading must never create the config dir");
    }

    #[test]
    fn a_partial_file_applies_named_keys_and_defaults_the_rest() {
        let outcome = parse(
            path(),
            r#"
            [appearance]
            theme = "dark"

            [tts]
            rate = 1.5
            "#,
        );

        assert!(outcome.loaded);
        assert!(outcome.error.is_none());
        assert_eq!(outcome.config.appearance.theme, Theme::Dark);
        assert_eq!(outcome.config.tts.rate, 1.5);
        assert_eq!(
            outcome.config.render.quality_mode,
            QualityMode::Balanced,
            "unnamed keys keep their defaults"
        );
    }

    #[test]
    fn an_unknown_key_warns_and_still_loads() {
        let outcome = parse(
            path(),
            r#"
            [tts]
            ratee = 1.5
            "#,
        );

        assert!(outcome.loaded, "a typo must not stop the app");
        assert!(outcome.error.is_none());
        assert_eq!(
            outcome.config.tts.rate, 1.0,
            "the typo'd key is not applied"
        );

        let warnings: Vec<String> = outcome.warnings.iter().map(ToString::to_string).collect();
        assert!(
            warnings.iter().any(|w| w.contains("tts.ratee")),
            "the warning must name the unknown key: {warnings:?}"
        );
    }

    #[test]
    fn a_type_error_names_the_key_and_the_line_and_falls_back_to_defaults() {
        let source = "# a comment\n[tts]\nrate = \"fast\"\n";
        let outcome = parse(path(), source);

        assert!(!outcome.loaded);
        assert_eq!(
            outcome.config,
            Config::default(),
            "a rejected file must not half-apply"
        );

        let error = outcome.error.expect("a type error must be reported");
        let rendered = error.to_string();
        assert_eq!(
            error.position.map(|p| p.line),
            Some(3),
            "must point at the offending line: {rendered}"
        );
        assert!(rendered.contains("rate"), "must name the key: {rendered}");
    }

    #[test]
    fn a_syntax_error_is_reported_with_a_position() {
        let outcome = parse(path(), "[tts\nrate = 1.0\n");

        assert!(!outcome.loaded);
        let error = outcome.error.expect("a syntax error must be reported");
        assert!(error.position.is_some(), "{error}");
        assert_eq!(outcome.config, Config::default());
    }

    #[test]
    fn an_out_of_range_value_is_clamped_with_a_warning_not_an_error() {
        let outcome = parse(path(), "[tts]\nrate = 99.0\n");

        assert!(outcome.loaded);
        assert!(outcome.error.is_none());
        assert_eq!(outcome.config.tts.rate, schema::TTS_RATE_MAX);
        assert!(outcome
            .warnings
            .iter()
            .any(|w| w.to_string().contains("tts.rate")));
    }

    #[test]
    fn an_older_schema_version_is_migrated_and_still_applies_its_values() {
        let outcome = parse(
            path(),
            "schema_version = 0\n[appearance]\ntheme = \"dark\"\n",
        );

        assert!(outcome.loaded, "a migrated file must still load");
        assert_eq!(outcome.config.appearance.theme, Theme::Dark);
        assert_eq!(
            outcome.config.schema_version,
            schema::CURRENT_SCHEMA_VERSION
        );
        assert!(outcome
            .warnings
            .iter()
            .any(|w| w.to_string().contains("migrated config")));
    }

    #[test]
    fn an_empty_file_loads_as_defaults() {
        let outcome = parse(path(), "");
        assert!(outcome.loaded);
        assert_eq!(outcome.config, Config::default());
        assert!(outcome.warnings.is_empty());
    }

    #[test]
    fn the_generated_template_loads_cleanly_through_the_real_pipeline() {
        // End-to-end for SC-005: not just "it parses" but "it produces no
        // warnings and no error through the same path startup uses".
        let outcome = parse(path(), &template::render());

        assert!(outcome.loaded);
        assert!(outcome.error.is_none());
        assert!(
            outcome.warnings.is_empty(),
            "the shipped template must be warning-free: {:?}",
            outcome
                .warnings
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        );
        assert_eq!(outcome.config, Config::default());
    }

    #[test]
    fn local_tts_config_round_trips_the_exact_loopback_destination() {
        let source = r#"
            [ai_tts]
            provider = "local"
            local_url = "http://127.0.0.1:5301"
            voice_id = "F1-pt"
        "#;

        let outcome = parse(path(), source);

        assert!(
            outcome.loaded,
            "valid local config must load: {:?}",
            outcome.error
        );
        assert_eq!(outcome.config.ai_tts.provider, schema::AiTtsProvider::Local);
        assert_eq!(
            outcome.config.ai_tts.local_url.as_deref(),
            Some("http://127.0.0.1:5301")
        );
        let encoded = toml::to_string(&outcome.config).expect("serialize effective config");
        let reparsed = parse(path(), &encoded);
        assert!(reparsed.loaded);
        assert_eq!(reparsed.config, outcome.config);
    }

    #[test]
    fn local_tts_config_rejects_every_noncanonical_destination_wholesale() {
        for rejected in [
            "http://127.0.0.1:5302",
            "http://localhost:5301",
            "http://10.0.0.5:5301",
            "http://169.254.169.254:5301",
            "http://[::1]:5301",
            "https://127.0.0.1:5301",
            "http://user:pass@127.0.0.1:5301",
            "http://127.0.0.1:5301/v1",
            "http://127.0.0.1:5301?mode=tts",
            "http://127.0.0.1:5301#fragment",
        ] {
            let source = format!("[ai_tts]\nprovider = \"local\"\nlocal_url = \"{rejected}\"\n");
            let outcome = parse(path(), &source);
            assert!(!outcome.loaded, "must reject {rejected}");
            assert_eq!(
                outcome.config,
                Config::default(),
                "must not half-apply {rejected}"
            );
            assert!(
                outcome
                    .error
                    .as_ref()
                    .is_some_and(|error| error.to_string().contains("http://127.0.0.1:5301")),
                "error must state the only accepted destination for {rejected}: {:?}",
                outcome.error
            );
        }
    }

    #[test]
    fn a_real_file_round_trips_from_disk() {
        let dir = std::env::temp_dir().join(format!(
            "lectrice-config-load-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let target = dir.join("config.toml");
        std::fs::write(&target, "[appearance]\ntheme = \"light\"\n").expect("write fixture");

        let outcome = load_from(&target);

        assert!(outcome.loaded);
        assert_eq!(outcome.config.appearance.theme, Theme::Light);
        assert_eq!(outcome.path.as_deref(), Some(target.as_path()));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
