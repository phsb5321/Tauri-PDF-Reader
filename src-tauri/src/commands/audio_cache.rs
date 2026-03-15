//! Audio Cache Tauri Commands
//!
//! Exposes audio cache functionality to the frontend via Tauri IPC.
//! Includes coverage event emission for real-time UI updates (T046).

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::adapters::SqliteAudioCacheRepo;
use crate::application::AudioCacheService;
use crate::domain::cache::CoverageStats;
use crate::ports::audio_cache_repository::{CacheStats, EvictionResult};

/// Response for coverage query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageResponse {
    pub document_id: String,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub total_duration_ms: i64,
    pub cached_size_bytes: i64,
}

impl From<CoverageStats> for CoverageResponse {
    fn from(stats: CoverageStats) -> Self {
        Self {
            document_id: stats.document_id,
            total_chunks: stats.total_chunks,
            cached_chunks: stats.cached_chunks,
            coverage_percent: stats.coverage_percent,
            total_duration_ms: stats.total_duration_ms,
            cached_size_bytes: stats.cached_size_bytes,
        }
    }
}

/// Response for cache stats query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStatsResponse {
    pub total_size_bytes: i64,
    pub entry_count: i64,
    pub max_size_bytes: i64,
    pub oldest_entry_at: Option<String>,
    pub newest_entry_at: Option<String>,
    pub document_count: i64,
}

impl From<CacheStats> for CacheStatsResponse {
    fn from(stats: CacheStats) -> Self {
        Self {
            total_size_bytes: stats.total_size_bytes,
            entry_count: stats.entry_count,
            max_size_bytes: stats.max_size_bytes,
            oldest_entry_at: stats.oldest_entry_at,
            newest_entry_at: stats.newest_entry_at,
            document_count: stats.document_count,
        }
    }
}

/// Response for eviction operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvictionResponse {
    pub evicted_count: i64,
    pub bytes_freed: i64,
}

impl From<EvictionResult> for EvictionResponse {
    fn from(result: EvictionResult) -> Self {
        Self {
            evicted_count: result.evicted_count,
            bytes_freed: result.bytes_freed,
        }
    }
}

/// Response for clear document operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearDocumentResponse {
    pub entries_removed: i64,
}

/// Event payload for coverage updates (T046)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageUpdatedEvent {
    pub document_id: String,
    pub coverage_percent: f64,
    pub cached_chunks: i32,
    pub total_chunks: i32,
}

impl From<CoverageStats> for CoverageUpdatedEvent {
    fn from(stats: CoverageStats) -> Self {
        Self {
            document_id: stats.document_id,
            coverage_percent: stats.coverage_percent,
            cached_chunks: stats.cached_chunks,
            total_chunks: stats.total_chunks,
        }
    }
}

/// Event payload for cache eviction (T092)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheEvictedEvent {
    pub evicted_count: i64,
    pub bytes_freed: i64,
}

/// Emit coverage updated event to frontend (T046)
fn emit_coverage_updated(app: &AppHandle, stats: &CoverageStats) {
    let event: CoverageUpdatedEvent = CoverageUpdatedEvent {
        document_id: stats.document_id.clone(),
        coverage_percent: stats.coverage_percent,
        cached_chunks: stats.cached_chunks,
        total_chunks: stats.total_chunks,
    };
    if let Err(e) = app.emit("audio-cache:coverage-updated", event) {
        tracing::warn!("Failed to emit coverage-updated event: {:?}", e);
    }
}

