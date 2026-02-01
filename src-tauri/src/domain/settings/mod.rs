//! Settings Domain Module
//!
//! Contains the Settings domain entity and validation logic.
//! This module defines:
//! - Valid settings keys and their value types
//! - Validation rules for settings values
//! - Default values for settings

use serde::{Deserialize, Serialize};

use crate::domain::DomainError;

/// Known settings keys with type safety
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SettingKey {
    // TTS Settings
    TtsVoice,
    TtsRate,
    TtsFollowAlong,

    // Highlight Settings
    HighlightColors,
    HighlightDefaultColor,

    // Theme Settings
    Theme,

    // Telemetry Settings
    TelemetryAnalytics,
    TelemetryErrors,

    // Render Settings
    RenderQualityMode,
    RenderMaxMegapixels,
    RenderHwAccelerationEnabled,
    RenderDebugOverlayEnabled,

    // Custom key (for extensibility)
    Custom(String),
}

impl SettingKey {
    pub fn as_str(&self) -> &str {
        match self {
            SettingKey::TtsVoice => "tts.voice",
            SettingKey::TtsRate => "tts.rate",
            SettingKey::TtsFollowAlong => "tts.followAlong",
            SettingKey::HighlightColors => "highlight.colors",
            SettingKey::HighlightDefaultColor => "highlight.defaultColor",
            SettingKey::Theme => "theme",
            SettingKey::TelemetryAnalytics => "telemetry.analytics",
            SettingKey::TelemetryErrors => "telemetry.errors",
            SettingKey::RenderQualityMode => "render.qualityMode",
            SettingKey::RenderMaxMegapixels => "render.maxMegapixels",
            SettingKey::RenderHwAccelerationEnabled => "render.hwAccelerationEnabled",
            SettingKey::RenderDebugOverlayEnabled => "render.debugOverlayEnabled",
            SettingKey::Custom(key) => key.as_str(),
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "tts.voice" => SettingKey::TtsVoice,
            "tts.rate" => SettingKey::TtsRate,
            "tts.followAlong" => SettingKey::TtsFollowAlong,
            "highlight.colors" => SettingKey::HighlightColors,
            "highlight.defaultColor" => SettingKey::HighlightDefaultColor,
            "theme" => SettingKey::Theme,
            "telemetry.analytics" => SettingKey::TelemetryAnalytics,
            "telemetry.errors" => SettingKey::TelemetryErrors,
            "render.qualityMode" => SettingKey::RenderQualityMode,
            "render.maxMegapixels" => SettingKey::RenderMaxMegapixels,
            "render.hwAccelerationEnabled" => SettingKey::RenderHwAccelerationEnabled,
            "render.debugOverlayEnabled" => SettingKey::RenderDebugOverlayEnabled,
            other => SettingKey::Custom(other.to_string()),
        }
    }
}

/// Theme enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::System
    }
}

/// Settings validation functions
pub struct SettingsValidator;

impl SettingsValidator {
    /// Validate TTS rate is within allowed range
    pub fn validate_tts_rate(rate: f64) -> Result<f64, DomainError> {
        if !(0.5..=3.0).contains(&rate) {
            return Err(DomainError::validation(format!(
                "TTS rate must be between 0.5 and 3.0, got {}",
                rate
            )));
        }
        Ok(rate)
    }

    /// Validate hex color format
    pub fn validate_hex_color(color: &str) -> Result<&str, DomainError> {
        if !color.starts_with('#') || color.len() != 7 {
            return Err(DomainError::validation(format!(
                "Invalid color format: {}. Expected #RRGGBB",
                color
            )));
        }

        // Check that remaining characters are valid hex
        if !color[1..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(DomainError::validation(format!(
                "Invalid hex color: {}",
                color
            )));
        }

        Ok(color)
    }

    /// Validate theme value
    pub fn validate_theme(value: &str) -> Result<Theme, DomainError> {
        match value {
            "light" => Ok(Theme::Light),
            "dark" => Ok(Theme::Dark),
            "system" => Ok(Theme::System),
            other => Err(DomainError::validation(format!(
                "Invalid theme: {}. Expected light, dark, or system",
                other
            ))),
        }
    }

