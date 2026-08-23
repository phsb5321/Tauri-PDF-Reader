//! Property: serializing a `Config` and parsing it back is the identity.
//!
//! This is what makes the future comment-preserving writer (slice 2) safe to
//! build: if `Config -> toml -> Config` ever loses or mangles a field, the UI
//! writer would silently corrupt a user's file. Cheaper to catch here, on
//! arbitrary values, than in a bug report about a setting that reverts itself.

use proptest::prelude::*;

use tauri_pdf_reader_lib::config::schema::{
    AiTts, Appearance, Cache, Config, EvictionPolicy, HighlightConfig, QualityMode, Render,
    Telemetry, Theme, Tts, AI_SPEED_MAX, AI_SPEED_MIN, MAX_MEGAPIXELS_MAX, MAX_MEGAPIXELS_MIN,
    TTS_RATE_MAX, TTS_RATE_MIN,
};

fn theme() -> impl Strategy<Value = Theme> {
    prop_oneof![Just(Theme::Light), Just(Theme::Dark), Just(Theme::System)]
}

fn quality_mode() -> impl Strategy<Value = QualityMode> {
    prop_oneof![
        Just(QualityMode::Performance),
        Just(QualityMode::Balanced),
        Just(QualityMode::Ultra),
    ]
}

/// A hex colour — the shape every colour field actually holds.
fn colour() -> impl Strategy<Value = String> {
    "#[0-9A-F]{6}".prop_map(|s| s.to_string())
}

/// An opaque voice id. Kept to the printable-ASCII shape the real ids use;
/// TOML escaping of arbitrary text is the `toml` crate's contract, not this
/// schema's.
fn voice_id() -> impl Strategy<Value = String> {
    "[A-Za-z0-9_.-]{1,32}".prop_map(|s| s.to_string())
}

prop_compose! {
    fn arbitrary_config()(
        theme in theme(),
        default_color in colour(),
        colors in prop::collection::vec(colour(), 0..6),
        rate in TTS_RATE_MIN..=TTS_RATE_MAX,
        voice in prop::option::of(voice_id()),
        follow_along in any::<bool>(),
        analytics in any::<bool>(),
        errors in any::<bool>(),
        quality_mode in quality_mode(),
        max_megapixels in MAX_MEGAPIXELS_MIN..=MAX_MEGAPIXELS_MAX,
        hw_acceleration in any::<bool>(),
        debug_overlay in any::<bool>(),
        max_size_bytes in 0u64..1_000_000_000_000,
        ai_voice_id in voice_id(),
        speed in AI_SPEED_MIN..=AI_SPEED_MAX,
        auto_page in any::<bool>(),
    ) -> Config {
        Config {
            schema_version: tauri_pdf_reader_lib::config::schema::CURRENT_SCHEMA_VERSION,
            appearance: Appearance { theme },
            highlight: HighlightConfig { default_color, colors },
            tts: Tts { rate, voice, follow_along },
            telemetry: Telemetry { analytics, errors },
            render: Render { quality_mode, max_megapixels, hw_acceleration, debug_overlay },
            cache: Cache { max_size_bytes, eviction_policy: EvictionPolicy::Lru },
            ai_tts: AiTts {
                voice_id: ai_voice_id,
                speed,
                auto_page,
                ..AiTts::default()
            },
        }
    }
}

proptest! {
    #[test]
    fn config_survives_a_serialize_parse_round_trip(config in arbitrary_config()) {
        let rendered = toml::to_string(&config).expect("a Config must always serialize");
        let parsed: Config = toml::from_str(&rendered)
            .unwrap_or_else(|e| panic!("round-trip must parse: {e}\n---\n{rendered}"));
        prop_assert_eq!(parsed, config);
    }

    /// In-range values must pass through `clamp` untouched. The clamp exists to
    /// bound hostile input, not to quietly rewrite legal configs.
    #[test]
    fn clamping_an_in_range_config_changes_nothing(config in arbitrary_config()) {
        let mut clamped = config.clone();
        let notes = clamped.clamp();
        prop_assert!(notes.is_empty(), "unexpected clamp: {:?}", notes);
        prop_assert_eq!(clamped, config);
    }
}