/// Get coverage statistics for a document
#[tauri::command]
pub async fn audio_cache_get_coverage(
    app: AppHandle,
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<CoverageResponse, String> {
    let service = create_service(&app, &db).await?;

    let coverage = service
        .get_coverage(&document_id, false)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to get coverage: {:?}", e))?;

    Ok(coverage.into())
}

/// Clear all cached audio for a document
#[tauri::command]
pub async fn audio_cache_clear_document(
    app: AppHandle,
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<ClearDocumentResponse, String> {
    let service = create_service(&app, &db).await?;

    let entries_removed = service
        .clear_document(&document_id)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to clear document cache: {:?}", e))?;

    // Emit coverage updated event (T046)
    let coverage = service
        .get_coverage(&document_id, false)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to get coverage after clear: {:?}", e))?;
    emit_coverage_updated(&app, &coverage);

    Ok(ClearDocumentResponse { entries_removed })
}

/// Notify frontend of coverage change for a document (T046)
/// Called after audio is stored to trigger UI update
#[tauri::command]
pub async fn audio_cache_notify_coverage(
    app: AppHandle,
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<CoverageResponse, String> {
    let service = create_service(&app, &db).await?;

    let coverage = service
        .get_coverage(&document_id, false)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to get coverage: {:?}", e))?;

    emit_coverage_updated(&app, &coverage);

    Ok(coverage.into())
}

/// Get overall cache statistics
#[tauri::command]
pub async fn audio_cache_get_stats(
    app: AppHandle,
    db: State<'_, DbInstances>,
) -> Result<CacheStatsResponse, String> {
    let service = create_service(&app, &db).await?;

    let stats = service
        .get_stats()
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to get stats: {:?}", e))?;

    Ok(stats.into())
}

/// Set the cache size limit
#[tauri::command]
pub async fn audio_cache_set_limit(
    app: AppHandle,
    db: State<'_, DbInstances>,
    max_size_bytes: i64,
) -> Result<(), String> {
    if max_size_bytes < 0 {
        return Err("VALIDATION_ERROR: Size limit cannot be negative".to_string());
    }

    let service = create_service(&app, &db).await?;

    service
        .set_size_limit(max_size_bytes)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to set size limit: {:?}", e))?;

    tracing::info!("Cache size limit set to {} bytes", max_size_bytes);
    Ok(())
}

/// Manually trigger cache eviction to target size
#[tauri::command]
pub async fn audio_cache_evict(
    app: AppHandle,
    db: State<'_, DbInstances>,
    target_size_bytes: i64,
) -> Result<EvictionResponse, String> {
    if target_size_bytes < 0 {
        return Err("VALIDATION_ERROR: Target size cannot be negative".to_string());
    }

    let service = create_service(&app, &db).await?;

    let result = service
        .evict(target_size_bytes)
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to evict cache: {:?}", e))?;

    tracing::info!(
        "Cache eviction complete: {} entries, {} bytes freed",
        result.evicted_count,
        result.bytes_freed
    );

    // Emit eviction event (T092)
    if result.evicted_count > 0 {
        let event = CacheEvictedEvent {
            evicted_count: result.evicted_count,
            bytes_freed: result.bytes_freed,
        };
        if let Err(e) = app.emit("audio-cache:evicted", event) {
            tracing::warn!("Failed to emit cache evicted event: {:?}", e);
        }
    }

    Ok(result.into())
}

/// Get current cache size limit
#[tauri::command]
pub async fn audio_cache_get_limit(
    app: AppHandle,
    db: State<'_, DbInstances>,
) -> Result<i64, String> {
    let service = create_service(&app, &db).await?;

    service
        .get_size_limit()
        .await
        .map_err(|e| format!("CACHE_ERROR: Failed to get size limit: {:?}", e))
}

// Helper to create the service with proper dependencies
async fn create_service(
    app: &AppHandle,
    db: &State<'_, DbInstances>,
) -> Result<AudioCacheService<SqliteAudioCacheRepo>, String> {
    let pool = get_pool(db).await?;
    let cache_dir = get_cache_dir(app)?;

    let repo = SqliteAudioCacheRepo::new(pool, cache_dir);
    Ok(AudioCacheService::new(repo))
}

// Helper to get the SQLite pool
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

// Helper to get the cache directory from the app handle
fn get_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|e| format!("PATH_ERROR: Failed to get cache directory: {}", e))
}
