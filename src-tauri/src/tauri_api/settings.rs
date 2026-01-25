//! Settings Tauri Command Handlers
//!
//! Thin command handlers that delegate to SettingsService.
//! These handlers only handle:
//! - Input parsing/validation
//! - Error mapping for frontend consumption
//! - Delegating to application services
//!
//! Note: During the migration, we obtain the database pool at runtime
//! from DbInstances. This allows the hexagonal architecture to coexist
//! with the existing Tauri plugin setup.

use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::adapters::SqliteSettingsRepo;
use crate::application::SettingsService;
use crate::domain::DomainError;

/// Response for get_all settings
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsMap {
    pub settings: HashMap<String, serde_json::Value>,
}

/// Response for individual setting
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingResponse {
    pub key: String,
    pub value: serde_json::Value,
}

/// Map DomainError to frontend-friendly error string
fn map_error(e: DomainError) -> String {
    match e {
        DomainError::NotFound(msg) => format!("NOT_FOUND: {}", msg),
        DomainError::Validation(msg) => format!("VALIDATION_ERROR: {}", msg),
        DomainError::Storage(msg) => format!("DATABASE_ERROR: {}", msg),
        DomainError::Tts(msg) => format!("TTS_ERROR: {}", msg),
        DomainError::FileSystem(msg) => format!("FILESYSTEM_ERROR: {}", msg),
    }
}

/// Helper to get the SQLite pool from DbInstances
async fn get_pool(db: &State<'_, DbInstances>) -> Result<Pool<Sqlite>, String> {
    let instances = db.0.read().await;
    let db_pool = instances
        .get("sqlite:pdf-reader.db")
        .ok_or_else(|| "DATABASE_ERROR: Database not initialized".to_string())?;

    match db_pool {
        DbPool::Sqlite(pool) => Ok(pool.clone()),
        #[allow(unreachable_patterns)]
        _ => Err("DATABASE_ERROR: Expected SQLite database".to_string()),
    }
}

/// Create a SettingsService instance with the current pool
async fn create_service(
    db: &State<'_, DbInstances>,
) -> Result<SettingsService<SqliteSettingsRepo>, String> {
    let pool = get_pool(db).await?;
    let repo = SqliteSettingsRepo::new(pool);
    Ok(SettingsService::new(repo))
}

/// Get a single setting by key
#[tauri::command]
pub async fn settings_get_v2(
    db: State<'_, DbInstances>,
    key: String,
) -> Result<SettingResponse, String> {
    let service = create_service(&db).await?;
    let value = service.get(&key).await.map_err(map_error)?;

    match value {
        Some(value_str) => {
            let value: serde_json::Value =
                serde_json::from_str(&value_str).unwrap_or(serde_json::Value::String(value_str));
            Ok(SettingResponse { key, value })
        }
        None => Err(format!("NOT_FOUND: Setting not found: {}", key)),
    }
}

/// Set a setting by key
#[tauri::command]
pub async fn settings_set_v2(
    db: State<'_, DbInstances>,
    key: String,
    value: serde_json::Value,
) -> Result<SettingResponse, String> {
    let value_str = serde_json::to_string(&value)
        .map_err(|e| format!("SERIALIZATION_ERROR: Failed to serialize value: {}", e))?;

    let service = create_service(&db).await?;
    service.set(&key, &value_str).await.map_err(map_error)?;

    tracing::debug!("Setting {} = {}", key, value_str);
    Ok(SettingResponse { key, value })
}

/// Get all settings
#[tauri::command]
pub async fn settings_get_all_v2(db: State<'_, DbInstances>) -> Result<SettingsMap, String> {
    let service = create_service(&db).await?;
    let pairs = service.get_all().await.map_err(map_error)?;

    let mut settings = HashMap::new();
    for (key, value_str) in pairs {
        let value: serde_json::Value =
            serde_json::from_str(&value_str).unwrap_or(serde_json::Value::String(value_str));
        settings.insert(key, value);
    }

    Ok(SettingsMap { settings })
}

/// Delete a setting by key
#[tauri::command]
pub async fn settings_delete_v2(db: State<'_, DbInstances>, key: String) -> Result<bool, String> {
    let service = create_service(&db).await?;
    service.delete(&key).await.map_err(map_error)?;
    Ok(true)
}

/// Batch update multiple settings at once
#[tauri::command]
pub async fn settings_set_batch_v2(
    db: State<'_, DbInstances>,
    settings: HashMap<String, serde_json::Value>,
) -> Result<SettingsMap, String> {
    // Convert to Vec<(String, String)> for the service
    let settings_vec: Result<Vec<(String, String)>, String> = settings
        .iter()
        .map(|(key, value)| {
            let value_str = serde_json::to_string(value)
                .map_err(|e| format!("SERIALIZATION_ERROR: Failed to serialize value: {}", e))?;
            Ok((key.clone(), value_str))
        })
        .collect();

    let settings_vec = settings_vec?;

    let service = create_service(&db).await?;
    service.set_batch(settings_vec).await.map_err(map_error)?;

    Ok(SettingsMap { settings })
}
