use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
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
/// Note: Legacy command using serde_json::Value - use settings_get_v2 for type-safe version
#[tauri::command]
pub async fn settings_get(
    db: State<'_, DbInstances>,
    key: String,
) -> Result<SettingResponse, String> {
    let pool = get_pool(&db).await?;

    let row: Option<(String, String)> =
        sqlx::query_as("SELECT key, value FROM settings WHERE key = ?")
            .bind(&key)
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("DATABASE_ERROR: Failed to get setting: {}", e))?;

    match row {
        Some((key, value_str)) => {
            let value: serde_json::Value =
                serde_json::from_str(&value_str).unwrap_or(serde_json::Value::String(value_str));
            Ok(SettingResponse { key, value })
        }
        None => Err(format!("NOT_FOUND: Setting not found: {}", key)),
    }
}

/// Set a setting by key
/// Note: Legacy command using serde_json::Value - use settings_set_v2 for type-safe version
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
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
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
/// Note: Legacy command using serde_json::Value - use settings_get_all_v2 for type-safe version
#[tauri::command]
pub async fn settings_get_all(db: State<'_, DbInstances>) -> Result<SettingsMap, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: Failed to get settings: {}", e))?;

    let mut settings = HashMap::new();
    for (key, value_str) in rows {
        let value: serde_json::Value =
            serde_json::from_str(&value_str).unwrap_or(serde_json::Value::String(value_str));
        settings.insert(key, value);
    }

    Ok(SettingsMap { settings })
}

/// Delete a setting by key
/// Note: Legacy command - use settings_delete_v2 for type-safe version
#[tauri::command]
pub async fn settings_delete(db: State<'_, DbInstances>, key: String) -> Result<bool, String> {
    let pool = get_pool(&db).await?;

    let result = sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(&key)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: Failed to delete setting: {}", e))?;

    Ok(result.rows_affected() > 0)
}

/// Batch update multiple settings at once
/// Note: Legacy command using serde_json::Value - use settings_set_batch_v2 for type-safe version
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

// =============================================================================
// Render Settings Commands (Type-Safe)
// =============================================================================

/// Render settings structure matching frontend types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSettings {
    pub quality_mode: String,
    pub max_megapixels: u32,
    pub hw_acceleration_enabled: bool,
    pub debug_overlay_enabled: bool,
}

impl Default for RenderSettings {
    fn default() -> Self {
        Self {
            quality_mode: "balanced".to_string(),
            max_megapixels: 24,
            hw_acceleration_enabled: cfg!(not(target_os = "linux")), // Default false on Linux
            debug_overlay_enabled: false,
        }
    }
}

/// Response for update render settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRenderSettingsResponse {
    pub success: bool,
    pub restart_required: bool,
    pub settings: RenderSettings,
}

const RENDER_SETTINGS_KEYS: [&str; 4] = [
    "render.qualityMode",
    "render.maxMegapixels",
    "render.hwAccelerationEnabled",
    "render.debugOverlayEnabled",
];

/// Get render settings
#[tauri::command]
pub async fn get_render_settings(db: State<'_, DbInstances>) -> Result<RenderSettings, String> {
    let pool = get_pool(&db).await?;

    let mut settings = RenderSettings::default();

    for key in RENDER_SETTINGS_KEYS.iter() {
        let row: Option<(String, String)> =
            sqlx::query_as("SELECT key, value FROM settings WHERE key = ?")
                .bind(key)
                .fetch_optional(&pool)
                .await
                .map_err(|e| format!("DATABASE_ERROR: Failed to get render setting: {}", e))?;

        if let Some((_, value_str)) = row {
            match *key {
                "render.qualityMode" => {
                    if let Ok(v) = serde_json::from_str::<String>(&value_str) {
                        settings.quality_mode = v;
                    }
                }
                "render.maxMegapixels" => {
                    if let Ok(v) = serde_json::from_str::<u32>(&value_str) {
                        settings.max_megapixels = v;
                    }
                }
                "render.hwAccelerationEnabled" => {
                    if let Ok(v) = serde_json::from_str::<bool>(&value_str) {
                        settings.hw_acceleration_enabled = v;
                    }
                }
                "render.debugOverlayEnabled" => {
                    if let Ok(v) = serde_json::from_str::<bool>(&value_str) {
                        settings.debug_overlay_enabled = v;
                    }
                }
                _ => {}
            }
        }
    }

    Ok(settings)
}

