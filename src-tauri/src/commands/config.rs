//! Read-only access to the effective user config (spec 078, slice 1).
//!
//! ONE command. The config was already resolved at startup — before the WebView
//! existed, because `render.hw_acceleration` has to be known that early — and
//! parked in Tauri state. This command hands the frontend that same value, so
//! the stores can seed themselves from the file at boot.
//!
//! There is deliberately no setter here. Slice 1 is read-only; the writer is
//! slice 2, and it writes the FILE through `toml_edit` (comment-preserving),
//! not a second copy in SQLite. Adding a setter now would create exactly the
//! two-writers problem the spec exists to avoid.

use tauri::State;

use crate::config::schema::Config;

/// The config Lectrice is actually running with, plus how it got there.
///
/// `warnings` and `error` are carried to the frontend so the UI can surface a
/// bad config to the user instead of leaving the finding in a log file nobody
/// reads. Slice 1 does not render them yet — the data is here so slice 2's UI
/// does not need a new command.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveConfig {
    /// The effective settings (defaults when no file was loaded).
    pub config: Config,
    /// Path consulted, if the platform had one.
    pub path: Option<String>,
    /// True when a file was found AND successfully applied.
    pub loaded: bool,
    /// Non-fatal findings: unknown keys, clamped values, migration notes.
    pub warnings: Vec<String>,
    /// Set when a file existed but could not be used; `config` is the defaults.
    pub error: Option<String>,
}

/// State handle for the config resolved at startup.
pub struct ConfigState(pub EffectiveConfig);

/// Get the effective user configuration.
#[tauri::command]
#[specta::specta]
pub fn config_get_effective(state: State<'_, ConfigState>) -> EffectiveConfig {
    state.0.clone()
}

impl From<crate::config::LoadOutcome> for EffectiveConfig {
    fn from(outcome: crate::config::LoadOutcome) -> Self {
        Self {
            config: outcome.config,
            path: outcome.path.map(|p| p.display().to_string()),
            loaded: outcome.loaded,
            warnings: outcome.warnings.iter().map(ToString::to_string).collect(),
            error: outcome.error.map(|e| e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config;
    use std::path::Path;

    #[test]
    fn a_clean_load_carries_the_config_and_no_findings() {
        let outcome = config::parse(
            Path::new("/tmp/config.toml"),
            "[appearance]\ntheme = \"dark\"\n",
        );
        let effective: EffectiveConfig = outcome.into();

        assert!(effective.loaded);
        assert!(effective.error.is_none());
        assert!(effective.warnings.is_empty());
        assert_eq!(
            effective.config.appearance.theme,
            crate::config::schema::Theme::Dark
        );
    }

    #[test]
    fn a_broken_load_carries_defaults_plus_the_error_string() {
        let outcome = config::parse(Path::new("/tmp/config.toml"), "[tts]\nrate = \"fast\"\n");
        let effective: EffectiveConfig = outcome.into();

        assert!(!effective.loaded);
        assert_eq!(effective.config, Config::default());
        let error = effective.error.expect("error must reach the frontend");
        assert!(error.contains("rate"), "{error}");
    }

    #[test]
    fn unknown_keys_reach_the_frontend_as_warnings() {
        let outcome = config::parse(Path::new("/tmp/config.toml"), "[tts]\nratee = 1.5\n");
        let effective: EffectiveConfig = outcome.into();

        assert!(effective.loaded);
        assert!(
            effective.warnings.iter().any(|w| w.contains("tts.ratee")),
            "{:?}",
            effective.warnings
        );
    }
}
