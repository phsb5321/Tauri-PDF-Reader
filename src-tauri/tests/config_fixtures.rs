//! Fixture-driven contract for the user config file (spec 078, slice 1).
//!
//! The unit tests inside `src/config/` cover each function; these run whole
//! FILES through the same `config::parse` the app calls at startup, because the
//! promises in the spec are about files a user writes, not about functions.
//!
//! The broken-file directory is the load-bearing part: every file in
//! `fixtures/config/broken/` must produce an error that names the KEY and the
//! LINE. A test that only asserted "it fails" would pass on the useless message
//! this feature exists to avoid.

use std::path::{Path, PathBuf};

use tauri_pdf_reader_lib::config::{
    self,
    schema::{Config, EvictionPolicy, QualityMode, Theme, CURRENT_SCHEMA_VERSION},
};

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("config")
}

fn load_fixture(relative: &str) -> config::LoadOutcome {
    let path = fixture_dir().join(relative);
    let source = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("fixture {} must be readable: {e}", path.display()));
    config::parse(&path, &source)
}

fn warnings_of(outcome: &config::LoadOutcome) -> Vec<String> {
    outcome.warnings.iter().map(ToString::to_string).collect()
}

// ---------------------------------------------------------------------------
// Golden files
// ---------------------------------------------------------------------------

