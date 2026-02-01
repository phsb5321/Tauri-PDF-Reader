//! Session Tauri Command Handlers (T062-T064)
//!
//! Thin command handlers that delegate to SessionService.
//! These handlers only handle:
//! - Input parsing/validation
//! - Error mapping for frontend consumption
//! - Delegating to application services

use sqlx::{Pool, Sqlite};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::adapters::SqliteSessionRepo;
use crate::application::SessionService;
use crate::domain::errors::RepositoryError;
use crate::domain::sessions::ReadingSession;
use crate::ports::session_repository::{
    CreateSessionInput, SessionRestoreResponse, SessionSummary, UpdateSessionDocumentInput,
    UpdateSessionInput,
};

/// Map RepositoryError to frontend-friendly error string
fn map_error(e: RepositoryError) -> String {
    match e {
        RepositoryError::NotFound(msg) => format!("NOT_FOUND: {}", msg),
        RepositoryError::ValidationError(msg) => format!("VALIDATION_ERROR: {}", msg),
        RepositoryError::DatabaseError(msg) => format!("DATABASE_ERROR: {}", msg),
        RepositoryError::IoError(msg) => format!("IO_ERROR: {}", msg),
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

/// Create a SessionService instance with the current pool
async fn create_service(
    db: &State<'_, DbInstances>,
) -> Result<SessionService<SqliteSessionRepo>, String> {
    let pool = get_pool(db).await?;
    let repo = SqliteSessionRepo::new(pool);
    Ok(SessionService::new(repo))
}

// =============================================================================
// T062: Basic Session Commands (create, get, list)
// =============================================================================

/// Create a new reading session
#[tauri::command]
pub async fn session_create(
    db: State<'_, DbInstances>,
    name: String,
    document_ids: Vec<String>,
) -> Result<ReadingSession, String> {
    let service = create_service(&db).await?;
    let input = CreateSessionInput { name, document_ids };

    service.create(input).await.map_err(map_error)
}

/// Get a session by ID with all documents
#[tauri::command]
pub async fn session_get(
    db: State<'_, DbInstances>,
    session_id: String,
) -> Result<Option<ReadingSession>, String> {
    let service = create_service(&db).await?;
    service.get(&session_id).await.map_err(map_error)
}

/// List all sessions (summary only)
#[tauri::command]
pub async fn session_list(db: State<'_, DbInstances>) -> Result<Vec<SessionSummary>, String> {
    let service = create_service(&db).await?;
    service.list().await.map_err(map_error)
}

// =============================================================================
// T063: Session Update/Delete/Restore Commands
// =============================================================================

/// Update a session's name and/or documents
#[tauri::command]
pub async fn session_update(
    db: State<'_, DbInstances>,
    session_id: String,
    name: Option<String>,
    document_ids: Option<Vec<String>>,
) -> Result<ReadingSession, String> {
    let service = create_service(&db).await?;
    let input = UpdateSessionInput { name, document_ids };

    service.update(&session_id, input).await.map_err(map_error)
}

/// Delete a session
#[tauri::command]
pub async fn session_delete(db: State<'_, DbInstances>, session_id: String) -> Result<(), String> {
    let service = create_service(&db).await?;
    service.delete(&session_id).await.map_err(map_error)
}

/// Restore a session (touch last_accessed and check for missing documents)
#[tauri::command]
pub async fn session_restore(
    db: State<'_, DbInstances>,
    session_id: String,
) -> Result<SessionRestoreResponse, String> {
    let service = create_service(&db).await?;
    service.restore(&session_id).await.map_err(map_error)
}

// =============================================================================
// T064: Session Document Management Commands
// =============================================================================

/// Add a document to a session
#[tauri::command]
pub async fn session_add_document(
    db: State<'_, DbInstances>,
    session_id: String,
    document_id: String,
    position: Option<i32>,
) -> Result<(), String> {
    let service = create_service(&db).await?;
    service
        .add_document(&session_id, &document_id, position)
        .await
        .map_err(map_error)
}

/// Remove a document from a session
#[tauri::command]
pub async fn session_remove_document(
    db: State<'_, DbInstances>,
    session_id: String,
    document_id: String,
) -> Result<(), String> {
    let service = create_service(&db).await?;
    service
        .remove_document(&session_id, &document_id)
        .await
        .map_err(map_error)
}

/// Update a document's reading position within a session
#[tauri::command]
pub async fn session_update_document(
    db: State<'_, DbInstances>,
    session_id: String,
    document_id: String,
    current_page: Option<i32>,
    scroll_position: Option<f64>,
) -> Result<(), String> {
    let service = create_service(&db).await?;
    let input = UpdateSessionDocumentInput {
        current_page,
        scroll_position,
    };

    service
        .update_document(&session_id, &document_id, input)
        .await
        .map_err(map_error)
}

/// Touch a session to update its last_accessed_at timestamp
#[tauri::command]
pub async fn session_touch(db: State<'_, DbInstances>, session_id: String) -> Result<(), String> {
    let service = create_service(&db).await?;
    service.touch(&session_id).await.map_err(map_error)
}