    /// Validate a setting value based on its key
    pub fn validate(key: &SettingKey, value: &str) -> Result<(), DomainError> {
        match key {
            SettingKey::TtsRate => {
                let rate: f64 = serde_json::from_str(value).map_err(|e| {
                    DomainError::validation(format!("Invalid TTS rate value: {}", e))
                })?;
                Self::validate_tts_rate(rate)?;
            }
            SettingKey::HighlightDefaultColor => {
                let color: String = serde_json::from_str(value)
                    .map_err(|e| DomainError::validation(format!("Invalid color value: {}", e)))?;
                Self::validate_hex_color(&color)?;
            }
            SettingKey::HighlightColors => {
                let colors: Vec<String> = serde_json::from_str(value)
                    .map_err(|e| DomainError::validation(format!("Invalid colors value: {}", e)))?;
                for color in &colors {
                    Self::validate_hex_color(color)?;
                }
            }
            SettingKey::Theme => {
                let theme: String = serde_json::from_str(value)
                    .map_err(|e| DomainError::validation(format!("Invalid theme value: {}", e)))?;
                Self::validate_theme(&theme)?;
            }
            // Boolean settings - just validate JSON
            SettingKey::TtsFollowAlong
            | SettingKey::TelemetryAnalytics
            | SettingKey::TelemetryErrors
            | SettingKey::RenderHwAccelerationEnabled
            | SettingKey::RenderDebugOverlayEnabled => {
                let _: bool = serde_json::from_str(value).map_err(|e| {
                    DomainError::validation(format!("Invalid boolean value: {}", e))
                })?;
            }
            // Render quality mode - validate enum
            SettingKey::RenderQualityMode => {
                let mode: String = serde_json::from_str(value).map_err(|e| {
                    DomainError::validation(format!("Invalid quality mode value: {}", e))
                })?;
                if !["performance", "balanced", "ultra"].contains(&mode.as_str()) {
                    return Err(DomainError::validation(format!(
                        "Invalid quality mode: {}. Expected performance, balanced, or ultra",
                        mode
                    )));
                }
            }
            // Render max megapixels - validate range
            SettingKey::RenderMaxMegapixels => {
                let mp: u32 = serde_json::from_str(value).map_err(|e| {
                    DomainError::validation(format!("Invalid megapixels value: {}", e))
                })?;
                if mp < 8 || mp > 48 {
                    return Err(DomainError::validation(format!(
                        "Megapixels must be between 8 and 48, got {}",
                        mp
                    )));
                }
            }
            // String settings - no specific validation
            SettingKey::TtsVoice | SettingKey::Custom(_) => {
                // Just validate it's valid JSON
                let _: serde_json::Value = serde_json::from_str(value)
                    .map_err(|e| DomainError::validation(format!("Invalid JSON value: {}", e)))?;
            }
        }
        Ok(())
    }
}

/// Quality mode for PDF rendering
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QualityMode {
    Performance,
    Balanced,
    Ultra,
}

impl Default for QualityMode {
    fn default() -> Self {
        QualityMode::Balanced
    }
}

impl QualityMode {
    pub fn as_str(&self) -> &str {
        match self {
            QualityMode::Performance => "performance",
            QualityMode::Balanced => "balanced",
            QualityMode::Ultra => "ultra",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "performance" => Some(QualityMode::Performance),
            "balanced" => Some(QualityMode::Balanced),
            "ultra" => Some(QualityMode::Ultra),
            _ => None,
        }
    }
}

/// Default settings values
pub struct SettingsDefaults;

impl SettingsDefaults {
    pub const TTS_RATE: f64 = 1.0;
    pub const TTS_FOLLOW_ALONG: bool = true;
    pub const HIGHLIGHT_DEFAULT_COLOR: &'static str = "#FFEB3B";
    pub const HIGHLIGHT_COLORS: [&'static str; 4] = ["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"];
    pub const TELEMETRY_ANALYTICS: bool = false;
    pub const TELEMETRY_ERRORS: bool = true;

    // Render settings defaults
    pub const RENDER_QUALITY_MODE: &'static str = "balanced";
    pub const RENDER_MAX_MEGAPIXELS: u32 = 24;
    pub const RENDER_DEBUG_OVERLAY_ENABLED: bool = false;

    /// HW acceleration default depends on platform (false on Linux due to WebKitGTK issues)
    #[cfg(target_os = "linux")]
    pub const RENDER_HW_ACCELERATION_ENABLED: bool = false;
    #[cfg(not(target_os = "linux"))]
    pub const RENDER_HW_ACCELERATION_ENABLED: bool = true;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_tts_rate_valid() {
        assert!(SettingsValidator::validate_tts_rate(1.0).is_ok());
        assert!(SettingsValidator::validate_tts_rate(0.5).is_ok());
        assert!(SettingsValidator::validate_tts_rate(3.0).is_ok());
        assert!(SettingsValidator::validate_tts_rate(1.5).is_ok());
    }

    #[test]
    fn test_validate_tts_rate_invalid() {
        assert!(SettingsValidator::validate_tts_rate(0.4).is_err());
        assert!(SettingsValidator::validate_tts_rate(3.1).is_err());
        assert!(SettingsValidator::validate_tts_rate(-1.0).is_err());
    }

    #[test]
    fn test_validate_hex_color_valid() {
        assert!(SettingsValidator::validate_hex_color("#FFEB3B").is_ok());
        assert!(SettingsValidator::validate_hex_color("#000000").is_ok());
        assert!(SettingsValidator::validate_hex_color("#ffffff").is_ok());
        assert!(SettingsValidator::validate_hex_color("#4CAF50").is_ok());
    }

    #[test]
    fn test_validate_hex_color_invalid() {
        assert!(SettingsValidator::validate_hex_color("FFEB3B").is_err()); // Missing #
        assert!(SettingsValidator::validate_hex_color("#FFF").is_err()); // Too short
        assert!(SettingsValidator::validate_hex_color("#GGGGGG").is_err()); // Invalid hex
        assert!(SettingsValidator::validate_hex_color("").is_err());
    }

    #[test]
    fn test_validate_theme() {
        assert_eq!(
            SettingsValidator::validate_theme("light").unwrap(),
            Theme::Light
        );
        assert_eq!(
            SettingsValidator::validate_theme("dark").unwrap(),
            Theme::Dark
        );
        assert_eq!(
            SettingsValidator::validate_theme("system").unwrap(),
            Theme::System
        );
        assert!(SettingsValidator::validate_theme("invalid").is_err());
    }

    #[test]
    fn test_setting_key_roundtrip() {
        let keys = vec![
            SettingKey::TtsVoice,
            SettingKey::TtsRate,
            SettingKey::Theme,
            SettingKey::Custom("custom.key".to_string()),
        ];

        for key in keys {
            let str_key = key.as_str();
            let parsed = SettingKey::from_str(str_key);
            assert_eq!(parsed.as_str(), str_key);
        }
    }
}
