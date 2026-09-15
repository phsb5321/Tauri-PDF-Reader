//! The typed config schema for the settings that exist in Lectrice today.
//!
//! Every key here was read off a real persistence site before being written
//! down (`src/stores/settings-store.ts`, `src/db/migrations.rs`,
//! `commands/settings.rs`, `src/stores/ai-tts-store.ts`). Nothing is invented.
//!
//! Two rules hold for every field:
//!   * `#[serde(default = ...)]`, so a file naming three keys is legal and the
//!     other fourteen keep their defaults;
//!   * the default function is the ONE definition of that default — the
//!     `--generate-config` template and the tests both read it, so a template
//!     that drifts from the real default is a test failure, not a surprise.
//!
//! Renames get `#[serde(alias = "old")]` so an older file keeps working.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Current schema version. A file without `schema_version` is treated as this
/// version (see `migrate`), so a hand-written file needs no version line.
pub const CURRENT_SCHEMA_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Defaults — mirrored from the live persistence sites.
// ---------------------------------------------------------------------------

fn default_schema_version() -> u32 {
    CURRENT_SCHEMA_VERSION
}

// settings-store.ts: theme = 'system'
fn default_theme() -> Theme {
    Theme::System
}

// migrations.rs: 'highlight.defaultColor' = "#FFEB3B"
fn default_highlight_color() -> String {
    "#FFEB3B".to_string()
}

// migrations.rs: 'highlight.colors'
fn default_highlight_colors() -> Vec<String> {
    vec![
        "#FFEB3B".to_string(),
        "#4CAF50".to_string(),
        "#2196F3".to_string(),
        "#F44336".to_string(),
    ]
}

// constants.ts DEFAULT_TTS_RATE = 1.0; the store clamps to 0.5..=3.0
fn default_tts_rate() -> f64 {
    1.0
}
pub const TTS_RATE_MIN: f64 = 0.5;
pub const TTS_RATE_MAX: f64 = 3.0;

// settings-store.ts: ttsFollowAlong = true
fn default_true() -> bool {
    true
}

// RenderSettings::default() in commands/settings.rs — the Rust defaults are
// authoritative (see spec: the TS constants disagree and cannot round-trip).
fn default_quality_mode() -> QualityMode {
    QualityMode::Balanced
}
fn default_max_megapixels() -> u32 {
    24
}
pub const MAX_MEGAPIXELS_MIN: u32 = 8;
pub const MAX_MEGAPIXELS_MAX: u32 = 48;

// migrations.rs cache_settings: 5368709120 bytes = 5 GiB, policy 'lru'
fn default_cache_max_bytes() -> u64 {
    5_368_709_120
}
fn default_eviction_policy() -> EvictionPolicy {
    EvictionPolicy::Lru
}

