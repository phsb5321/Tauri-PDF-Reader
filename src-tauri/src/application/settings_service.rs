//! Settings Application Service
//!
//! Provides use cases for managing user settings.
//! Uses generic trait bounds to allow dependency injection of the repository.

use crate::domain::{DomainError, SettingKey, SettingsValidator};
use crate::ports::SettingsRepository;

/// Application service for managing user settings.
///
/// This service:
/// - Validates settings values before storage
/// - Provides typed access to known settings
/// - Delegates persistence to the injected repository
pub struct SettingsService<R: SettingsRepository> {
    repository: R,
}

impl<R: SettingsRepository> SettingsService<R> {
    /// Create a new SettingsService with the given repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// Get a setting value by key.
    /// Returns None if the setting doesn't exist.
    pub async fn get(&self, key: &str) -> Result<Option<String>, DomainError> {
        self.repository.get(key.to_string()).await
    }

    /// Get a typed setting value by key.
    /// Returns None if the setting doesn't exist.
    /// Returns an error if the value cannot be deserialized.
    pub async fn get_typed<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
    ) -> Result<Option<T>, DomainError> {
        match self.repository.get(key.to_string()).await? {
            Some(json) => {
                let value: T = serde_json::from_str(&json).map_err(|e| {
                    DomainError::storage(format!("Failed to deserialize setting: {}", e))
                })?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    /// Set a setting value.
    /// Validates the value before storing if the key is known.
    pub async fn set(&self, key: &str, value: &str) -> Result<(), DomainError> {
        // Validate known settings
        let setting_key = SettingKey::from_str(key);
        SettingsValidator::validate(&setting_key, value)?;

        self.repository
            .set(key.to_string(), value.to_string())
            .await
    }

    /// Set a typed setting value.
    /// Serializes the value to JSON before storing.
    pub async fn set_typed<T: serde::Serialize>(
        &self,
        key: &str,
        value: &T,
    ) -> Result<(), DomainError> {
        let json = serde_json::to_string(value)
            .map_err(|e| DomainError::validation(format!("Failed to serialize setting: {}", e)))?;
        self.set(key, &json).await
    }

    /// Get all settings as key-value pairs.
    pub async fn get_all(&self) -> Result<Vec<(String, String)>, DomainError> {
        self.repository.get_all().await
    }

    /// Delete a setting.
    pub async fn delete(&self, key: &str) -> Result<(), DomainError> {
        self.repository.delete(key.to_string()).await
    }

    /// Set multiple settings at once.
    /// Validates all values before storing any.
    pub async fn set_batch(&self, settings: Vec<(String, String)>) -> Result<(), DomainError> {
        // Validate all settings first
        for (key, value) in &settings {
            let setting_key = SettingKey::from_str(key);
            SettingsValidator::validate(&setting_key, value)?;
        }

        self.repository.set_batch(settings).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::MockSettingsRepository;
    use mockall::predicate::*;

    #[tokio::test]
    async fn test_get_returns_value() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_get()
            .with(eq("theme".to_string()))
            .times(1)
            .returning(|_| Ok(Some("\"dark\"".to_string())));

        let service = SettingsService::new(mock);
        let result = service.get("theme").await.unwrap();
        assert_eq!(result, Some("\"dark\"".to_string()));
    }

    #[tokio::test]
    async fn test_get_returns_none_for_missing() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_get()
            .with(eq("missing.key".to_string()))
            .times(1)
            .returning(|_| Ok(None));

        let service = SettingsService::new(mock);
        let result = service.get("missing.key").await.unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_get_typed_deserializes() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_get()
            .with(eq("tts.rate".to_string()))
            .times(1)
            .returning(|_| Ok(Some("1.5".to_string())));

        let service = SettingsService::new(mock);
        let result: Option<f64> = service.get_typed("tts.rate").await.unwrap();
        assert_eq!(result, Some(1.5));
    }

    #[tokio::test]
    async fn test_set_validates_tts_rate() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_set()
            .with(eq("tts.rate".to_string()), eq("1.5".to_string()))
            .times(1)
            .returning(|_, _| Ok(()));

        let service = SettingsService::new(mock);
        let result = service.set("tts.rate", "1.5").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_rejects_invalid_tts_rate() {
        let mock = MockSettingsRepository::new();
        // No expectations set - set should fail before calling repository

        let service = SettingsService::new(mock);
        let result = service.set("tts.rate", "5.0").await; // Invalid: > 3.0
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_validates_theme() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_set()
            .with(eq("theme".to_string()), eq("\"dark\"".to_string()))
            .times(1)
            .returning(|_, _| Ok(()));

        let service = SettingsService::new(mock);
        let result = service.set("theme", "\"dark\"").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_rejects_invalid_theme() {
        let mock = MockSettingsRepository::new();

        let service = SettingsService::new(mock);
        let result = service.set("theme", "\"invalid\"").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_typed_serializes() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_set()
            .with(eq("tts.rate".to_string()), eq("1.5".to_string()))
            .times(1)
            .returning(|_, _| Ok(()));

        let service = SettingsService::new(mock);
        let result = service.set_typed("tts.rate", &1.5f64).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_delete()
            .with(eq("theme".to_string()))
            .times(1)
            .returning(|_| Ok(()));

        let service = SettingsService::new(mock);
        let result = service.delete("theme").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_all() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_get_all().times(1).returning(|| {
            Ok(vec![
                ("theme".to_string(), "\"dark\"".to_string()),
                ("tts.rate".to_string(), "1.5".to_string()),
            ])
        });

        let service = SettingsService::new(mock);
        let result = service.get_all().await.unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_set_batch_validates_all() {
        let mock = MockSettingsRepository::new();

        let service = SettingsService::new(mock);
        let settings = vec![
            ("theme".to_string(), "\"dark\"".to_string()),
            ("tts.rate".to_string(), "5.0".to_string()), // Invalid
        ];
        let result = service.set_batch(settings).await;
        assert!(result.is_err()); // Should fail on validation
    }

    #[tokio::test]
    async fn test_set_batch_success() {
        let mut mock = MockSettingsRepository::new();
        mock.expect_set_batch().times(1).returning(|_| Ok(()));

        let service = SettingsService::new(mock);
        let settings = vec![
            ("theme".to_string(), "\"dark\"".to_string()),
            ("tts.rate".to_string(), "1.5".to_string()),
        ];
        let result = service.set_batch(settings).await;
        assert!(result.is_ok());
    }
}
