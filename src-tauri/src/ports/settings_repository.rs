//! Settings Repository Port
//!
//! User settings persistence.
//! Implemented by: SqliteSettingsRepo, MockSettingsRepo

use async_trait::async_trait;

#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;

use crate::domain::DomainError;

/// SettingsRepository Port
///
/// User settings persistence.
/// Implemented by: SqliteSettingsRepo, MockSettingsRepo
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait SettingsRepository: Send + Sync {
    /// Get a setting value by key (returns JSON string)
    async fn get(&self, key: String) -> Result<Option<String>, DomainError>;

    /// Set a setting value (stores as JSON string)
    async fn set(&self, key: String, value: String) -> Result<(), DomainError>;

    /// Get all settings as key-value pairs
    async fn get_all(&self) -> Result<Vec<(String, String)>, DomainError>;

    /// Delete a setting
    async fn delete(&self, key: String) -> Result<(), DomainError>;

    /// Set multiple settings at once
    async fn set_batch(&self, settings: Vec<(String, String)>) -> Result<(), DomainError>;
}