/// Update render settings (partial update supported)
#[tauri::command]
pub async fn update_render_settings(
    db: State<'_, DbInstances>,
    quality_mode: Option<String>,
    max_megapixels: Option<u32>,
    hw_acceleration_enabled: Option<bool>,
    debug_overlay_enabled: Option<bool>,
) -> Result<UpdateRenderSettingsResponse, String> {
    let pool = get_pool(&db).await?;

    // Get current settings first
    let mut current = get_render_settings(db.clone()).await?;
    let old_hw_accel = current.hw_acceleration_enabled;

    // Apply updates
    if let Some(v) = quality_mode {
        if !["performance", "balanced", "ultra"].contains(&v.as_str()) {
            return Err("VALIDATION_ERROR: Invalid quality mode".to_string());
        }
        current.quality_mode = v;
    }
    if let Some(v) = max_megapixels {
        if v < 8 || v > 48 {
            return Err("VALIDATION_ERROR: maxMegapixels must be between 8 and 48".to_string());
        }
        current.max_megapixels = v;
    }
    if let Some(v) = hw_acceleration_enabled {
        current.hw_acceleration_enabled = v;
        // Also update file-based flag for next startup (before WebView creation)
        crate::hw_accel::set_hw_accel_enabled(v);
    }
    if let Some(v) = debug_overlay_enabled {
        current.debug_overlay_enabled = v;
    }

    // Save to database
    let settings_to_save = [
        ("render.qualityMode", serde_json::json!(current.quality_mode)),
        ("render.maxMegapixels", serde_json::json!(current.max_megapixels)),
        ("render.hwAccelerationEnabled", serde_json::json!(current.hw_acceleration_enabled)),
        ("render.debugOverlayEnabled", serde_json::json!(current.debug_overlay_enabled)),
    ];

    for (key, value) in settings_to_save.iter() {
        let value_str = serde_json::to_string(value)
            .map_err(|e| format!("SERIALIZATION_ERROR: {}", e))?;

        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(&value_str)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: Failed to save render setting {}: {}", key, e))?;
    }

    tracing::info!("Render settings updated: {:?}", current);

    let restart_required = hw_acceleration_enabled.is_some() && current.hw_acceleration_enabled != old_hw_accel;

    Ok(UpdateRenderSettingsResponse {
        success: true,
        restart_required,
        settings: current,
    })
}

// =============================================================================
// Hardware Acceleration Status Commands
// =============================================================================

/// Response for hardware acceleration status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HwAccelStatus {
    pub hw_accel_enabled: bool,
    pub safe_mode_active: bool,
    pub platform_default_disabled: bool,
}

/// Get hardware acceleration status (reads file-based flags, not DB)
#[tauri::command]
pub fn get_hw_accel_status() -> HwAccelStatus {
    let should_disable = crate::hw_accel::should_disable_hw_accel();
    let safe_mode = crate::hw_accel::is_safe_mode_active();

    // Check platform default (Linux disables by default)
    let platform_default_disabled = cfg!(target_os = "linux");

    HwAccelStatus {
        hw_accel_enabled: !should_disable,
        safe_mode_active: safe_mode,
        platform_default_disabled,
    }
}

/// Clear safe mode (after user acknowledges and wants to try HW accel again)
#[tauri::command]
pub fn clear_safe_mode() -> Result<(), String> {
    crate::hw_accel::clear_safe_mode();
    tracing::info!("Safe mode cleared by user");
    Ok(())
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