// ai-tts-store.ts: DEFAULT_VOICE_ID (Rachel), DEFAULT_SPEED 1.0, autoPage true
fn default_ai_voice_id() -> String {
    "21m00Tcm4TlvDq8ikWAM".to_string()
}
fn default_ai_speed() -> f64 {
    1.0
}
pub const AI_SPEED_MIN: f64 = 0.5;
pub const AI_SPEED_MAX: f64 = 4.5;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum QualityMode {
    Performance,
    Balanced,
    Ultra,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum EvictionPolicy {
    Lru,
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Appearance {
    /// SQLite `theme`
    #[serde(default = "default_theme")]
    pub theme: Theme,
}

/// Named `HighlightConfig`, not `Highlight`: specta flattens every exported
/// type into ONE TypeScript namespace, and `db::models::Highlight` (the
/// highlight entity) already owns that name. Two `export type Highlight`
/// declarations do not compile. The TOML section is still `[highlight]` —
/// that comes from the FIELD name, not the struct name.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct HighlightConfig {
    /// SQLite `highlight.defaultColor`
    #[serde(default = "default_highlight_color", alias = "defaultColor")]
    pub default_color: String,
    /// SQLite `highlight.colors`
    #[serde(default = "default_highlight_colors")]
    pub colors: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Tts {
    /// SQLite `tts.rate` — clamped to 0.5..=3.0, as the settings store does.
    #[serde(default = "default_tts_rate")]
    pub rate: f64,
    /// SQLite `tts.voice` — `null` means "let the platform choose".
    #[serde(default)]
    pub voice: Option<String>,
    /// SQLite `tts.followAlong`
    #[serde(default = "default_true", alias = "followAlong")]
    pub follow_along: bool,
}

/// Both fields default to `false`, which is exactly `#[derive(Default)]` — the
/// only section whose defaults are the type's own, so it is the only one that
/// does not need a hand-written impl.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
pub struct Telemetry {
    /// SQLite `telemetry.analytics`
    #[serde(default)]
    pub analytics: bool,
    /// SQLite `telemetry.errors`
    #[serde(default)]
    pub errors: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Render {
    /// SQLite `render.qualityMode`
    #[serde(default = "default_quality_mode", alias = "qualityMode")]
    pub quality_mode: QualityMode,
    /// SQLite `render.maxMegapixels` — clamped to 8..=48, the range the write
    /// path already enforces.
    #[serde(default = "default_max_megapixels", alias = "maxMegapixels")]
    pub max_megapixels: u32,
    /// SQLite `render.hwAccelerationEnabled`
    #[serde(default = "default_true", alias = "hwAccelerationEnabled")]
    pub hw_acceleration: bool,
    /// SQLite `render.debugOverlayEnabled`
    #[serde(default, alias = "debugOverlayEnabled")]
    pub debug_overlay: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Cache {
    /// SQLite `cache_settings.max_size_bytes`
    #[serde(default = "default_cache_max_bytes")]
    pub max_size_bytes: u64,
    /// SQLite `cache_settings.eviction_policy`
    #[serde(default = "default_eviction_policy")]
    pub eviction_policy: EvictionPolicy,
}

pub const LOCAL_TTS_URL: &str = "http://127.0.0.1:5301";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum AiTtsProvider {
    #[default]
    ElevenLabs,
    Local,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AiTts {
    /// Provider selection is native config only; the WebView receives read-only
    /// effective state and has no command that can mutate the destination.
    #[serde(default)]
    pub provider: AiTtsProvider,
    /// Initial local-provider boundary is deliberately one exact loopback URL.
    /// Broader addresses require a separate security decision.
    #[serde(default)]
    pub local_url: Option<String>,
    /// localStorage `ai-tts-storage.selectedVoiceId`.
    ///
    /// NOT an `Option`, unlike `tts.voice`, and the round-trip property is why:
    /// TOML has no null, so an absent key and a `None` are the same three bytes
    /// of nothing. A field whose DEFAULT is `Some(rachel)` therefore cannot
    /// express `None` in a file — writing `None` and reading it back yields
    /// Rachel. `proptest` found exactly that asymmetry, and a type that cannot
    /// represent the unrepresentable is the fix; the slice-2 writer would
    /// otherwise silently "revert" a cleared voice.
    ///
    /// (`tts.voice` keeps its `Option` legitimately: its default IS `None`, so
    /// absent and `None` agree and the round-trip holds.)
    #[serde(default = "default_ai_voice_id", alias = "selectedVoiceId")]
    pub voice_id: String,
    /// localStorage `ai-tts-storage.speed` — clamped to 0.5..=4.5.
    #[serde(default = "default_ai_speed")]
    pub speed: f64,
    /// localStorage `ai-tts-storage.autoPageEnabled`
    #[serde(default = "default_true", alias = "autoPageEnabled")]
    pub auto_page: bool,
}

/// The whole config file.
///
/// The ElevenLabs API key is deliberately absent: it is a secret, it is entered
/// at runtime today, and a config file is version-controlled (and world-readable
/// in a Nix store). Secrets do not belong here.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Config {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub appearance: Appearance,
    #[serde(default)]
    pub highlight: HighlightConfig,
    #[serde(default)]
    pub tts: Tts,
    #[serde(default)]
    pub telemetry: Telemetry,
    #[serde(default)]
    pub render: Render,
    #[serde(default)]
    pub cache: Cache,
    #[serde(default)]
    pub ai_tts: AiTts,
}

// `#[serde(default)]` on a struct field needs `Default` for that struct; each
// impl delegates to the same per-field default functions, so there is still
// exactly one definition of every default.
impl Default for Appearance {
    fn default() -> Self {
        Self {
            theme: default_theme(),
        }
    }
}
impl Default for HighlightConfig {
    fn default() -> Self {
        Self {
            default_color: default_highlight_color(),
            colors: default_highlight_colors(),
        }
    }
}
impl Default for Tts {
    fn default() -> Self {
        Self {
            rate: default_tts_rate(),
            voice: None,
            follow_along: default_true(),
        }
    }
}
impl Default for Render {
    fn default() -> Self {
        Self {
            quality_mode: default_quality_mode(),
            max_megapixels: default_max_megapixels(),
            hw_acceleration: default_true(),
            debug_overlay: false,
        }
    }
}
impl Default for Cache {
    fn default() -> Self {
        Self {
            max_size_bytes: default_cache_max_bytes(),
            eviction_policy: default_eviction_policy(),
        }
    }
}
impl Default for AiTts {
    fn default() -> Self {
        Self {
            provider: AiTtsProvider::default(),
            local_url: None,
            voice_id: default_ai_voice_id(),
            speed: default_ai_speed(),
            auto_page: default_true(),
        }
    }
}
impl Default for Config {
    fn default() -> Self {
        Self {
            schema_version: default_schema_version(),
            appearance: Appearance::default(),
            highlight: HighlightConfig::default(),
            tts: Tts::default(),
            telemetry: Telemetry::default(),
            render: Render::default(),
            cache: Cache::default(),
            ai_tts: AiTts::default(),
        }
    }
}

impl Config {
    /// Clamp the numeric ranges the app already enforces elsewhere, reporting
    /// what was clamped.
    ///
    /// Out-of-range is a WARNING, not a hard error, for the same reason unknown
    /// keys are: `rate = 5.0` is an understandable thing to write, and refusing
    /// to start over it would be hostile. The clamp bounds are the ones the
    /// settings store and the render write path already apply, so a clamped
    /// config behaves exactly like the same value typed into the UI.
    pub fn clamp(&mut self) -> Vec<String> {
        let mut notes = Vec::new();

        let rate = self.tts.rate.clamp(TTS_RATE_MIN, TTS_RATE_MAX);
        if rate != self.tts.rate {
            notes.push(format!(
                "tts.rate {} is outside {TTS_RATE_MIN}..={TTS_RATE_MAX}; clamped to {rate}",
                self.tts.rate
            ));
            self.tts.rate = rate;
        }

        let speed = self.ai_tts.speed.clamp(AI_SPEED_MIN, AI_SPEED_MAX);
        if speed != self.ai_tts.speed {
            notes.push(format!(
                "ai_tts.speed {} is outside {AI_SPEED_MIN}..={AI_SPEED_MAX}; clamped to {speed}",
                self.ai_tts.speed
            ));
            self.ai_tts.speed = speed;
        }

        let mp = self
            .render
            .max_megapixels
            .clamp(MAX_MEGAPIXELS_MIN, MAX_MEGAPIXELS_MAX);
        if mp != self.render.max_megapixels {
            notes.push(format!(
                "render.max_megapixels {} is outside {MAX_MEGAPIXELS_MIN}..={MAX_MEGAPIXELS_MAX}; clamped to {mp}",
                self.render.max_megapixels
            ));
            self.render.max_megapixels = mp;
        }

        notes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_document_yields_exactly_the_defaults() {
        // The "file names three keys" promise rests on this: every field must
        // be optional all the way down.
        let parsed: Config = toml::from_str("").expect("empty config must parse");
        assert_eq!(parsed, Config::default());
    }

    #[test]
    fn partial_document_keeps_untouched_defaults() {
        let parsed: Config = toml::from_str(
            r#"
            [appearance]
            theme = "dark"
            "#,
        )
        .expect("partial config must parse");

        assert_eq!(parsed.appearance.theme, Theme::Dark);
        assert_eq!(parsed.tts.rate, default_tts_rate());
        assert_eq!(parsed.highlight.colors, default_highlight_colors());
    }

    #[test]
    fn camel_case_aliases_accept_the_legacy_sqlite_spelling() {
        let parsed: Config = toml::from_str(
            r#"
            [tts]
            followAlong = false

            [render]
            maxMegapixels = 32
            "#,
        )
        .expect("aliased keys must parse");

        assert!(!parsed.tts.follow_along);
        assert_eq!(parsed.render.max_megapixels, 32);
    }

    #[test]
    fn clamp_reports_and_bounds_each_out_of_range_value() {
        let mut config = Config {
            tts: Tts {
                rate: 9.0,
                ..Tts::default()
            },
            ai_tts: AiTts {
                speed: 0.1,
                ..AiTts::default()
            },
            render: Render {
                max_megapixels: 500,
                ..Render::default()
            },
            ..Config::default()
        };

        let notes = config.clamp();

        assert_eq!(config.tts.rate, TTS_RATE_MAX);
        assert_eq!(config.ai_tts.speed, AI_SPEED_MIN);
        assert_eq!(config.render.max_megapixels, MAX_MEGAPIXELS_MAX);
        assert_eq!(notes.len(), 3, "each clamp must be reported: {notes:?}");
        assert!(notes.iter().any(|n| n.contains("tts.rate")));
        assert!(notes.iter().any(|n| n.contains("ai_tts.speed")));
        assert!(notes.iter().any(|n| n.contains("render.max_megapixels")));
    }

    #[test]
    fn in_range_values_are_not_clamped_and_report_nothing() {
        let mut config = Config::default();
        assert!(config.clamp().is_empty());
        assert_eq!(config, Config::default());
    }
}
