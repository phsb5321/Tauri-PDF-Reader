//! SQLite Settings Repository Adapter
//!
//! Implements the SettingsRepository port using SQLite database.
//! This adapter extracts the persistence logic from the Tauri commands.

use async_trait::async_trait;
use sqlx::{Pool, Sqlite};

use crate::domain::DomainError;
use crate::ports::SettingsRepository;

/// SQLite implementation of SettingsRepository.
///
/// Stores settings as key-value pairs where values are JSON strings.
pub struct SqliteSettingsRepo {
    pool: Pool<Sqlite>,
}

impl SqliteSettingsRepo {
    /// Create a new SqliteSettingsRepo with the given database pool.
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SettingsRepository for SqliteSettingsRepo {
    async fn get(&self, key: String) -> Result<Option<String>, DomainError> {
        let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
            .bind(&key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::storage(format!("Failed to get setting '{}': {}", key, e)))?;

        Ok(row.map(|(value,)| value))
    }

    async fn set(&self, key: String, value: String) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        )
        .bind(&key)
        .bind(&value)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::storage(format!("Failed to set setting '{}': {}", key, e)))?;

        tracing::debug!("Setting {} = {}", key, value);
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<(String, String)>, DomainError> {
        let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::storage(format!("Failed to get all settings: {}", e)))?;

        Ok(rows)
    }

    async fn delete(&self, key: String) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM settings WHERE key = ?")
            .bind(&key)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                DomainError::storage(format!("Failed to delete setting '{}': {}", key, e))
            })?;

        Ok(())
    }

    async fn set_batch(&self, settings: Vec<(String, String)>) -> Result<(), DomainError> {
        // Use a transaction to ensure atomicity
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::storage(format!("Failed to begin transaction: {}", e)))?;

        for (key, value) in settings {
            sqlx::query(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
            )
            .bind(&key)
            .bind(&value)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::storage(format!("Failed to set setting '{}': {}", key, e)))?;

            tracing::debug!("Setting {} = {}", key, value);
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::storage(format!("Failed to commit transaction: {}", e)))?;

        Ok(())
    }
}