#[test]
fn full_fixture_applies_every_key() {
    let outcome = load_fixture("full.toml");

    assert!(outcome.loaded, "error: {:?}", outcome.error);
    assert!(outcome.error.is_none());
    assert!(
        warnings_of(&outcome).is_empty(),
        "a fully-specified valid file must warn about nothing: {:?}",
        warnings_of(&outcome)
    );

    let c = outcome.config;
    assert_eq!(c.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(c.appearance.theme, Theme::Dark);
    assert_eq!(c.highlight.default_color, "#4CAF50");
    assert_eq!(c.highlight.colors, vec!["#4CAF50", "#2196F3"]);
    assert_eq!(c.tts.rate, 1.25);
    assert_eq!(
        c.tts.voice.as_deref(),
        Some("com.apple.speech.synthesis.voice.samantha")
    );
    assert!(!c.tts.follow_along);
    assert!(c.telemetry.analytics);
    assert!(c.telemetry.errors);
    assert_eq!(c.render.quality_mode, QualityMode::Ultra);
    assert_eq!(c.render.max_megapixels, 32);
    assert!(!c.render.hw_acceleration);
    assert!(c.render.debug_overlay);
    assert_eq!(c.cache.max_size_bytes, 1_073_741_824);
    assert_eq!(c.cache.eviction_policy, EvictionPolicy::Lru);
    assert_eq!(c.ai_tts.voice_id, "EXAVITQu4vr4xnSDxMaL");
    assert_eq!(c.ai_tts.speed, 1.75);
    assert!(!c.ai_tts.auto_page);
}

#[test]
fn partial_fixture_applies_named_keys_and_defaults_everything_else() {
    let outcome = load_fixture("partial.toml");
    let defaults = Config::default();

    assert!(outcome.loaded);
    let c = outcome.config;
    assert_eq!(c.appearance.theme, Theme::Light);
    assert_eq!(c.tts.rate, 1.5);

    // Untouched keys keep their defaults — the promise that makes a two-line
    // config file legal.
    assert_eq!(c.highlight.colors, defaults.highlight.colors);
    assert_eq!(c.render.quality_mode, defaults.render.quality_mode);
    assert_eq!(c.cache.max_size_bytes, defaults.cache.max_size_bytes);
    assert_eq!(c.ai_tts.voice_id, defaults.ai_tts.voice_id);
    assert_eq!(c.telemetry, defaults.telemetry);
}

#[test]
fn legacy_camel_case_spellings_are_accepted_via_aliases() {
    let outcome = load_fixture("legacy-aliases.toml");

    assert!(outcome.loaded, "error: {:?}", outcome.error);
    assert!(
        warnings_of(&outcome).is_empty(),
        "aliased keys are known keys, not unknown ones: {:?}",
        warnings_of(&outcome)
    );

    let c = outcome.config;
    assert!(!c.tts.follow_along);
    assert_eq!(c.render.quality_mode, QualityMode::Performance);
    assert_eq!(c.render.max_megapixels, 16);
    assert!(!c.render.hw_acceleration);
    assert!(c.render.debug_overlay);
    assert_eq!(c.ai_tts.voice_id, "EXAVITQu4vr4xnSDxMaL");
    assert!(!c.ai_tts.auto_page);
}

// ---------------------------------------------------------------------------
// Unknown keys warn, never fail
// ---------------------------------------------------------------------------

#[test]
fn unknown_keys_warn_by_name_and_the_file_still_loads() {
    let outcome = load_fixture("unknown-keys.toml");

    assert!(outcome.loaded, "a typo must never brick the config");
    assert!(outcome.error.is_none());

    let warnings = warnings_of(&outcome);
    for expected in ["tts.ratee", "appearance.colour_scheme", "future_section"] {
        assert!(
            warnings.iter().any(|w| w.contains(expected)),
            "expected a warning naming `{expected}`, got {warnings:?}"
        );
    }

    // The keys that WERE understood still applied.
    assert_eq!(outcome.config.tts.rate, 1.5);
    assert_eq!(outcome.config.appearance.theme, Theme::Dark);
}

// ---------------------------------------------------------------------------
// The broken-file directory: every error names the key AND the line
// ---------------------------------------------------------------------------

/// `(fixture, expected key fragment, expected 1-based line)`
const BROKEN_CASES: &[(&str, &str, usize)] = &[
    ("broken/type-error.toml", "tts.rate", 3),
    ("broken/bad-enum.toml", "appearance.theme", 2),
    ("broken/bad-array-element.toml", "highlight.colors", 4),
    ("broken/wrong-integer-type.toml", "cache.max_size_bytes", 2),
];

#[test]
fn every_broken_fixture_names_its_key_and_line() {
    for (fixture, expected_key, expected_line) in BROKEN_CASES {
        let outcome = load_fixture(fixture);

        assert!(!outcome.loaded, "{fixture} must not load");
        assert_eq!(
            outcome.config,
            Config::default(),
            "{fixture}: a rejected file must fall back to defaults WHOLESALE, never half-apply"
        );

        let error = outcome
            .error
            .unwrap_or_else(|| panic!("{fixture} must report an error"));
        let rendered = error.to_string();

        assert_eq!(
            error.position.map(|p| p.line),
            Some(*expected_line),
            "{fixture}: wrong line in `{rendered}`"
        );
        assert_eq!(
            error.key.as_deref(),
            Some(*expected_key),
            "{fixture}: wrong key in `{rendered}`"
        );
        assert!(
            rendered.contains(expected_key) && rendered.contains(&expected_line.to_string()),
            "{fixture}: the rendered message must carry both key and line: {rendered}"
        );
    }
}

#[test]
fn a_malformed_file_reports_a_position_and_falls_back_to_defaults() {
    // Syntax errors have no key — there is no parsed key to name — but they
    // must still say WHERE.
    let outcome = load_fixture("broken/malformed-syntax.toml");

    assert!(!outcome.loaded);
    assert_eq!(outcome.config, Config::default());
    let error = outcome.error.expect("malformed toml must error");
    assert!(
        error.position.is_some(),
        "a syntax error must carry a position: {error}"
    );
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

#[test]
fn an_explicitly_versioned_old_file_migrates_and_keeps_its_values() {
    let outcome = load_fixture("migrations/v0-explicit.toml");

    assert!(outcome.loaded, "error: {:?}", outcome.error);
    assert_eq!(outcome.config.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(outcome.config.appearance.theme, Theme::Dark);
    assert!(
        warnings_of(&outcome)
            .iter()
            .any(|w| w.contains("migrated config")),
        "a migration must be reported: {:?}",
        warnings_of(&outcome)
    );
}

#[test]
fn a_versionless_file_loads_without_a_migration_note() {
    let outcome = load_fixture("migrations/versionless.toml");

    assert!(outcome.loaded);
    assert_eq!(outcome.config.tts.rate, 2.0);
    assert!(
        !warnings_of(&outcome)
            .iter()
            .any(|w| w.contains("migrated config")),
        "a hand-written file needs no version line and must not look migrated"
    );
}

#[test]
fn a_future_version_still_loads_the_keys_this_build_understands() {
    let outcome = load_fixture("migrations/future-version.toml");

    assert!(
        outcome.loaded,
        "a file from a newer Lectrice must not brick this one: {:?}",
        outcome.error
    );
    assert_eq!(outcome.config.appearance.theme, Theme::Light);
    assert_eq!(outcome.config.schema_version, 99);
}

// ---------------------------------------------------------------------------
// Absent file / template
// ---------------------------------------------------------------------------

#[test]
fn an_absent_file_yields_defaults_and_creates_nothing() {
    // SC-004: the app must never author the user's config file.
    let dir = std::env::temp_dir().join(format!(
        "lectrice-config-fixture-absent-{}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    let target = dir.join("config.toml");

    let outcome = config::load_from(&target);

    assert!(!outcome.loaded);
    assert!(outcome.error.is_none());
    assert_eq!(outcome.config, Config::default());
    assert!(!target.exists(), "no file may be created");
    assert!(!dir.exists(), "no directory may be created");
}

#[test]
fn the_generated_template_round_trips_to_the_defaults() {
    // SC-005, through the real pipeline rather than a bare `toml::from_str`.
    let rendered = config::template::render();
    let outcome = config::parse(Path::new("generated-template.toml"), &rendered);

    assert!(outcome.loaded, "error: {:?}", outcome.error);
    assert!(
        warnings_of(&outcome).is_empty(),
        "the shipped template must be warning-free: {:?}",
        warnings_of(&outcome)
    );
    assert_eq!(outcome.config, Config::default());
}
