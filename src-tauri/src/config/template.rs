//! The `--generate-config` template.
//!
//! Every value in the template is interpolated from `Config::default()`, so the
//! template cannot drift from the real defaults: if a default changes and the
//! template did not, the round-trip test fails.
//!
//! Lectrice never writes this file itself. The user redirects it:
//!
//! ```sh
//! lectrice --generate-config > ~/.config/lectrice/config.toml
//! ```

use super::schema::{
    Config, AI_SPEED_MAX, AI_SPEED_MIN, CURRENT_SCHEMA_VERSION, MAX_MEGAPIXELS_MAX,
    MAX_MEGAPIXELS_MIN, TTS_RATE_MAX, TTS_RATE_MIN,
};

/// Format an f64 so TOML reads it back as a float.
///
/// `1.0_f64.to_string()` is `"1"`, which TOML parses as an *integer* and serde
/// then rejects for an f64 field. The template would be unparseable by the very
/// app that printed it.
fn float(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{value:.1}")
    } else {
        value.to_string()
    }
}

/// Render a TOML string array on one line.
fn string_array(values: &[String]) -> String {
    let items: Vec<String> = values.iter().map(|v| format!("\"{v}\"")).collect();
    format!("[{}]", items.join(", "))
}

/// Render the commented template for the built-in defaults.
pub fn render() -> String {
    let d = Config::default();

    let theme = toml_enum(&d.appearance.theme);
    let quality = toml_enum(&d.render.quality_mode);
    let eviction = toml_enum(&d.cache.eviction_policy);
    let cache_gib = d.cache.max_size_bytes as f64 / 1024.0 / 1024.0 / 1024.0;
    let ai_voice = d.ai_tts.voice_id.clone();

    format!(
        r##"# Lectrice configuration.
#
# Location: $XDG_CONFIG_HOME/lectrice/config.toml
#           (override the whole path with the LECTRICE_CONFIG env var)
#
# This file is OPTIONAL. With no file present Lectrice uses the defaults shown
# below and creates nothing on disk. Every key is optional too: name only what
# you want to change.
#
# An unknown key is a warning, never a failure — a typo will not stop Lectrice
# from starting, it will tell you which key it did not recognise.
#
# Secrets do NOT belong here. The ElevenLabs API key is entered at runtime and
# is deliberately not a config key: this file is meant to be version-controlled.

# Schema version of this file. Omit it and Lectrice assumes the current schema.
schema_version = {CURRENT_SCHEMA_VERSION}

[appearance]
# "light" | "dark" | "system"
theme = "{theme}"

[highlight]
# Colour applied when you highlight without picking a colour.
default_color = "{default_color}"
# The palette offered in the highlight toolbar.
colors = {colors}

[tts]
# Speech rate for the built-in system voice, {TTS_RATE_MIN}..{TTS_RATE_MAX}
# (values outside the range are clamped, with a warning).
rate = {rate}
# System voice id. Omit the key to let the platform choose.
# voice = "com.apple.speech.synthesis.voice.samantha"
# Scroll the page to follow the spoken word.
follow_along = {follow_along}

[telemetry]
# Both default to false. Lectrice is local-first; nothing is sent unless you
# turn it on here.
analytics = {analytics}
errors = {errors}

[render]
# "performance" | "balanced" | "ultra"
quality_mode = "{quality}"
# Canvas size cap in megapixels, {MAX_MEGAPIXELS_MIN}..{MAX_MEGAPIXELS_MAX}.
max_megapixels = {max_megapixels}
# GPU acceleration. Changing this takes effect on the next start.
hw_acceleration = {hw_acceleration}
# Render diagnostics overlay.
debug_overlay = {debug_overlay}

[cache]
# Maximum size of the generated-audio cache, in bytes ({cache_gib:.0} GiB by default).
max_size_bytes = {max_size_bytes}
# Eviction policy when the cache is full. Currently only "lru".
eviction_policy = "{eviction}"

[ai_tts]
# ElevenLabs voice id used for high-quality narration.
voice_id = "{ai_voice}"
# Playback speed, {AI_SPEED_MIN}..{AI_SPEED_MAX} (pitch-preserving).
speed = {ai_speed}
# Continue narrating onto the next page automatically.
auto_page = {auto_page}
"##,
        default_color = d.highlight.default_color,
        colors = string_array(&d.highlight.colors),
        rate = float(d.tts.rate),
        follow_along = d.tts.follow_along,
        analytics = d.telemetry.analytics,
        errors = d.telemetry.errors,
        max_megapixels = d.render.max_megapixels,
        hw_acceleration = d.render.hw_acceleration,
        debug_overlay = d.render.debug_overlay,
        max_size_bytes = d.cache.max_size_bytes,
        ai_speed = float(d.ai_tts.speed),
        auto_page = d.ai_tts.auto_page,
    )
}

/// Serialize a unit enum to its TOML spelling by round-tripping through serde,
/// so the template can never disagree with what the parser accepts.
fn toml_enum<T: serde::Serialize + std::fmt::Debug>(value: &T) -> String {
    let rendered = toml::Value::try_from(value)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string));
    match rendered {
        Some(s) => s,
        // Unreachable for the unit enums used here; falling back to the Debug
        // spelling keeps this infallible rather than panicking in a CLI path.
        None => format!("{value:?}").to_lowercase(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_template_parses_back_to_exactly_the_defaults() {
        // SC-005. This is the test that keeps the template honest: interpolating
        // the defaults is only useful if the result still round-trips.
        let rendered = render();
        let parsed: Config = toml::from_str(&rendered)
            .unwrap_or_else(|e| panic!("template must parse: {e}\n---\n{rendered}"));
        assert_eq!(parsed, Config::default());
    }

    #[test]
    fn the_template_has_no_unknown_keys() {
        // A commented template that documents a key the schema dropped would be
        // a lie the round-trip test alone cannot catch.
        let rendered = render();
        let deserializer = toml::Deserializer::new(&rendered);
        let mut unknown: Vec<String> = Vec::new();
        let _: Config = serde_ignored::deserialize(deserializer, |path| {
            unknown.push(path.to_string());
        })
        .expect("template must parse");
        assert!(
            unknown.is_empty(),
            "template names unknown keys: {unknown:?}"
        );
    }

    #[test]
    fn every_section_of_the_schema_is_documented() {
        let rendered = render();
        for section in [
            "[appearance]",
            "[highlight]",
            "[tts]",
            "[telemetry]",
            "[render]",
            "[cache]",
            "[ai_tts]",
        ] {
            assert!(
                rendered.contains(section),
                "template is missing {section}\n{rendered}"
            );
        }
    }

    #[test]
    fn floats_are_rendered_so_toml_reads_them_as_floats() {
        assert_eq!(float(1.0), "1.0");
        assert_eq!(float(1.5), "1.5");
        // The guard that matters: a bare "1" would deserialize as an integer
        // and be rejected for an f64 field.
        assert!(render().contains("rate = 1.0"));
    }
}
