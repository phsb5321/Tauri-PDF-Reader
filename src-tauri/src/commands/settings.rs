use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, Row};
use std::collections::HashMap;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Response for get_all settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsMap {
    pub settings: HashMap<String, serde_json::Value>,
}

/// Response for individual setting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingResponse {
    pub key: String,
    pub value: serde_json::Value,
}

/// Get a single setting by key
#[tauri::command]
pub async fn settings_get(
    db: State<'_, DbInstances>,
    key: String,
) -> Result<SettingResponse, String> {
    let pool = get_pool(&db).await?;

    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM settings WHERE key = ?"
    )
    .bind(&key)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: Failed to get setting: {}", e))?;

    match row {
        Some((key, value_str)) => {
            let value: serde_json::Value = serde_json::from_str(&value_str)
                .unwrap_or(serde_json::Value::String(value_str));
            Ok(SettingResponse { key, value })
        }
        None => Err(format!("NOT_FOUND: Setting not found: {}", key)),
    }
}

/// Set a setting by key
#[tauri::command]
pub async fn settings_set(
    db: State<'_, DbInstances>,
    key: String,
    value: serde_json::Value,
) -> Result<SettingResponse, String> {
    let pool = get_pool(&db).await?;

    let value_str = serde_json::to_string(&value)
        .map_err(|e| format!("SERIALIZATION_ERROR: Failed to serialize value: {}", e))?;

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(&key)
    .bind(&value_str)
    .execute(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: Failed to set setting: {}", e))?;

    tracing::debug!("Setting {} = {}", key, value_str);

    Ok(SettingResponse { key, value })
}

/// Get all settings
#[tauri::command]
pub async fn settings_get_all(
    db: State<'_, DbInstances>,
) -> Result<SettingsMap, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM settings"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: Failed to get settings: {}", e))?;

    let mut settings = HashMap::new();
    for (key, value_str) in rows {
        let value: serde_json::Value = serde_json::from_str(&value_str)
            .unwrap_or(serde_json::Value::String(value_str));
        settings.insert(key, value);
    }

    Ok(SettingsMap { settings })
}

/// Delete a setting by key
#[tauri::command]
pub async fn settings_delete(
    db: State<'_, DbInstances>,
    key: String,
) -> Result<bool, String> {
    let pool = get_pool(&db).await?;

    let result = sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(&key)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: Failed to delete setting: {}", e))?;

    Ok(result.rows_affected() > 0)
}

/// Batch update multiple settings at once
#[tauri::command]
pub async fn settings_set_batch(
    db: State<'_, DbInstances>,
    settings: HashMap<String, serde_json::Value>,
) -> Result<SettingsMap, String> {
    let pool = get_pool(&db).await?;

    for (key, value) in &settings {
        let value_str = serde_json::to_string(value)
            .map_err(|e| format!("SERIALIZATION_ERROR: Failed to serialize value: {}", e))?;

        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        )
        .bind(key)
        .bind(&value_str)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: Failed to set setting {}: {}", key, e))?;

        tracing::debug!("Setting {} = {}", key, value_str);
    }

    Ok(SettingsMap { settings })
}

// Helper to get the SQLite pool - clones the pool to avoid lifetime issues
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
