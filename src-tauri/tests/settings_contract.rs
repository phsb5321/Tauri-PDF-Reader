//! Settings Contract Tests
//!
//! These tests verify that the Settings module contracts are stable
//! across the hexagonal architecture layers. They ensure:
//! 1. Domain validation rules are consistent
//! 2. Service layer behavior matches expectations
//! 3. Serialization/deserialization works correctly

use tauri_pdf_reader_lib::{
    application::SettingsService,
    domain::{DomainError, SettingKey, SettingsValidator},
    ports::MockSettingsRepository,
};

/// Contract: Known setting keys are validated
#[test]
fn contract_known_settings_are_validated() {
    // TTS rate must be between 0.5 and 3.0
    assert!(SettingsValidator::validate(&SettingKey::TtsRate, "1.0").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::TtsRate, "0.5").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::TtsRate, "3.0").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::TtsRate, "0.4").is_err());
    assert!(SettingsValidator::validate(&SettingKey::TtsRate, "3.1").is_err());

    // Theme must be valid JSON-quoted light, dark, or system
    assert!(SettingsValidator::validate(&SettingKey::Theme, "\"light\"").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::Theme, "\"dark\"").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::Theme, "\"system\"").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::Theme, "\"invalid\"").is_err());

    // Highlight color must be valid hex color
    assert!(SettingsValidator::validate(&SettingKey::HighlightDefaultColor, "\"#FFFF00\"").is_ok());
    assert!(SettingsValidator::validate(&SettingKey::HighlightDefaultColor, "\"#ff0000\"").is_ok());
    assert!(
        SettingsValidator::validate(&SettingKey::HighlightDefaultColor, "\"invalid\"").is_err()
    );
}

/// Contract: Custom/unknown settings validate as JSON but don't require specific format
#[test]
fn contract_custom_settings_validate_as_json() {
    // Custom settings must be valid JSON but any structure is allowed
    assert!(SettingsValidator::validate(
        &SettingKey::Custom("custom.setting".to_string()),
        "\"any value\""
    )
    .is_ok());
    assert!(SettingsValidator::validate(
        &SettingKey::Custom("other.key".to_string()),
        "{\"complex\": true}"
    )
    .is_ok());
    assert!(SettingsValidator::validate(
        &SettingKey::Custom("list.setting".to_string()),
        "[1, 2, 3]"
    )
    .is_ok());
    // Invalid JSON should fail
    assert!(SettingsValidator::validate(
        &SettingKey::Custom("bad.json".to_string()),
        "not valid json"
    )
    .is_err());
}

/// Contract: SettingKey parsing is case-sensitive and exact
#[test]
fn contract_setting_key_parsing() {
    assert!(matches!(
        SettingKey::from_str("tts.rate"),
        SettingKey::TtsRate
    ));
    assert!(matches!(SettingKey::from_str("theme"), SettingKey::Theme));
    assert!(matches!(
        SettingKey::from_str("highlight.defaultColor"),
        SettingKey::HighlightDefaultColor
    ));
    assert!(matches!(
        SettingKey::from_str("tts.voice"),
        SettingKey::TtsVoice
    ));
    assert!(matches!(
        SettingKey::from_str("unknown"),
        SettingKey::Custom(_)
    ));
    assert!(matches!(
        SettingKey::from_str("TTS.RATE"),
        SettingKey::Custom(_)
    )); // Case sensitive
}

/// Contract: DomainError variants serialize consistently for IPC
#[test]
fn contract_domain_error_serialization() {
    let validation_error = DomainError::validation("Test error");
    let json = serde_json::to_string(&validation_error).unwrap();
    assert!(json.contains("\"kind\":\"Validation\""));
    assert!(json.contains("Test error"));

    let not_found_error = DomainError::not_found("Missing item");
    let json = serde_json::to_string(&not_found_error).unwrap();
    assert!(json.contains("\"kind\":\"NotFound\""));

    let storage_error = DomainError::storage("DB error");
    let json = serde_json::to_string(&storage_error).unwrap();
    assert!(json.contains("\"kind\":\"Storage\""));
}

/// Contract: SettingsService rejects invalid values before calling repository
#[tokio::test]
async fn contract_service_validates_before_storage() {
    // Create a mock that should NOT be called
    let mock = MockSettingsRepository::new();
    // No expectations set - if called, test will fail

    let service = SettingsService::new(mock);

    // Attempting to set an invalid value should fail validation
    // without ever calling the repository
    let result = service.set("tts.rate", "10.0").await; // Invalid: > 3.0
    assert!(result.is_err());

    match result.unwrap_err() {
        DomainError::Validation(msg) => {
            assert!(msg.contains("TTS rate"));
        }
        _ => panic!("Expected Validation error"),
    }
}

/// Contract: Service correctly delegates to repository for valid values
#[tokio::test]
async fn contract_service_delegates_valid_values() {
    use mockall::predicate::*;

    let mut mock = MockSettingsRepository::new();
    mock.expect_set()
        .with(eq("tts.rate".to_string()), eq("1.5".to_string()))
        .times(1)
        .returning(|_, _| Ok(()));

    let service = SettingsService::new(mock);
    let result = service.set("tts.rate", "1.5").await;
    assert!(result.is_ok());
}

/// Contract: Batch operations validate all values atomically
#[tokio::test]
async fn contract_batch_validates_atomically() {
    let mock = MockSettingsRepository::new();
    // No expectations - repository should never be called

    let service = SettingsService::new(mock);

    // If any value in the batch is invalid, none should be stored
    let settings = vec![
        ("theme".to_string(), "\"dark\"".to_string()), // Valid
        ("tts.rate".to_string(), "5.0".to_string()),   // Invalid
        ("tts.voice".to_string(), "\"Alex\"".to_string()), // Valid
    ];

    let result = service.set_batch(settings).await;
    assert!(result.is_err());
}
