//! Audio Export Tauri Commands
//!
//! Exposes audio export functionality to the frontend via Tauri IPC.
//! Includes progress event emission and cancellation support.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::sync::RwLock;

use crate::adapters::SqliteAudioCacheRepo;
use crate::application::AudioExportServiceImpl;
use crate::domain::export::{ExportOptions, ExportProgress, ExportReadiness, ExportResult};
use crate::ports::audio_export_service::AudioExportService;

/// State for the active export service (supports cancellation)
pub struct ExportState {
    service: RwLock<Option<Arc<AudioExportServiceImpl<SqliteAudioCacheRepo>>>>,
}

impl ExportState {
    pub fn new() -> Self {
        Self {
            service: RwLock::new(None),
        }
    }
}

impl Default for ExportState {
    fn default() -> Self {
        Self::new()
    }
}

/// Response for readiness check
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessResponse {
    pub ready: bool,
    pub coverage_percent: f64,
    pub missing_chunks: Vec<MissingChunkResponse>,
    pub estimated_duration_ms: i64,
    pub estimated_file_size_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingChunkResponse {
    pub page_number: i32,
    pub chunk_index: i32,
    pub text_preview: String,
}

impl From<ExportReadiness> for ReadinessResponse {
    fn from(r: ExportReadiness) -> Self {
        Self {
            ready: r.ready,
            coverage_percent: r.coverage_percent,
            missing_chunks: r
                .missing_chunks
                .into_iter()
                .map(|m| MissingChunkResponse {
                    page_number: m.page_number,
                    chunk_index: m.chunk_index,
                    text_preview: m.text_preview,
                })
                .collect(),
            estimated_duration_ms: r.estimated_duration_ms,
            estimated_file_size_bytes: r.estimated_file_size_bytes,
        }
    }
}

/// Response for export operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub success: bool,
    pub output_path: String,
    pub format: String,
    pub total_duration_ms: i64,
    pub chapter_count: i32,
    pub file_size_bytes: i64,
    pub exported_at: String,
}

impl From<ExportResult> for ExportResponse {
    fn from(r: ExportResult) -> Self {
        Self {
            success: r.success,
            output_path: r.output_path,
            format: r.format,
            total_duration_ms: r.total_duration_ms,
            chapter_count: r.chapter_count,
            file_size_bytes: r.file_size_bytes,
            exported_at: r.exported_at,
        }
    }
}

/// Event payload for export progress
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressEvent {
    pub phase: String,
    pub current_chunk: i32,
    pub total_chunks: i32,
    pub percent: f64,
    pub estimated_remaining_ms: i64,
}

impl From<ExportProgress> for ExportProgressEvent {
    fn from(p: ExportProgress) -> Self {
        Self {
            phase: p.phase,
            current_chunk: p.current_chunk,
            total_chunks: p.total_chunks,
            percent: p.percent,
            estimated_remaining_ms: p.estimated_remaining_ms,
        }
    }
}

/// Check if a document is ready for export
#[tauri::command]
pub async fn audio_export_check_ready(
    app: AppHandle,
    db: State<'_, DbInstances>,
    document_id: String,
    voice_id: Option<String>,
) -> Result<ReadinessResponse, String> {
    let service = create_service(&app, &db).await?;

    let readiness = service
        .check_readiness(&document_id, voice_id)
        .await
        .map_err(|e| format!("EXPORT_ERROR: {}", e))?;

    Ok(readiness.into())
}

/// Export document audio to a file
#[tauri::command]
pub async fn audio_export_document(
    app: AppHandle,
    db: State<'_, DbInstances>,
    export_state: State<'_, ExportState>,
    document_id: String,
    format: String,
    output_path: String,
    include_chapters: bool,
    chapter_strategy: String,
    voice_id: Option<String>,
) -> Result<ExportResponse, String> {
    let service = create_service(&app, &db).await?;
    let service = Arc::new(service);

    // Store service for potential cancellation
    {
        let mut state = export_state.service.write().await;
        *state = Some(service.clone());
    }

    // Create export options
    let options = ExportOptions {
        document_id,
        format,
        output_path,
        include_chapters,
        chapter_strategy,
        voice_id,
    };

    // Validate options
    options
        .validate()
        .map_err(|e| format!("VALIDATION_ERROR: {}", e))?;

    // Create progress callback that emits events
    let app_clone = app.clone();
    let progress_callback: Arc<dyn Fn(ExportProgress) + Send + Sync> = Arc::new(move |progress| {
        let event: ExportProgressEvent = progress.into();
        if let Err(e) = app_clone.emit("audio-export:progress", event) {
            tracing::warn!("Failed to emit export progress event: {:?}", e);
        }
    });

    // Run export
    let result = service
        .export(options, Some(progress_callback))
        .await
        .map_err(|e| format!("EXPORT_ERROR: {}", e))?;

    // Clear service from state
    {
        let mut state = export_state.service.write().await;
        *state = None;
    }

    // Emit completion event
    if let Err(e) = app.emit("audio-export:complete", result.clone()) {
        tracing::warn!("Failed to emit export complete event: {:?}", e);
    }

    Ok(result.into())
}

/// Cancel an in-progress export
#[tauri::command]
pub async fn audio_export_cancel(export_state: State<'_, ExportState>) -> Result<bool, String> {
    let state = export_state.service.read().await;

    if let Some(service) = state.as_ref() {
        let cancelled = service.cancel();
        tracing::info!("Export cancellation requested: {}", cancelled);
        Ok(cancelled)
    } else {
        Ok(false) // No export in progress
    }
}

// Helper to create the export service with proper dependencies
async fn create_service(
    app: &AppHandle,
    db: &State<'_, DbInstances>,
) -> Result<AudioExportServiceImpl<SqliteAudioCacheRepo>, String> {
    let pool = get_pool(db).await?;
    let cache_dir = get_cache_dir(app)?;

    let cache_repo = Arc::new(SqliteAudioCacheRepo::new(pool, cache_dir));
    Ok(AudioExportServiceImpl::new(cache_repo))
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
